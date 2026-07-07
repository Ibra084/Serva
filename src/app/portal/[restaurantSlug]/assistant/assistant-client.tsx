"use client";

import { useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { useRestaurantData } from "@/lib/use-restaurant-data";
import { answerBusinessQuestion } from "@/lib/insights";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTED_QUESTIONS = [
  "Why was revenue up or down?",
  "Which dish should I remove?",
  "How do I increase dessert sales?",
  "What is my busiest time?",
  "What should I do today?",
  "Which item should I promote?",
];

const NO_DATA_MESSAGE =
  "I can answer questions about revenue, menu performance, guests, reviews, and opportunities once your restaurant data is uploaded.";

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
      const json = await res.json();
      const answer = json.answer || answerBusinessQuestion(trimmed, data);
      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: answerBusinessQuestion(trimmed, data) },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <>
      <PortalTopbar restaurantSlug={restaurantSlug} />
      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
        <div className="mx-auto flex h-full max-w-2xl flex-col">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
            AI Assistant
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered answers grounded in your uploaded restaurant data.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                onClick={() => ask(question)}
                disabled={thinking}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-1 flex-col gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={
                    message.role === "user" ? "flex justify-end" : "flex justify-start"
                  }
                >
                  <div
                    className={
                      message.role === "user"
                        ? "flex max-w-[80%] items-start gap-2"
                        : "flex max-w-[80%] items-start gap-2"
                    }
                  >
                    {message.role === "assistant" && (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Bot className="size-4" />
                      </span>
                    )}
                    <p
                      className={
                        message.role === "user"
                          ? "rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                          : "rounded-2xl rounded-tl-sm bg-secondary/70 px-4 py-2.5 text-sm text-foreground"
                      }
                    >
                      {message.text}
                    </p>
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
