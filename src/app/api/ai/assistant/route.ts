import { NextRequest, NextResponse } from "next/server";
import { openai, AI_MODEL } from "@/lib/openai";
import {
  answerBusinessQuestion,
  calculateDashboardMetrics,
  calculateGuestInsights,
  calculateMenuPerformance,
  generateOpportunities,
  summarizeReviews,
} from "@/lib/insights";
import type { RestaurantData } from "@/lib/types";

export async function POST(request: NextRequest) {
  const { question, data } = (await request.json()) as {
    question: string;
    data: RestaurantData;
  };

  const fallback = answerBusinessQuestion(question, data);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ answer: fallback });
  }

  const context = {
    metrics: calculateDashboardMetrics(data),
    opportunities: generateOpportunities(data),
    menuPerformance: calculateMenuPerformance(data),
    guestInsights: calculateGuestInsights(data),
    reviewSummary: summarizeReviews(data),
  };

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an AI assistant embedded in a restaurant analytics portal. " +
            "Answer the owner's question using only the JSON context provided below — never invent numbers. " +
            "If the context doesn't cover the question, say what you can and note what data would help. " +
            "Keep answers to 2-4 sentences, plain text, no markdown.\n\n" +
            `Context: ${JSON.stringify(context)}`,
        },
        { role: "user", content: question },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim();
    return NextResponse.json({ answer: answer || fallback });
  } catch {
    return NextResponse.json({ answer: fallback });
  }
}
