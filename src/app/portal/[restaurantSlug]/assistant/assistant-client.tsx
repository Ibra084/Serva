"use client";

import { useState } from "react";
import {
  Bot,
  ClipboardList,
  Gauge,
  Lightbulb,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  User,
} from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { useRestaurantData } from "@/lib/use-restaurant-data";
import { setOpportunityStatus } from "@/lib/opportunity-store";
import type { AssistantAnswer } from "@/lib/types";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  answer?: AssistantAnswer;
}

const PROMPT_CARDS = [
  { label: "Why did revenue change?", icon: TrendingUp },
  { label: "What should I do before dinner service?", icon: ClipboardList },
  { label: "Which dish should I promote today?", icon: Sparkles },
  { label: "How do I increase average bill?", icon: Gauge },
  { label: "Which tables are underperforming?", icon: Target },
  { label: "What are customers complaining about?", icon: Lightbulb },
];

const NO_DATA_MESSAGE =
  "I can answer questions about revenue, menu performance, guests, reviews, and opportunities once your restaurant data is uploaded.";

function AnswerCards({
  answer,
  onCreateOpportunity,
  created,
}: {
  answer: AssistantAnswer;
  onCreateOpportunity: () => void;
  created: boolean;
}) {
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <div className="flex w-full max-w-[90%] flex-col gap-2.5">
      <div className="rounded-2xl rounded-tl-sm border border-primary/15 bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-relaxed text-foreground">{answer.answer}</p>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
            <Gauge className="size-3" />
            {answer.confidence}%
          </span>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl bg-secondary/60 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ClipboardList className="size-3.5" />
            Suggested action
          </div>
          <p className="mt-1 text-sm text-foreground">{answer.action}</p>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <TrendingUp className="size-3.5" />
            Expected impact
          </div>
          <p className="mt-1 text-sm text-foreground">{answer.impact}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowEvidence((v) => !v)}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {showEvidence ? "Hide source data" : "Source data"}
        </button>
        <button
          onClick={onCreateOpportunity}
          disabled={created}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {created ? "Added to opportunities" : "Create opportunity"}
        </button>
      </div>

      {showEvidence && (
        <div className="rounded-xl border border-dashed border-border p-3.5 text-xs leading-relaxed text-muted-foreground">
          {answer.evidence}
        </div>
      )}
    </div>
  );
}

export function AssistantClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { data } = useRestaurantData(restaurantSlug);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Ask me anything about your restaurant's performance — revenue, menu, guests, or reviews.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [createdOpportunities, setCreatedOpportunities] = useState<Set<number>>(new Set());

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || thinking) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");

    if (!data) {
      setMessages((prev) => [...prev, { role: "assistant", text: NO_DATA_MESSAGE }]);
      return;
    }

    setThinking(true);
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, data }),
      });
      const answer = (await res.json()) as AssistantAnswer;
      setMessages((prev) => [...prev, { role: "assistant", text: answer.answer, answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Something went wrong answering that — try again in a moment." },
      ]);
    } finally {
      setThinking(false);
    }
  }

  async function createOpportunity(messageIndex: number, answer: AssistantAnswer) {
    await setOpportunityStatus(restaurantSlug, `assistant-${messageIndex}-${Date.now()}`, "saved");
    setCreatedOpportunities((prev) => new Set(prev).add(messageIndex));
    void answer;
  }

  return (
    <>
      <PortalTopbar restaurantSlug={restaurantSlug} />
      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
        <div className="mx-auto flex h-full max-w-2xl flex-col">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">AI Assistant</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your restaurant command center — ask, and act.</p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {PROMPT_CARDS.map((prompt) => (
              <button
                key={prompt.label}
                onClick={() => ask(prompt.label)}
                disabled={thinking}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <prompt.icon className="size-3.5" />
                </span>
                {prompt.label}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-1 flex-col gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
              {messages.map((message, index) => (
                <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className="flex w-full items-start gap-2">
                    {message.role === "assistant" && (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Bot className="size-4" />
                      </span>
                    )}
                    {message.answer ? (
                      <AnswerCards
                        answer={message.answer}
                        onCreateOpportunity={() => createOpportunity(index, message.answer!)}
                        created={createdOpportunities.has(index)}
                      />
                    ) : (
                      <p
                        className={
                          message.role === "user"
                            ? "ml-auto rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                            : "rounded-2xl rounded-tl-sm bg-secondary/70 px-4 py-2.5 text-sm text-foreground"
                        }
                      >
                        {message.text}
                      </p>
                    )}
                    {message.role === "user" && (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                        <User className="size-4" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="flex max-w-[80%] items-start gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Bot className="size-4" />
                    </span>
                    <p className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-secondary/70 px-4 py-2.5 text-sm text-muted-foreground">
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                    </p>
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                ask(input);
              }}
              className="flex items-center gap-2 border-t border-border pt-4"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Sparkles className="size-4" />
              </span>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about revenue, menu, guests, or reviews..."
                disabled={thinking}
                className="flex-1 rounded-lg border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={thinking}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
