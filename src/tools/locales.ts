// Public locale + FAQ tools — read-only, no PII.

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { carebridgeClient } from "../api-client.js";
import { parseFaqEntries, parsePageLanguage } from "../html-parser.js";

const LocalesInput = z.object({});

const FaqInput = z.object({
  locale: z.string().min(2).max(8).optional().describe("Optional locale code."),
});

// Public locales (mirrors lib/i18n.ts on the CareBridge side). Keep in sync
// if the site ever drops or adds a public language.
const PUBLIC_LOCALES: ReadonlyArray<{ code: string; nativeName: string; dir: "ltr" | "rtl" }> = [
  { code: "ar", nativeName: "العربية", dir: "rtl" },
  { code: "en", nativeName: "English", dir: "ltr" },
  { code: "fr", nativeName: "Français", dir: "ltr" },
  { code: "ru", nativeName: "Русский", dir: "ltr" },
  { code: "ro", nativeName: "Română", dir: "ltr" },
  { code: "de", nativeName: "Deutsch", dir: "ltr" },
  { code: "es", nativeName: "Español", dir: "ltr" },
  { code: "tr", nativeName: "Türkçe", dir: "ltr" },
];

export function registerLocaleTools(server: McpServer): void {
  server.registerTool(
    "carebridge_list_locales",
    {
      title: "List supported public locales",
      description:
        "Return the locales exposed on the public CareBridge site (e.g. for the language switcher). " +
        "Each entry has the locale code, native name, and reading direction.",
      inputSchema: LocalesInput.shape,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => ({
      content: [
        { type: "text", text: JSON.stringify({ count: PUBLIC_LOCALES.length, locales: PUBLIC_LOCALES }, null, 2) },
      ],
      structuredContent: { count: PUBLIC_LOCALES.length, locales: PUBLIC_LOCALES },
    }),
  );

  server.registerTool(
    "carebridge_get_faqs",
    {
      title: "Get CareBridge FAQs",
      description:
        "Return the public FAQ entries from the homepage. " +
        "Each entry is a {question, answer} pair. No PII, no auth.",
      inputSchema: FaqInput.shape,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const html = await carebridgeClient.fetchHtml("/");
      const faqs = parseFaqEntries(html);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                detectedLanguage: parsePageLanguage(html),
                count: faqs.length,
                faqs,
              },
              null,
              2,
            ),
          },
        ],
        structuredContent: { count: faqs.length, faqs, detectedLanguage: parsePageLanguage(html) },
      };
    },
  );
}
