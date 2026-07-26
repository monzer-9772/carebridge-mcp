# CareBridge MCP Server

Model Context Protocol (MCP) server for the **CareBridge** medical-tourism
coordination platform. Exposes a small, safe, **public-side** tool surface so an
AI agent (Claude, Mavis, an IDE plugin, a custom assistant) can:

- discover CareBridge articles and FAQs
- submit an initial contact lead on behalf of a website visitor
- list the languages the public site supports

The server is **read-only by default** (one write tool, the public lead form).
No admin keys, no patient PII, no outbound CRM calls.

> **Status**: v0.1.0 — public-site surface only. Admin / sandbox / knowledge
> tools are intentionally out of scope for this initial release.

---

## Why

A platform with rich public content (articles, FAQs, treatment guides) is a
natural fit for an MCP. A travel-agent AI, for example, can use this server
to:

1. `carebridge_list_articles` to see what's published.
2. `carebridge_get_article` to read a specific guide.
3. `carebridge_search_articles` to find guides that match a patient's concern.
4. `carebridge_submit_lead` to forward an interested visitor into the actual
   CareBridge pipeline.

The server never sees admin credentials, never reads the database, and never
posts to HubSpot / WhatsApp / Google Calendar.

---

## Tools (v0.1.0)

| Tool | Type | What it does |
|---|---|---|
| `carebridge_list_articles` | read | List public articles (title, excerpt, category, reading time) |
| `carebridge_get_article` | read | Fetch a single article by slug, returns full body |
| `carebridge_search_articles` | read | Free-text search across title + excerpt |
| `carebridge_list_locales` | read | List supported public locales (8: ar, en, fr, ru, ro, de, es, tr) |
| `carebridge_get_faqs` | read | Return the homepage FAQ entries |
| `carebridge_submit_lead` | write | Submit a public lead (name, country, phone, treatment) |

All read tools are `readOnlyHint: true` and `idempotentHint: true`.
`carebridge_submit_lead` is the only write tool — it is the public form, not
an admin op.

---

## Install

```bash
cd carebridge-mcp
npm install
npm run build
```

Or with pnpm / yarn — pick your favorite.

## Run

### stdio (default — for IDE integration)

```bash
CAREBRIDGE_BASE_URL=https://carebridge-tfui.onrender.com \
  node dist/index.js
```

Point your MCP client (Claude Desktop, Mavis, Continue, etc.) at
`node /path/to/carebridge-mcp/dist/index.js`.

### HTTP (for remote / multi-client)

```bash
MCP_TRANSPORT=http MCP_HTTP_PORT=3100 \
  CAREBRIDGE_BASE_URL=https://carebridge-tfui.onrender.com \
  node dist/index.js
# → POST http://127.0.0.1:3100/mcp   (streamable HTTP, stateless)
# → GET  http://127.0.0.1:3100/health → { "status": "ok", ... }
```

### Local dev (against a running CareBridge)

```bash
# 1. Start CareBridge locally (in another terminal)
cd ../carebridge
pnpm dev
# 2. Point the MCP at it
cd ../carebridge-mcp
CAREBRIDGE_BASE_URL=http://localhost:3000 \
  MCP_TRANSPORT=http MCP_HTTP_PORT=3100 \
  npm run dev
```

---

## Config

`.env.example` is shipped as the template. Copy to `.env` and edit.

| Var | Default | Notes |
|---|---|---|
| `CAREBRIDGE_BASE_URL` | `https://carebridge-tfui.onrender.com` | No trailing slash |
| `CAREBRIDGE_HTTP_TIMEOUT_MS` | `15000` | Per-request fetch timeout |
| `CAREBRIDGE_USER_AGENT` | `carebridge-mcp-server/0.1` | Sent in `User-Agent` header |
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `MCP_HTTP_PORT` | `3100` | HTTP transport port |
| `MCP_HTTP_HOST` | `127.0.0.1` | Bind to localhost by default |

---

## Wire to a client

### Claude Desktop (`~/.config/claude-desktop/config.json` on Linux, similar on macOS/Windows)

```json
{
  "mcpServers": {
    "carebridge": {
      "command": "node",
      "args": ["/absolute/path/to/carebridge-mcp/dist/index.js"],
      "env": {
        "CAREBRIDGE_BASE_URL": "https://carebridge-tfui.onrender.com"
      }
    }
  }
}
```

### Mavis / local desktop

Add the MCP server via the Mavis `mcp` command. See Mavis docs for the
specific UI flow.

---

## Security model

| Concern | This server |
|---|---|
| Patient PII | **Never reads or stores**. The lead tool only writes after Zod validation. |
| Admin endpoints | **Not exposed**. No `ADMIN_API_KEY`, no `AUTH_SECRET`. |
| Outbound side effects | Only the public lead form. No HubSpot / WhatsApp / Gmail. |
| Cookies / sessions | **Not forwarded**. The MCP is stateless and never sees user cookies. |
| Sandbox vs live | Caller's choice via `CAREBRIDGE_BASE_URL`. Default is live sandbox. |
| Rate limits | Inherits the site. Public reads are not rate-limited on CareBridge. |

The `carebridge_submit_lead` tool enforces the same input shape the public
form does, including the honeypot field. A bot that fills the honeypot is
rejected without a network call.

---

## Architecture

```
┌──────────────┐    stdio or HTTP    ┌──────────────────────┐
│ MCP client   │ ──────────────────▶ │ carebridge-mcp-server │
│ (Claude,     │                     │   (Node 20+)           │
│  Mavis, …)   │ ◀────────────────── │   5 tools             │
└──────────────┘                     └──────────┬───────────┘
                                                │  HTTPS
                                                │  (no auth, no cookies)
                                                ▼
                                   ┌────────────────────────┐
                                   │  carebridge-tfui        │
                                   │  .onrender.com (Next)   │
                                   │  - /articles            │
                                   │  - /api/leads (POST)    │
                                   └────────────────────────┘
```

HTML is parsed with hand-rolled regexes (no cheerio dep). The article
listing is the public `/articles` page; the lead form is the public
`/api/leads` POST endpoint that the public site form already calls.

---

## Limitations (v0.1.0)

- **HTML scraping is fragile.** If the public site layout changes, the
  parsers may need updates. A future version should add a stable
  `/api/public/articles.json` endpoint on the CareBridge side.
- **Locale is best-effort.** Public reads do not switch locale server-side;
  the parser tries to detect the page language from `<html lang>`. Article
  body text comes back in whatever language the page is in.
- **Lead submission is fire-and-forget.** No follow-up, no status check, no
  retry. The CareBridge side handles queueing and assignment.
- **HTTP transport is stateless.** No `Mcp-Session-Id` round-trip; suitable
  for short-lived tool calls, not for long-running sessions.

---

## Roadmap

- `carebridge_search_knowledge` — query the Halim knowledge base (sandbox)
- `carebridge_demo_clinic_status` / `carebridge_demo_chat_message` — talk to
  the demo clinic (sandbox, no PII)
- `carebridge_admin_dashboard_summary` — read-only admin counts (requires
  caller to pass `ADMIN_API_KEY` through, never stored in MCP)
- Stable `/api/public/articles.json` endpoint on the CareBridge side
- Stateful HTTP transport with session persistence
- Docker image for the MCP server

---

## License

Internal / not for redistribution. The MCP server is a thin wrapper over the
public CareBridge site; it inherits the same access policy as the public
site.
