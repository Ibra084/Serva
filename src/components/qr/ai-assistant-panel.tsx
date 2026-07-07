"use client";

import { useEffect, useRef } from "react";
import { Bot, Plus, Send, Sparkles, User } from "lucide-react";
import type { MenuItem } from "@/lib/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  recommendedItems?: MenuItem[];
  interactionId?: string;
}

const SUGGESTED_QUESTIONS = [
  "I want something spicy",
  "I am vegetarian",
  "What is popular?",
  "What is the cheapest main?",
  "What is high protein?",
  "What is your signature dish?",
  "I have a nut allergy",
  "Recommend something under AED 100",
  "What should I order with steak?",
];

export function AiAssistantPanel({
  messages,
  input,
  onInputChange,
  onSend,
  onAddToBasket,
}: {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: (question: string) => void;
  onAddToBasket: (item: MenuItem, interactionId?: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="flex flex-1 flex-col px-4 py-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Sparkles className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Menu Assistant</p>
          <p className="text-xs text-muted-foreground">Ask about spice, diet, budget, or pairings</p>
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto">
        {messages.map((message) => (
          <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className="flex max-w-[86%] items-start gap-2">
              {message.role === "assistant" && (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Bot className="size-3.5" />
                </span>
              )}
              <div className="flex flex-col gap-2">
                <p
                  className={
                    message.role === "user"
                      ? "rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                      : "rounded-2xl rounded-tl-sm bg-secondary/70 px-3.5 py-2 text-sm text-foreground"
                  }
                >
                  {message.text}
                </p>
                {message.recommendedItems && message.recommendedItems.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {message.recommendedItems.map((item) => (
                      <div
                        key={item.dish}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{item.dish}</p>
                          <p className="text-xs text-muted-foreground">AED {item.price}</p>
                        </div>
                        <button
                          onClick={() => onAddToBasket(item, message.interactionId)}
                          className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
                        >
                          <Plus className="size-3" />
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <User className="size-3.5" />
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTED_QUESTIONS.map((question) => (
          <button
            key={question}
            onClick={() => onSend(question)}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[0.7rem] font-medium text-foreground transition-colors hover:bg-secondary"
          >
            {question}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend(input);
        }}
        className="mt-3 flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5"
      >
        <input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Ask about the menu..."
          className="flex-1 bg-transparent px-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Send className="size-3.5" />
        </button>
      </form>
    </div>
  );
}
