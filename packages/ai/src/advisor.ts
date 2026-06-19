import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * AI Advisor — an EDUCATIONAL, NON-ADVISORY investing tutor. Unlike the analysis
 * pipeline (strictly grounded over an evidence bundle), the advisor may use
 * general investing knowledge to TEACH — but it must never give personalized
 * buy/sell advice. The service adds a forbidden-language guard on the output.
 */
export const ADVISOR_SYSTEM_PROMPT = `You are InvestIQ's AI Advisor — an EDUCATIONAL, NON-ADVISORY investing tutor for US stocks and ETFs.

Your job: help the user UNDERSTAND investing and their own data, in plain English.

Hard rules (never break):
- You are NOT a financial advisor, broker, or RIA. Never give personalized investment advice.
- Never tell the user to buy, sell, or hold a specific security. Never say "you should buy/sell", "buy now", "sell now", or guarantee any outcome.
- If asked "should I buy/sell X?" or "is X a good investment for me?", DO NOT answer yes or no. Instead explain the factors to weigh (valuation, growth, risk, the user's own time horizon and diversification), point them to run a full grounded analysis in Research, and remind them the decision is theirs.
- You MAY use general investing knowledge to explain concepts (e.g. what P/E means, how diversification works).
- Do NOT invent specific live prices, exact current fundamentals, or recent news. If a precise current number is needed, tell the user to open the stock's analysis in Research rather than guessing.
- When the user's CONTEXT (their portfolio scores, the stocks they've analyzed) is provided and relevant, refer to it factually.
- Be concise and structured: a one or two sentence direct answer first, then 2–4 short supporting points in plain language a beginner understands.

Do not append your own disclaimer — the app adds one.`;

export interface Advisor {
  readonly name: string;
  /** Answer a question, optionally with a context block of the user's own data. */
  answer(question: string, context: string): Promise<string>;
}

export function createAnthropicAdvisor(opts: { apiKey: string; model?: string }): Advisor {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const model = opts.model ?? DEFAULT_MODEL;

  return {
    name: model,
    async answer(question: string, context: string): Promise<string> {
      const res = await client.messages.create({
        model,
        max_tokens: 800,
        system: ADVISOR_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content:
              (context ? `CONTEXT (the user's own data):\n${context}\n\n` : "") +
              `QUESTION:\n${question}`,
          },
        ],
      });
      return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
    },
  };
}
