import { carebridgeClient } from "./dist/api-client.js";
import { parseArticleCards, parseArticleDetail, parsePageLanguage } from "./dist/html-parser.js";

// Test Turkish locale: the site is server-rendered based on the cookie.
// We can't set cookies via the MCP client (intentional), but we can
// verify that the API client sends the right User-Agent and that the
// page language detection works.

const articlesHtml = await carebridgeClient.fetchHtml("/articles");
console.log("ar default articles:", parsePageLanguage(articlesHtml));
console.log("ar cards count:", parseArticleCards(articlesHtml).length);

// Verify each known slug returns a real article body
const slugs = ["initial-dental-assessment", "clinic-review-guide", "istanbul-treatment-journey"];
for (const slug of slugs) {
  const html = await carebridgeClient.fetchHtml(`/articles/${slug}`);
  const detail = parseArticleDetail(html, slug);
  console.log(`\n[${slug}]`);
  if (!detail) {
    console.log("  NOT FOUND");
    continue;
  }
  console.log(`  title:    ${detail.title}`);
  console.log(`  category: ${detail.category ?? "—"}`);
  console.log(`  readingTimeFull: ${detail.readingTimeFull ?? "—"}`);
  console.log(`  body length: ${detail.bodyMarkdown.length} chars`);
  console.log(`  first 80:  ${detail.bodyMarkdown.slice(0, 80).replace(/\n/g, " ")}…`);
}
