"use client";

import { motion } from "framer-motion";
import { Sparkles, UtensilsCrossed, ReceiptText, ShoppingBag } from "lucide-react";
import { GuestStrip } from "@/components/qr/guest-strip";
import type { TableParticipant } from "@/lib/types";

const CHOICES = [
  { key: "browse", label: "See Menu", icon: UtensilsCrossed },
  { key: "choose", label: "Ask AI", icon: Sparkles },
  { key: "bill", label: "View Bill", icon: ReceiptText },
  { key: "startOrder", label: "Start Order", icon: ShoppingBag },
] as const;

export type WelcomeChoice = (typeof CHOICES)[number]["key"];

export function WelcomeScreen({
  restaurantName,
  tableId,
  hasActiveSession,
  participants = [],
  selfParticipantId = null,
  onRename,
  onChoose,
}: {
  restaurantName: string;
  tableId: string | null;
  hasActiveSession: boolean;
  participants?: TableParticipant[];
  selfParticipantId?: string | null;
  onRename?: (name: string) => void;
  onChoose: (choice: WelcomeChoice) => void;
}) {
  // Exactly three primary actions: menu + AI are always present, the third depends on whether a bill exists yet.
  const choices = CHOICES.filter((choice) =>
    hasActiveSession ? choice.key !== "startOrder" : choice.key !== "bill"
  );

  return (
    <div className="hero-wash flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
      <motion.span
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground"
      >
        <UtensilsCrossed className="size-7" />
      </motion.span>
      <motion.h1
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
        className="mt-5 font-serif text-2xl font-medium tracking-tight text-foreground"
      >
        Welcome to {restaurantName}
      </motion.h1>
      {tableId && (
        <span className="mt-2 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          Table {tableId}
        </span>
      )}
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
        Good to have you. What can we help you with today?
      </p>

      {participants.length > 0 && onRename && (
        <div className="mt-4 w-full max-w-sm">
          <GuestStrip participants={participants} selfParticipantId={selfParticipantId} onRename={onRename} />
        </div>
      )}

      <div className="mt-7 grid w-full max-w-sm grid-cols-3 gap-3">
        {choices.map((choice, index) => (
          <motion.button
            key={choice.key}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 + index * 0.05, ease: "easeOut" }}
            onClick={() => onChoose(choice.key)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-5 text-center shadow-sm transition-colors hover:bg-secondary/60 active:scale-[0.97]"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <choice.icon className="size-4" />
            </span>
            <span className="text-sm font-medium text-foreground">{choice.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
