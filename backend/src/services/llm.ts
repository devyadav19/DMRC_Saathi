/**
 * Optional LLM upgrade path.
 *
 * The rule-based chatEngine (src/lib/chatEngine.ts) is the source of TRUTH
 * for all DMRC facts (routes, fares, timings, gates) - it's fast, free,
 * deterministic, and fully grounded in the real GTFS/station data bundled
 * with this app. It does not, however, handle open-ended conversation or
 * paraphrased small talk gracefully.
 *
 * If you want more natural phrasing or better handling of free-form
 * questions, set ANTHROPIC_API_KEY in your .env and this function will be
 * used to *rephrase* the rule-based answer (passed in as groundedFacts) -
 * never to invent new facts. This keeps the bot accurate while sounding
 * more conversational.
 */
export async function rephraseWithLLM(
  userText: string,
  groundedFacts: string
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system:
          "You are a Delhi Metro (DMRC) assistant. Rephrase the GROUNDED FACTS " +
          "below into a natural, concise reply to the user's message. Do NOT add " +
          "any fact, number, station name, or timing that isn't already present " +
          "in GROUNDED FACTS. If GROUNDED FACTS seems insufficient to answer, say " +
          "so plainly rather than guessing.",
        messages: [
          {
            role: "user",
            content: `User message: ${userText}\n\nGROUNDED FACTS:\n${groundedFacts}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      console.error("[llm] Anthropic API error:", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    const text = data?.content?.find((c: any) => c.type === "text")?.text;
    return text ?? null;
  } catch (e) {
    console.error("[llm] request failed:", (e as Error).message);
    return null;
  }
}
