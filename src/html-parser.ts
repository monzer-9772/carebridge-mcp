// Lightweight HTML extraction for the public CareBridge site.
// We do NOT pull in cheerio (extra dep); a couple of regexes cover what we need.

export type ArticleSummary = {
  slug: string;
  title: string;
  excerpt: string;
  category: string | null;
  readingTime: string | null;
  imageAlt: string | null;
};

export type ArticleFull = ArticleSummary & {
  bodyMarkdown: string;
  readingTimeFull: string | null;
  imageSource: string | null;
};

export type FaqEntry = { question: string; answer: string };

const stripTags = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const decodeEntities = (raw: string): string =>
  raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");

/** Extract article cards from the public site (homepage or /articles). */
export function parseArticleCards(html: string): ArticleSummary[] {
  const articles: ArticleSummary[] = [];
  const seen = new Set<string>();

  // Strategy: walk every <article>…</article> block, extract slug, alt, title, excerpt, meta.
  // The /articles page uses <h2> for the title and a "flex" div with two <span> children
  // (category with a colored background, then reading time). The homepage uses <h3> and
  // puts category · reading time in a single line of three spans.
  const articleRe = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let m: RegExpExecArray | null;
  while ((m = articleRe.exec(html)) !== null) {
    const body = m[1];

    const slugMatch = body.match(/href="\/articles\/([a-z0-9-]+)"/i);
    if (!slugMatch) continue;
    const slug = slugMatch[1];
    if (seen.has(slug)) continue;
    seen.add(slug);

    const imgAltMatch = body.match(/<img[^>]+alt="([^"]+)"/i);
    // Title: <h2> on /articles, <h3> on homepage
    const titleMatch =
      body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) ??
      body.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const excerptMatch = body.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

    if (!titleMatch) continue;
    const title = stripTags(titleMatch[1]);
    if (!title) continue;

    // Meta: try the /articles "two spans" pattern first, then the homepage "span · span" pattern.
    let category: string | null = null;
    let readingTime: string | null = null;
    const twoSpanMatch = body.match(
      /<div[^>]*class="[^"]*flex[^"]*"[^>]*>\s*<span[^>]*class="[^"]*bg-\[#[a-f0-9]+\][^"]*"[^>]*>([\s\S]*?)<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/i,
    );
    if (twoSpanMatch) {
      category = decodeEntities(twoSpanMatch[1]).trim();
      readingTime = decodeEntities(twoSpanMatch[2]).trim();
    } else {
      const inlineMetaMatch = body.match(
        /<span>([^<]+)<\/span>\s*(?:<!--[^>]*-->\s*)?[·•]\s*(?:<!--[^>]*-->\s*)?<span>([^<]+)<\/span>/,
      );
      if (inlineMetaMatch) {
        category = decodeEntities(inlineMetaMatch[1]).trim();
        readingTime = decodeEntities(inlineMetaMatch[2]).trim();
      }
    }

    articles.push({
      slug,
      title,
      excerpt: excerptMatch ? stripTags(excerptMatch[1]) : "",
      category,
      readingTime,
      imageAlt: imgAltMatch ? decodeEntities(imgAltMatch[1]) : null,
    });
  }

  // Fallback: if no <article> blocks (rare), try the homepage <a>-wraps-card layout.
  if (articles.length === 0) {
    const linkRe = /<a[^>]+href="\/articles\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRe.exec(html)) !== null) {
      const slug = linkMatch[1];
      if (seen.has(slug)) continue;
      seen.add(slug);
      const body = linkMatch[2];
      const imgAltMatch = body.match(/<img[^>]+alt="([^"]+)"/i);
      const titleMatch = body.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const excerptMatch = body.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      if (!titleMatch) continue;
      const title = stripTags(titleMatch[1]);
      if (!title) continue;
      articles.push({
        slug,
        title,
        excerpt: excerptMatch ? stripTags(excerptMatch[1]) : "",
        category: null,
        readingTime: null,
        imageAlt: imgAltMatch ? decodeEntities(imgAltMatch[1]) : null,
      });
    }
  }

  return articles;
}

/** Extract FAQ entries from the homepage or /articles page. */
export function parseFaqEntries(html: string): FaqEntry[] {
  const entries: FaqEntry[] = [];
  const re = /<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/details>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const question = stripTags(match[1]);
    const answer = stripTags(match[2]);
    if (question && answer) entries.push({ question, answer });
  }
  return entries;
}

/** Extract article body from a single article page. */
export function parseArticleDetail(html: string, slug: string): ArticleFull | null {
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (!articleMatch) return null;
  const body = articleMatch[1];

  const titleMatch = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!titleMatch) return null;
  const title = stripTags(titleMatch[1]);
  if (!title) return null;

  const categoryMatch = body.match(/<span[^>]*class="[^"]*cb-section-label[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const excerptMatch = body.match(/<p[^>]*class="[^"]*text-[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const readingTimeMatch = body.match(/Okuma süresi:\s*([^<]+)/i) || body.match(/Reading time:\s*([^<]+)/i);
  const imageAltMatch = body.match(/<img[^>]+alt="([^"]+)"/i);
  const imageSourceMatch = body.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);

  // Body paragraphs
  const paragraphs: string[] = [];
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRe.exec(body)) !== null) {
    const text = stripTags(pMatch[1]);
    if (text && text.length > 20) paragraphs.push(text);
  }
  // Cap to avoid huge tool responses
  const bodyMarkdown = paragraphs.slice(0, 50).join("\n\n");

  return {
    slug,
    title,
    excerpt: excerptMatch ? stripTags(excerptMatch[1]) : "",
    category: categoryMatch ? stripTags(categoryMatch[1]) : null,
    readingTime: null,
    imageAlt: imageAltMatch ? decodeEntities(imageAltMatch[1]) : null,
    imageSource: imageSourceMatch ? stripTags(imageSourceMatch[1]) : null,
    readingTimeFull: readingTimeMatch ? stripTags(readingTimeMatch[1]) : null,
    bodyMarkdown,
  };
}

/** Pull <html lang="…"> from any page. */
export function parsePageLanguage(html: string): string | null {
  const m = html.match(/<html[^>]+lang="([^"]+)"/i);
  return m ? m[1] : null;
}
