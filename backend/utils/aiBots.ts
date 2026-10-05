/**
 * Canonical list of AI search / answer-engine crawlers we monitor.
 *
 * Detection is user-agent based (the industry standard for crawler analytics).
 * These are the AI-specific crawlers behind ChatGPT, Perplexity, Claude,
 * Apple Intelligence, Common Crawl (feeds many LLMs), etc. General search
 * crawlers (Googlebot / Bingbot) are intentionally EXCLUDED here — they are
 * already covered by Google/Bing Search Console and would dwarf the AI signal.
 *
 * Keep this list in sync with the inline copy in /app/middleware.ts (the Edge
 * middleware cannot import backend code).
 */
export const AI_BOT_PATTERNS: Array<[string, RegExp]> = [
  ["GPTBot", /GPTBot/i],
  ["OAI-SearchBot", /OAI-SearchBot/i],
  ["ChatGPT-User", /ChatGPT-User/i],
  ["PerplexityBot", /PerplexityBot/i],
  ["Perplexity-User", /Perplexity-User/i],
  ["ClaudeBot", /ClaudeBot/i],
  ["Claude-Web", /Claude-Web/i],
  ["anthropic-ai", /anthropic-ai/i],
  ["CCBot", /CCBot/i],
  ["Bytespider", /Bytespider/i],
  ["Applebot", /Applebot/i],
  ["Amazonbot", /Amazonbot/i],
  ["Meta-ExternalAgent", /Meta-ExternalAgent/i],
];

export const AI_BOT_NAMES = new Set(AI_BOT_PATTERNS.map(([name]) => name));

/** Returns the canonical bot name for a user-agent, or null if it isn't a tracked AI crawler. */
export function detectAiBot(ua: string | null | undefined): string | null {
  if (!ua) return null;
  for (const [name, re] of AI_BOT_PATTERNS) {
    if (re.test(ua)) return name;
  }
  return null;
}
