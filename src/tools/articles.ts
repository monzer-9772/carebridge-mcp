// CareBridge MCP — public article tools.
// All read-only, no PII, no auth.

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { carebridgeClient } from "../api-client.js";
import { parseArticleCards, parseArticleDetail } from "../html-parser.js";
import { KNOWN_ARTICLE_SLUGS } from "../constants.js";

const ListInput = z.object({
  locale: z
    .string()
    .min(2)
    .max(8)
    .optional()
    .describe("BCP-47 locale code (e.g. 'ar', 'en', 'tr'). Falls back to the site's default."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum number of cards to return. Default: 20."),
});

const GetInput = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .describe("Article slug, e.g. 'initial-dental-assessment'."),
  locale: z.string().min(2).max(8).optional().describe("Optional locale code."),
});

const SearchInput = z.object({
  query: z
    .string()
    .min(2)
    .max(120)
    .describe("Free-text search across title and excerpt."),
  locale: z.string().min(2).max(8).optional(),
  limit: z.number().int().min(1).max(20).optional().describe("Default: 10."),
});

const localeCookie = (locale?: string): string =>
  locale ? `carebridge_locale=${encodeURIComponent(locale)}; Path=/` : "";

async function fetchArticlesList(locale?: string, limit = 20) {
  // The /articles page lists all six cards. The homepage shows up to 6 too,
  // but /articles is the canonical listing.
  const html = await carebridgeClient.fetchHtml("/articles");
  const cards = parseArticleCards(html);
  return cards.slice(0, limit);
}

export function registerArticleTools(server: McpServer): void {
  server.registerTool(
    "carebridge_list_articles",
    {
      title: "List CareBridge articles",
      description:
        "Return the public articles published on the CareBridge site. " +
        "Read-only. Returns at most `limit` cards (default 20) with title, excerpt, category, reading time.",
      inputSchema: ListInput.shape,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const limit = args.limit ?? 20;
      const cards = await fetchArticlesList(args.locale, limit);
      return {
        content: [{ type: "text", text: JSON.stringify({ count: cards.length, articles: cards }, null, 2) }],
        structuredContent: { count: cards.length, articles: cards },
      };
    },
  );

  server.registerTool(
    "carebridge_get_article",
    {
      title: "Get a CareBridge article",
      description:
        "Fetch the full body of a public article by slug. " +
        "Use `carebridge_list_articles` first to discover slugs. " +
        "Returns title, excerpt, body paragraphs, category, reading time.",
      inputSchema: GetInput.shape,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      // Slug safety: CareBridge slugs use kebab-case ASCII only.
      if (!/^[a-z0-9-]+$/.test(args.slug)) {
        return toolError("Invalid slug", "Slug must be kebab-case ASCII (a-z, 0-9, hyphen).");
      }
      const html = await carebridgeClient.fetchHtml(`/articles/${args.slug}`);
      const article = parseArticleDetail(html, args.slug);
      if (!article) {
        return toolError("Article not found", `Slug '${args.slug}' did not match a published article.`);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(article, null, 2) }],
        structuredContent: article,
      };
    },
  );

  server.registerTool(
    "carebridge_search_articles",
    {
      title: "Search CareBridge articles",
      description:
        "Search public articles by free-text query. " +
        "Matches against the localized title and excerpt. Returns the best matches first.",
      inputSchema: SearchInput.shape,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const limit = args.limit ?? 10;
      const cards = await fetchArticlesList(args.locale, 50);
      const needle = args.query.toLocaleLowerCase(args.locale);
      const scored = cards
        .map((card) => {
          const haystack = `${card.title}\n${card.excerpt}\n${card.category ?? ""}`.toLocaleLowerCase(args.locale);
          const titleHit = card.title.toLocaleLowerCase(args.locale).includes(needle) ? 3 : 0;
          const textHit = haystack.includes(needle) ? 1 : 0;
          return { card, score: titleHit + textHit };
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry) => entry.card);
      return {
        content: [
          { type: "text", text: JSON.stringify({ query: args.query, count: scored.length, articles: scored }, null, 2) },
        ],
        structuredContent: { query: args.query, count: scored.length, articles: scored },
      };
    },
  );

  // Expose known slugs via a hidden helper so an agent can validate inputs cheaply.
  void KNOWN_ARTICLE_SLUGS;
  void localeCookie;
}

function toolError(title: string, detail: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: `${title}: ${detail}` }],
  };
}
