// Smoke test: fetch the live site, parse with the MCP's html-parser, print results.
//   node smoke-test.mjs
// Confirms the parser works against the production HTML without needing the MCP transport.
import { carebridgeClient } from "./dist/api-client.js";
import { parseArticleCards, parseArticleDetail, parseFaqEntries, parsePageLanguage } from "./dist/html-parser.js";

async function main() {
  console.log("→ site:", carebridgeClient.baseUrl);

  const indexHtml = await carebridgeClient.fetchHtml("/articles");
  console.log("→ /articles page language:", parsePageLanguage(indexHtml));
  const cards = parseArticleCards(indexHtml);
  console.log(`→ ${cards.length} article cards on /articles:`);
  for (const c of cards) {
    console.log(`  - [${c.category ?? "—"} · ${c.readingTime ?? "—"}] ${c.title}  → /articles/${c.slug}`);
  }

  if (cards[0]) {
    console.log(`\n→ fetching /articles/${cards[0].slug} …`);
    const html = await carebridgeClient.fetchHtml(`/articles/${cards[0].slug}`);
    const detail = parseArticleDetail(html, cards[0].slug);
    if (detail) {
      console.log(`  title:    ${detail.title}`);
      console.log(`  category: ${detail.category ?? "—"}`);
      console.log(`  excerpt:  ${detail.excerpt.slice(0, 80)}…`);
      console.log(`  body (${detail.bodyMarkdown.length} chars, first 240):`);
      console.log("    " + detail.bodyMarkdown.slice(0, 240).replace(/\n/g, "\n    "));
    }
  }

  console.log("\n→ fetching / for FAQs …");
  const homeHtml = await carebridgeClient.fetchHtml("/");
  const faqs = parseFaqEntries(homeHtml);
  console.log(`→ ${faqs.length} FAQs:`);
  for (const f of faqs) console.log(`  Q: ${f.question}\n  A: ${f.answer}\n`);
}

main().catch((error) => {
  console.error("smoke test failed:", error);
  process.exit(1);
});
