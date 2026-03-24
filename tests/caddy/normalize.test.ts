import { describe, expect, it } from "vitest";

import { normalizeCaddyConfig } from "@/lib/caddy/normalize";

describe("normalizeCaddyConfig", () => {
  it("extracts reverse proxies, file servers, redirects, and removes auto https redirects", () => {
    const config = {
      apps: {
        http: {
          servers: {
            main: {
              listen: [":443"],
              routes: [
                {
                  match: [{ host: ["inventree.caddy.lan"] }],
                  handle: [
                    {
                      handler: "reverse_proxy",
                      upstreams: [{ dial: "127.0.0.1:8081" }],
                    },
                  ],
                },
                {
                  match: [{ host: ["notes.caddy.lan"] }],
                  handle: [
                    { handler: "vars", root: "/srv/notes" },
                    { handler: "file_server" },
                  ],
                },
                {
                  match: [{ host: ["old.caddy.lan"] }],
                  handle: [
                    {
                      handler: "static_response",
                      headers: { Location: ["https://new.caddy.lan"] },
                    },
                  ],
                },
              ],
            },
            redirects: {
              listen: [":80"],
              routes: [
                {
                  match: [{ host: ["inventree.caddy.lan"] }],
                  handle: [
                    {
                      handler: "static_response",
                      headers: { Location: ["https://inventree.caddy.lan"] },
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    };

    const services = normalizeCaddyConfig(config);

    expect(services).toHaveLength(3);
    expect(
      services.find((service) => service.record === "inventree.caddy.lan"),
    ).toMatchObject({
      routeType: "reverse_proxy",
      mappedTo: ["127.0.0.1:8081"],
      listeners: [":443"],
    });
    expect(
      services.find((service) => service.record === "notes.caddy.lan"),
    ).toMatchObject({
      routeType: "file_server",
      mappedTo: ["/srv/notes"],
    });
    expect(
      services.find((service) => service.record === "old.caddy.lan"),
    ).toMatchObject({
      routeType: "redirect",
      mappedTo: ["https://new.caddy.lan"],
    });
  });

  it("merges multiple leaves for the same hostname into a mixed record", () => {
    const config = {
      apps: {
        http: {
          servers: {
            main: {
              listen: [":443"],
              routes: [
                {
                  match: [{ host: ["combo.caddy.lan"] }],
                  handle: [
                    {
                      handler: "subroute",
                      routes: [
                        {
                          handle: [
                            {
                              handler: "reverse_proxy",
                              upstreams: [{ dial: "127.0.0.1:9000" }],
                            },
                          ],
                        },
                        {
                          handle: [
                            {
                              handler: "static_response",
                              headers: { Location: ["https://other.caddy.lan"] },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    };

    const [service] = normalizeCaddyConfig(config);

    expect(service.routeType).toBe("mixed");
    expect(service.mappedTo).toEqual([
      "127.0.0.1:9000",
      "https://other.caddy.lan",
    ]);
    expect(service.notes).toContain("multiple routes");
  });
});
