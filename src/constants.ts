// CareBridge MCP server — runtime constants.
// Values are read from process.env at startup; defaults are safe-for-sandbox.

const env = (key: string, fallback?: string): string => {
  const v = process.env[key];
  if (v !== undefined && v !== "") return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${key}`);
};

const num = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) throw new Error(`Env var ${key} must be a number, got: ${raw}`);
  return parsed;
};

export const CAREBRIDGE_BASE_URL = env("CAREBRIDGE_BASE_URL", "https://carebridge-tfui.onrender.com").replace(/\/+$/, "");
export const CAREBRIDGE_HTTP_TIMEOUT_MS = num("CAREBRIDGE_HTTP_TIMEOUT_MS", 15_000);
export const CAREBRIDGE_USER_AGENT = env("CAREBRIDGE_USER_AGENT", "carebridge-mcp-server/0.1");

export const MCP_TRANSPORT = env("MCP_TRANSPORT", "stdio") as "stdio" | "http";
export const MCP_HTTP_PORT = num("MCP_HTTP_PORT", 3100);
export const MCP_HTTP_HOST = env("MCP_HTTP_HOST", "127.0.0.1");

// Article slugs in the live site (lib/articles.ts) — used to validate `carebridge_get_article` input.
export const KNOWN_ARTICLE_SLUGS = [
  "initial-dental-assessment",
  "clinic-review-guide",
  "istanbul-treatment-journey",
  "treatment-day-guide",
  "after-treatment-follow-up",
  "dental-care-in-turkey",
] as const;
