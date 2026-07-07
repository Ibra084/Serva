"use client";

import { Sparkles, UtensilsCrossed, ShieldAlert, MessageCircleQuestion } from "lucide-react";

const CHOICES = [
  { key: "recommend", label: "Recommend a meal", icon: Sparkles },
  { key: "browse", label: "Browse menu", icon: UtensilsCrossed },
  { key: "allergies", label: "I have allergies", icon: ShieldAlert },
  { key: "specific", label: "I want something specific", icon: MessageCircleQuestion },
] as const;

export type WelcomeChoice = (typeof CHOICES)[number]["key"];

export function WelcomeScreen({
  restaurantName,
  tableId,
  onChoose,
}: {
  restaurantName: string;
  tableId: string | null;
  onChoose: (choice: WelcomeChoice) => void;
}) {
  return (
    <div className="hero-wash flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <UtensilsCrossed className="size-7" />
      </span>
      <h1 className="mt-5 font-serif text-2xl font-medium tracking-tight text-foreground">
        Welcome to {restaurantName}
      </h1>
      {tableId && (
        <span className="mt-2 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          Table {tableId}
        </span>
      )}
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
        What can we help you find today?
      </p>

      <div className="mt-7 grid w-full max-w-sm grid-cols-2 gap-3">
        {CHOICES.map((choice) => (
          <button
            key={choice.key}
            onClick={() => onChoose(choice.key)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-5 text-center shadow-sm transition-colors hover:bg-secondary/60"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <choice.icon className="size-4" />
            </span>
            <span className="text-sm font-medium text-foreground">{choice.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
