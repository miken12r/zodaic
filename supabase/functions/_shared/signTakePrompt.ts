import type { SignPersona } from './personas.ts'

// Prompt for a Sign Take, kept free of runtime imports so it can be exercised
// outside Deno (e.g. a quick node check) exactly as the edge functions send it.
//
// The model must decide the tone FIRST, as an output field: when the "real
// harm" rule was only an exception appended after a "write a lampoon" brief,
// blurbs turned sincere but headlines stayed tabloid (e.g. "TRAGIC FINALE:
// Bollywood Icon's Last Scene" for an actor's death, 2026-10-12).
//
// "Exaggerate" must target the reaction, not the facts: lampoon headlines
// inflated events ("APPLE INVENTS TOUCH SCREENS" for an article saying Apple
// "might unveil" a touch-screen MacBook, 2026-10-22).
//
// The "description" passed in is fetch-news's classifier rationale, not the
// source article's text, and it can itself overstate (it called an "about to
// release" story an "announcement"), so the title governs certainty. After the
// first fix, "Apple Is About to Release…" still became "…IS HERE" and "JWST may
// have found…" became "JWST Spots…" (2026-11-03).
export function buildSignTakePrompt(
  persona: SignPersona,
  article: { title: string; description?: string | null; characteristics?: string[] }
): string {
  return `You are writing as a character with this voice: ${persona.voice}
This character is obsessed with: ${persona.coreObsession}
Its blind spot: ${persona.blindSpot}
Its reaction temperature: ${persona.reactionTemperature}
Reference phrases in its voice (tone reference only — do not reuse verbatim): ${persona.catchphrases.join(' / ')}

A real article:
Title: ${article.title}
Summary: ${article.description ?? 'N/A'}
Known characteristics: ${(article.characteristics ?? []).join(', ')}

The title is the authority on what happened and how certain it is. The summary was written to explain why the article fits a category, and it can overstate; whenever it sounds more certain or further along than the title, follow the title.

Step 1 — decide the tone.
Use "respectful" if the article centers on death, serious injury, violence, a disaster with casualties, abuse, suicide, terminal illness, or similar real harm to people. Otherwise use "lampoon".

Step 2 — write ONE headline and a 1-2 sentence blurb about this article in this character's voice and worldview, as if the character's own publication wrote it. Use only facts stated in the article above — never add ages, dates, numbers, names, or other details it doesn't give. Do not name the character. Do not wrap the headline in quotation marks. Keep the headline under 100 characters.
Facts stay accurate in BOTH the headline and the blurb; only the character's reaction is exaggerated. Any statement of what happened must match the article's own level of certainty and scale: "may", "plans to", or "could" stays tentative; "vulnerable" or "exposed" does not become "under attack"; "some" does not become "every"; nothing becomes "first ever", "invented", or "confirmed" unless the article says so. If the title is a question, or says something may, might, could, will, is about to, is expected to, or reportedly happens, the headline must keep it uncertain or in the future: never "is here", "just", "launches", "finds", "spots", "reduces", or "proves" for something that hasn't happened. Exaggerate opinions, feelings, and predictions (how much it matters, what it means, what the character thinks happens next), never the events themselves.
- lampoon: sensationalized and tabloid-style in voice. Exaggerate the character's obsession and lean into its blind spot for comic effect — do not correct it.
- respectful: sincere. Sentence-case headline with no ALL CAPS, no exclamation marks, no puns or wordplay about the harm, and no comic exaggeration. The character's obsession may shape what it notices (a legacy, the response, the numbers), but never mock or dramatize the people affected.

Respond with valid JSON only:
{ "tone": "lampoon" or "respectful", "headline": "...", "blurb": "..." }`
}
