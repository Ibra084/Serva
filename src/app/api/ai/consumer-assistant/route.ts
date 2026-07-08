import { NextRequest, NextResponse } from "next/server";
import { getOpenAI, AI_MODEL } from "@/lib/openai";
import { buildConsumerMenuContext, buildWaiterReply, detectConsumerIntent, recommendForGuest } from "@/lib/consumer-ai";
import { DEFAULT_GUEST_PREFERENCES, type GuestPreferences } from "@/lib/menu-types";
import type { MenuItem, Order } from "@/lib/types";

export async function POST(request: NextRequest) {
  const { question, menu, orders, guestPreferences, restaurantName } = (await request.json()) as {
    question: string;
    menu: MenuItem[];
    orders?: Order[];
    guestPreferences?: GuestPreferences;
    restaurantName?: string;
  };

  const prefs = { ...DEFAULT_GUEST_PREFERENCES, ...guestPreferences };
  const intent = detectConsumerIntent(question);
  const recommended = recommendForGuest(menu, intent, question, prefs, orders ?? []);
  const fallback = buildWaiterReply(intent, recommended, prefs);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ answer: fallback });
  }

  const context = {
    restaurantName: restaurantName ?? "the restaurant",
    menu: buildConsumerMenuContext(menu),
    guestPreferences: prefs,
    recommendedItems: recommended.map((item) => item.dish),
  };

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a friendly, helpful waiter talking directly to a guest at a restaurant. " +
            "Speak warmly and concisely — 2 to 3 sentences, plain text, no markdown. " +
            "Only recommend dishes that appear in the JSON menu provided below — never invent dishes or prices. " +
            "Personalize your answer using the guest's stated preferences (dietary, allergies, spice, budget, mood) when relevant. " +
            "Never mention revenue, margins, cost, profit, sales performance, or any business/restaurant-analytics language — " +
            "you are speaking to a customer, not a restaurant owner.\n\n" +
            `Context: ${JSON.stringify(context)}`,
        },
        { role: "user", content: question },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim();
    return NextResponse.json({ answer: answer || fallback, recommendedItems: recommended.map((item) => item.dish) });
  } catch {
    return NextResponse.json({ answer: fallback, recommendedItems: recommended.map((item) => item.dish) });
  }
}
