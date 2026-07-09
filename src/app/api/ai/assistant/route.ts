import { NextRequest, NextResponse } from "next/server";
import { getOpenAI, AI_MODEL } from "@/lib/openai";
import {
  answerBusinessQuestion,
  calculateDashboardMetrics,
  calculateGuestInsights,
  calculateMenuPerformance,
  generateOpportunities,
  summarizeReviews,
} from "@/lib/insights";
import type { AssistantAnswer, RestaurantData } from "@/lib/types";

function buildFallback(question: string, data: RestaurantData): AssistantAnswer {
  const metrics = calculateDashboardMetrics(data);
  const opportunities = generateOpportunities(data);
  const topOpportunity = opportunities[0];

  return {
    answer: answerBusinessQuestion(question, data),
    evidence: `Today's revenue is AED ${Math.round(metrics.todayRevenue).toLocaleString()} (${
      metrics.revenueChangePct !== null ? `${metrics.revenueChangePct >= 0 ? "+" : ""}${metrics.revenueChangePct}% vs prior day` : "no prior-day comparison"
    }), average bill AED ${Math.round(metrics.averageBill)}, best seller ${metrics.bestSellingDish ?? "—"}.`,
    action: topOpportunity?.title ?? "Keep monitoring performance — no urgent action detected right now.",
    impact: topOpportunity
      ? `Estimated +AED ${Math.round(topOpportunity.estimatedMonthlyGain).toLocaleString()}/month if acted on.`
      : "No estimated impact available yet.",
    confidence: topOpportunity?.confidence ?? 55,
  };
}

export async function POST(request: NextRequest) {
  const { question, data } = (await request.json()) as {
    question: string;
    data: RestaurantData;
  };

  const fallback = buildFallback(question, data);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(fallback);
  }

  const context = {
    metrics: calculateDashboardMetrics(data),
    opportunities: generateOpportunities(data),
    menuPerformance: calculateMenuPerformance(data),
    guestInsights: calculateGuestInsights(data),
    reviewSummary: summarizeReviews(data),
  };

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an AI assistant embedded in a restaurant command-center portal. " +
            "Answer the owner's question using only the JSON context provided below — never invent numbers. " +
            "Respond with a JSON object with exactly these keys: " +
            '"answer" (2-3 sentence direct answer, plain text, no markdown), ' +
            '"evidence" (1-2 sentences citing the specific numbers behind the answer), ' +
            '"action" (one concrete recommended next step), ' +
            '"impact" (one sentence estimating the expected effect, with a number if possible), ' +
            '"confidence" (integer 0-100, how confident you are given the data available). ' +
            "If the context doesn't cover the question, say what you can and note what data would help.\n\n" +
            `Context: ${JSON.stringify(context)}`,
        },
        { role: "user", content: question },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return NextResponse.json(fallback);

    const parsed = JSON.parse(raw) as Partial<AssistantAnswer>;
    return NextResponse.json({
      answer: parsed.answer || fallback.answer,
      evidence: parsed.evidence || fallback.evidence,
      action: parsed.action || fallback.action,
      impact: parsed.impact || fallback.impact,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : fallback.confidence,
    });
  } catch {
    return NextResponse.json(fallback);
  }
}
