// CareBridge MCP server entry point.
// Transport: stdio (default) or streamable HTTP (for remote / multi-client).
//
// Usage:
//   stdio:   CAREBRIDGE_BASE_URL=… node dist/index.js
//   http:    MCP_TRANSPORT=http MCP_HTTP_PORT=3100 node dist/index.js

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";

import { registerArticleTools } from "./tools/articles.js";
import { registerLocaleTools } from "./tools/locales.js";
import { registerLeadTool } from "./tools/lead.js";
import { MCP_HTTP_HOST, MCP_HTTP_PORT, MCP_TRANSPORT } from "./constants.js";
import { carebridgeClient } from "./api-client.js";

const server = new McpServer({
  name: "carebridge-mcp-server",
  version: "0.1.0",
});

registerArticleTools(server);
registerLocaleTools(server);
registerLeadTool(server);

async function main() {
  if (MCP_TRANSPORT === "http") {
    await startHttp();
  } else {
    await startStdio();
  }
}

async function startStdio() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console -- MCP servers log to stderr so they don't pollute the protocol stream on stdout
  console.error(`carebridge-mcp-server: stdio transport ready (site=${carebridgeClient.baseUrl})`);
}

async function startHttp() {
  const app = express();
  app.use(express.json({ limit: "64kb" }));

  // Streamable HTTP transport — stateless: each request gets a fresh transport.
  // (Stateful sessions would be a follow-up; for sandbox/MVP, stateless is enough.)
  app.post("/mcp", async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "carebridge-mcp-server", version: "0.1.0", site: carebridgeClient.baseUrl });
  });

  app.listen(MCP_HTTP_PORT, MCP_HTTP_HOST, () => {
    // eslint-disable-next-line no-console
    console.error(
      `carebridge-mcp-server: HTTP transport listening on http://${MCP_HTTP_HOST}:${MCP_HTTP_PORT}/mcp (site=${carebridgeClient.baseUrl})`,
    );
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("carebridge-mcp-server: fatal", error);
  process.exit(1);
});
