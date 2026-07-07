import { NextRequest, NextResponse } from "next/server";
import { openai, AI_MODEL } from "@/lib/openai";
import {
  calculateDashboardMetrics,
  calculateGuestInsights,
  generateDailyBrief,
  generateOpportunities,
} from "@/lib/insights";
import type { RestaurantData } from "@/lib/types";

export async function POST(request: NextRequest) {
  const { data } = (await request.json()) as { data: RestaurantData };

  const metrics = calculateDashboardMetrics(data);
  const opportunities = generateOpportunities(data);
  const guestInsights = calculateGuestInsights(data);
  const fallback = generateDailyBrief(data);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ brief: fallback });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a restaurant operations analyst writing a short daily brief for an owner. " +
            "Use only the numbers provided as context — never invent figures. " +
            "Respond with strict JSON matching this shape: " +
            '{"greeting": string, "whatHappened": string, "whyRevenueChanged": string, "bestDish": string, ' +
            '"worstDish": string, "missedOpportunity": string, "recommendedAction": string, "estimatedMonthlyGain": number}. ' +
            "Keep each string to one or two plain sentences, warm but direct, no markdown.",
        },
        {
          role: "user",
          content: JSON.stringify({ metrics, opportunities, guestInsights }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty completion");

    const brief = JSON.parse(raw);
    return NextResponse.json({ brief });
  } catch {
    return NextResponse.json({ brief: fallback });
  }
}
