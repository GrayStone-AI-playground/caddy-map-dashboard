import http from "node:http";
import https from "node:https";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";

import { getDemoSnapshot } from "@/lib/caddy/demo";
import type { DashboardSnapshot, DashboardSource } from "@/lib/types";

const execFileAsync = promisify(execFile);

interface SourceLoadResult {
  source: DashboardSource;
  config?: unknown;
  snapshot?: DashboardSnapshot;
}

function isTruthy(value: string | undefined) {
  return value === "1" || value === "true";
}

function allowSelfSigned() {
  return isTruthy(process.env.CADDY_DASHBOARD_ALLOW_SELF_SIGNED);
}

async function fileExists(path: string) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function parseJson(text: string, label: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(
      `Could not parse JSON from ${label}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

async function requestJson(urlText: string, timeoutMs: number) {
  const url = new URL(urlText);
  const client = url.protocol === "https:" ? https : http;

  return new Promise<unknown>((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: "GET",
        rejectUnauthorized:
          url.protocol === "https:" ? !allowSelfSigned() : undefined,
        headers: {
          "user-agent": "caddy-map-dashboard/0.1",
        },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.once("end", () => {
          const status = response.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(new Error(`HTTP ${status}`));
            return;
          }

          try {
            resolve(parseJson(body, urlText));
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("timeout"));
    });

    request.once("error", (error) => {
      reject(error);
    });

    request.end();
  });
}

export async function loadConfiguredSource(): Promise<SourceLoadResult> {
  const checkedAt = new Date().toISOString();
  const issues: string[] = [];

  if (isTruthy(process.env.CADDY_DASHBOARD_DEMO_MODE)) {
    const snapshot = getDemoSnapshot();
    return { snapshot, source: snapshot.source };
  }

  const adminUrl = process.env.CADDY_ADMIN_URL?.trim();
  if (adminUrl) {
    try {
      return {
        config: await requestJson(adminUrl, 1_500),
        source: {
          kind: "admin",
          label: adminUrl,
          checkedAt,
          issues,
        },
      };
    } catch (error) {
      issues.push(
        `Admin API load failed at ${adminUrl}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  const jsonPath = process.env.CADDY_CONFIG_JSON_PATH?.trim();
  if (jsonPath) {
    if (await fileExists(jsonPath)) {
      const text = await readFile(jsonPath, "utf8");
      return {
        config: parseJson(text, jsonPath),
        source: {
          kind: "json-file",
          label: jsonPath,
          checkedAt,
          issues,
        },
      };
    }

    issues.push(`Configured JSON file is missing: ${jsonPath}`);
  }

  const caddyfilePath = process.env.CADDYFILE_PATH?.trim();
  if (caddyfilePath) {
    if (await fileExists(caddyfilePath)) {
      try {
        const caddyBin = process.env.CADDY_BIN?.trim() || "caddy";
        const adapter = process.env.CADDY_ADAPTER?.trim() || "caddyfile";
        const { stdout } = await execFileAsync(
          caddyBin,
          ["adapt", "--config", caddyfilePath, "--adapter", adapter, "--pretty"],
          {
            timeout: 5_000,
            maxBuffer: 1_000_000,
          },
        );
        const fileStats = await stat(caddyfilePath);

        return {
          config: parseJson(stdout, `${caddyBin} adapt`),
          source: {
            kind: "adapted-file",
            label: caddyfilePath,
            checkedAt,
            fileMTime: fileStats.mtime.toISOString(),
            issues,
          },
        };
      } catch (error) {
        issues.push(
          `Caddy adapt failed for ${caddyfilePath}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    } else {
      issues.push(`Configured Caddyfile is missing: ${caddyfilePath}`);
    }
  }

  const snapshot = getDemoSnapshot(
    issues.length > 0
      ? issues
      : [
          "No live Caddy source was configured. Set CADDY_ADMIN_URL, CADDY_CONFIG_JSON_PATH, or CADDYFILE_PATH.",
        ],
  );

  return {
    snapshot,
    source: snapshot.source,
  };
}
