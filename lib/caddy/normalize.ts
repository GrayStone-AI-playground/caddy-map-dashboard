import type {
  DashboardServiceBase,
  RouteType,
  TransportHint,
} from "@/lib/types";

interface WalkContext {
  hostnames: string[];
  listeners: string[];
  path: string;
  roots: string[];
}

interface LeafRecord {
  hostnames: string[];
  listeners: string[];
  routeType: RouteType;
  mappedTo: string[];
  upstreams: string[];
  notes: string[];
  roots: string[];
  sourcePath: string;
  transportHint: TransportHint;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function extractHostnames(matchers: unknown) {
  if (!Array.isArray(matchers)) {
    return [];
  }

  return unique(
    matchers.flatMap((matcher) => {
      if (!isRecord(matcher)) {
        return [];
      }

      return asStringArray(matcher.host);
    }),
  );
}

function extractUpstreams(handler: UnknownRecord) {
  const upstreams = Array.isArray(handler.upstreams) ? handler.upstreams : [];

  return unique(
    upstreams.flatMap((upstream) => {
      if (!isRecord(upstream)) {
        return [];
      }

      return typeof upstream.dial === "string" ? [upstream.dial] : [];
    }),
  );
}

function detectTransportHint(handler: UnknownRecord): TransportHint {
  const transport = isRecord(handler.transport) ? handler.transport : undefined;
  if (!transport) {
    return "http";
  }

  if (typeof transport.protocol === "string" && transport.protocol !== "http") {
    return "unknown";
  }

  return "tls" in transport || "tls_server_name" in transport ? "https" : "http";
}

function extractLocationTarget(handler: UnknownRecord) {
  const headers = isRecord(handler.headers) ? handler.headers : undefined;
  const locationHeader = headers?.Location ?? headers?.location;

  if (typeof locationHeader === "string") {
    return locationHeader;
  }

  if (Array.isArray(locationHeader)) {
    return locationHeader.find((value): value is string => typeof value === "string");
  }

  return undefined;
}

function createLeaf(
  context: WalkContext,
  overrides: Partial<LeafRecord>,
): LeafRecord | null {
  const hostnames = unique(
    overrides.hostnames && overrides.hostnames.length > 0
      ? overrides.hostnames
      : context.hostnames,
  );
  const mappedTo = unique(overrides.mappedTo ?? []);
  const roots = unique([...(context.roots ?? []), ...(overrides.roots ?? [])]);

  if (hostnames.length === 0 && mappedTo.length === 0 && !overrides.routeType) {
    return null;
  }

  return {
    hostnames,
    listeners: unique(context.listeners),
    routeType: overrides.routeType ?? "unknown",
    mappedTo:
      mappedTo.length > 0
        ? mappedTo
        : overrides.routeType === "file_server" && roots.length > 0
          ? roots
          : [],
    upstreams: unique(overrides.upstreams ?? []),
    notes: unique(overrides.notes ?? []),
    roots,
    sourcePath: overrides.sourcePath ?? context.path,
    transportHint: overrides.transportHint ?? "unknown",
  };
}

function walkRoute(route: unknown, context: WalkContext, leaves: LeafRecord[]) {
  if (!isRecord(route)) {
    return;
  }

  const nextHosts = unique([...context.hostnames, ...extractHostnames(route.match)]);
  const baseContext: WalkContext = {
    ...context,
    hostnames: nextHosts,
  };
  const handlers = Array.isArray(route.handle) ? route.handle : [];

  handlers.forEach((handler, index) => {
    if (!isRecord(handler) || typeof handler.handler !== "string") {
      return;
    }

    const path = `${context.path}.handle[${index}]`;

    if (handler.handler === "vars" && typeof handler.root === "string") {
      baseContext.roots = unique([...baseContext.roots, handler.root]);
      return;
    }

    if (handler.handler === "subroute") {
      const nestedRoutes = Array.isArray(handler.routes) ? handler.routes : [];
      nestedRoutes.forEach((nestedRoute, nestedIndex) => {
        walkRoute(
          nestedRoute,
          {
            ...baseContext,
            path: `${path}.routes[${nestedIndex}]`,
          },
          leaves,
        );
      });
      return;
    }

    if (handler.handler === "reverse_proxy") {
      const upstreams = extractUpstreams(handler);
      const leaf = createLeaf(baseContext, {
        routeType: "reverse_proxy",
        mappedTo: upstreams,
        upstreams,
        sourcePath: path,
        notes: upstreams.length > 1 ? ["multiple upstreams"] : ["reverse proxy"],
        transportHint: detectTransportHint(handler),
      });

      if (leaf) {
        leaves.push(leaf);
      }
      return;
    }

    if (handler.handler === "file_server") {
      const leaf = createLeaf(baseContext, {
        routeType: "file_server",
        sourcePath: path,
        notes: ["file server"],
      });

      if (leaf) {
        leaves.push(leaf);
      }
      return;
    }

    if (handler.handler === "static_response") {
      const redirectTarget = extractLocationTarget(handler);
      const leaf = createLeaf(baseContext, {
        routeType: redirectTarget ? "redirect" : "static_response",
        mappedTo: redirectTarget ? [redirectTarget] : [],
        sourcePath: path,
        notes: [redirectTarget ? "static redirect" : "static response"],
      });

      if (leaf) {
        leaves.push(leaf);
      }
    }
  });
}

function isHttpsListener(listener: string) {
  return /:443$|:8443$/.test(listener);
}

function extractPort(listener: string) {
  const match = listener.match(/:(\d+)$/);
  return match?.[1];
}

function buildPrimaryUrl(hostname: string | undefined, listeners: string[]) {
  if (!hostname || hostname.includes("*")) {
    return undefined;
  }

  const preferredListener =
    listeners.find((listener) => isHttpsListener(listener)) ?? listeners[0];
  const scheme = preferredListener && isHttpsListener(preferredListener) ? "https" : "http";
  const port = preferredListener ? extractPort(preferredListener) : undefined;
  const needsExplicitPort =
    port &&
    !(
      (scheme === "https" && port === "443") ||
      (scheme === "http" && port === "80")
    );

  return `${scheme}://${hostname}${needsExplicitPort ? `:${port}` : ""}`;
}

function deriveDisplayName(record: string) {
  if (!record) {
    return "Unnamed route";
  }

  const raw = record.split(".")[0] || record;

  return raw
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function stripAutomaticRedirects(leaves: LeafRecord[]) {
  const serviceHosts = new Set(
    leaves
      .filter((leaf) => leaf.routeType !== "redirect")
      .flatMap((leaf) => leaf.hostnames),
  );

  return leaves.filter((leaf) => {
    if (leaf.routeType !== "redirect" || leaf.hostnames.length === 0) {
      return true;
    }

    const redirectsBackToKnownHost = leaf.hostnames.every((hostname) =>
      leaf.mappedTo.some(
        (target) =>
          target.includes(`https://${hostname}`) || target.endsWith(hostname),
      ),
    );

    return !(
      redirectsBackToKnownHost &&
      leaf.hostnames.every((hostname) => serviceHosts.has(hostname))
    );
  });
}

function aggregateLeaves(leaves: LeafRecord[]) {
  const groups = new Map<string, LeafRecord[]>();

  leaves.forEach((leaf) => {
    const key =
      leaf.hostnames.length > 0
        ? `hosts:${leaf.hostnames.slice().sort().join("|")}`
        : `path:${leaf.sourcePath}`;

    const group = groups.get(key);
    if (group) {
      group.push(leaf);
    } else {
      groups.set(key, [leaf]);
    }
  });

  return [...groups.values()].map((group) => {
    const hostnames = unique(group.flatMap((leaf) => leaf.hostnames));
    const listeners = unique(group.flatMap((leaf) => leaf.listeners));
    const routeTypes = unique(group.map((leaf) => leaf.routeType)) as RouteType[];
    const mappedTo = unique(group.flatMap((leaf) => leaf.mappedTo));
    const upstreams = unique(group.flatMap((leaf) => leaf.upstreams));
    const notes = unique(group.flatMap((leaf) => leaf.notes));
    const sourcePaths = unique(group.map((leaf) => leaf.sourcePath));
    const transportHints = unique(group.map((leaf) => leaf.transportHint));
    const record = hostnames[0] ?? sourcePaths[0] ?? "unknown";
    const url = buildPrimaryUrl(hostnames[0], listeners);

    return {
      id: record,
      displayName: deriveDisplayName(record),
      record,
      url,
      hostnames,
      listeners,
      routeType: routeTypes.length === 1 ? routeTypes[0] : "mixed",
      mappedTo,
      upstreams,
      notes: group.length > 1 ? unique([...notes, "multiple routes"]) : notes,
      sourcePaths,
      transportHint: transportHints.includes("https")
        ? "https"
        : transportHints.includes("http")
          ? "http"
          : "unknown",
      lastUpdated: new Date().toISOString(),
    } satisfies DashboardServiceBase;
  });
}

export function normalizeCaddyConfig(config: unknown): DashboardServiceBase[] {
  if (!isRecord(config)) {
    return [];
  }

  const servers =
    isRecord(config.apps) &&
    isRecord(config.apps.http) &&
    isRecord(config.apps.http.servers)
      ? config.apps.http.servers
      : undefined;

  if (!servers) {
    return [];
  }

  const leaves: LeafRecord[] = [];

  Object.entries(servers).forEach(([serverName, serverValue]) => {
    if (!isRecord(serverValue)) {
      return;
    }

    const listeners = asStringArray(serverValue.listen);
    const routes = Array.isArray(serverValue.routes) ? serverValue.routes : [];

    routes.forEach((route, routeIndex) => {
      walkRoute(
        route,
        {
          hostnames: [],
          listeners,
          path: `apps.http.servers.${serverName}.routes[${routeIndex}]`,
          roots: [],
        },
        leaves,
      );
    });
  });

  return aggregateLeaves(stripAutomaticRedirects(leaves)).sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}
