import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const MODEL = "claude-opus-5-5";

const client = new Anthropic();

export class AIError extends Error {}

type Effort = "low" | "medium" | "high";

/**
 * One Claude call that must return JSON matching `schema`.
 * Uses the server-side refusal fallback so a rare policy decline is retried on the
 * default fallback model instead of failing outright.
 */
export async function structuredCall<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  effort: Effort;
}): Promise<z.infer<S>> {
  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
      output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AIError("The Claude API key is missing or invalid.");
    if (error instanceof Anthropic.RateLimitError) throw new AIError("Too many requests right now. Try again in a minute.");
    if (error instanceof Anthropic.APIError) throw new AIError(`Claude API error (${error.status}). Try again.`);
    throw error;
  }

  if (response.stop_reason === "refusal") throw new AIError("The AI declined to analyze this. Try another photo.");
  if (response.stop_reason === "max_tokens") throw new AIError("The AI response was cut off. Try again.");
  if (!response.parsed_output) throw new AIError("The AI returned an unexpected format. Try again.");
  return response.parsed_output;
}

/** Multi-turn conversation returning plain text (used by "Ask the Coach"). */
export async function chatCall(opts: {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  effort: Effort;
}): Promise<string> {
  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system,
      messages: opts.messages,
      output_config: { effort: opts.effort },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AIError("The Claude API key is missing or invalid.");
    if (error instanceof Anthropic.RateLimitError) throw new AIError("Too many requests right now. Try again in a minute.");
    if (error instanceof Anthropic.APIError) throw new AIError(`Claude API error (${error.status}). Try again.`);
    throw error;
  }
  if (response.stop_reason === "refusal") throw new AIError("The coach can't help with that one. Try asking differently.");
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!text) throw new AIError("The coach didn't return an answer. Try again.");
  return text;
}
