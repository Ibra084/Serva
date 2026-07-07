import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export const AI_MODEL = "gpt-4o-mini";
