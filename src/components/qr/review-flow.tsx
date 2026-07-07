"use client";

import { useState } from "react";
import { Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ReviewInput {
  foodRating: number;
  serviceRating: number;
  atmosphereRating: number;
  overallRating: number;
  comment: string;
  aiRecommendationHelpful: boolean | null;
}

function StarPicker({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-foreground">{label}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} onClick={() => onChange(star)} aria-label={`${star} star`}>
            <Star
              className={cn(
                "size-6 transition-colors",
                star <= value ? "fill-primary text-primary" : "text-border"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReviewFlow({ onSubmit }: { onSubmit: (input: ReviewInput) => void }) {
  const [foodRating, setFoodRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [atmosphereRating, setAtmosphereRating] = useState(0);
  const [overallRating, setOverallRating] = useState(0);
  const [comment, setComment] = useState("");
  const [aiHelpful, setAiHelpful] = useState<boolean | null>(null);

  const canSubmit = foodRating > 0 && serviceRating > 0 && atmosphereRating > 0 && overallRating > 0;

  return (
    <div className="flex flex-1 flex-col px-5 py-8">
      <h2 className="font-serif text-xl font-medium tracking-tight text-foreground">How was everything?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your feedback helps the kitchen improve.</p>

      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <StarPicker label="Food" value={foodRating} onChange={setFoodRating} />
        <StarPicker label="Service" value={serviceRating} onChange={setServiceRating} />
        <StarPicker label="Atmosphere" value={atmosphereRating} onChange={setAtmosphereRating} />
        <StarPicker label="Overall" value={overallRating} onChange={setOverallRating} />
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Anything you&rsquo;d like to add?</label>
        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Tell us more..."
        />
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-foreground">Was the AI recommendation helpful?</p>
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={() => setAiHelpful(true)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              aiHelpful === true
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-foreground hover:bg-secondary"
            )}
          >
            <ThumbsUp className="size-3.5" />
            Yes
          </button>
          <button
            onClick={() => setAiHelpful(false)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              aiHelpful === false
                ? "border-transparent bg-destructive/10 text-destructive"
                : "border-border text-foreground hover:bg-secondary"
            )}
          >
            <ThumbsDown className="size-3.5" />
            No
          </button>
        </div>
      </div>

      <button
        disabled={!canSubmit}
        onClick={() =>
          onSubmit({ foodRating, serviceRating, atmosphereRating, overallRating, comment, aiRecommendationHelpful: aiHelpful })
        }
        className="mt-6 w-full rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50"
      >
        Submit Review
      </button>
    </div>
  );
}
