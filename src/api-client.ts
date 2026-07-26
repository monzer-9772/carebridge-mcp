// HTTP client for fetching public CareBridge pages.
// Uses native fetch (Node 20+). No auth, no PII, no cookies.

import { CAREBRIDGE_BASE_URL, CAREBRIDGE_HTTP_TIMEOUT_MS, CAREBRIDGE_USER_AGENT } from "./constants.js";

export class CareBridgeApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: string;

  constructor(message: string, status: number, url: string, body: string) {
    super(message);
    this.name = "CareBridgeApiError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

async function fetchPage(path: string, accept: "html" | "json" = "html"): Promise<string> {
  const url = `${CAREBRIDGE_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CAREBRIDGE_HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: accept === "json" ? "application/json" : "text/html,application/xhtml+xml",
        "User-Agent": CAREBRIDGE_USER_AGENT,
      },
      signal: controller.signal,
      // The site uses cookies for locale; do not forward any client cookies.
      redirect: "follow",
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new CareBridgeApiError(
        `CareBridge ${url} returned ${response.status}`,
        response.status,
        url,
        body.slice(0, 500),
      );
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export const carebridgeClient = {
  baseUrl: CAREBRIDGE_BASE_URL,
  fetchHtml: (path: string) => fetchPage(path, "html"),
  fetchJson: async <T>(path: string): Promise<T> => {
    const raw = await fetchPage(path, "json");
    return JSON.parse(raw) as T;
  },
};
