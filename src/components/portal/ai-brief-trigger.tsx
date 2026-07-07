"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Sparkles, X, IceCream2, TrendingUp, Clock, Info } from "lucide-react";
import { useRestaurantData } from "@/lib/use-restaurant-data";
import { generateOpportunities } from "@/lib/insights";

const iconForIndex = [IceCream2, TrendingUp, Clock];

export function AIBriefTrigger({
  className,
  children,
  restaurantName,
  restaurantSlug,
}: {
  className?: string;
  children: React.ReactNode;
  restaurantName: string;
  restaurantSlug: string;
}) {
  const { data, hasData } = useRestaurantData(restaurantSlug);
  const opportunities = data ? generateOpportunities(data) : [];
  const totalGain = opportunities.reduce((sum, item) => sum + item.estimatedMonthlyGain, 0);

  return (
    <Dialog.Root>
      <Dialog.Trigger className={className}>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_48px_-24px_rgba(33,31,26,0.4)] transition-[scale,opacity] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Sparkles className="size-4" />
              </span>
              <div>
                <Dialog.Title className="font-serif text-lg font-medium tracking-tight text-foreground">
                  Today&rsquo;s AI Brief
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground">
                  {restaurantName}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {hasData && opportunities.length > 0 ? (
            <>
              <div className="flex flex-col divide-y divide-border overflow-y-auto">
                {opportunities.slice(0, 3).map((item, index) => {
                  const Icon = iconForIndex[index] ?? Sparkles;
                  return (
                    <div key={item.title} className="flex gap-3 px-6 py-4">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Icon className="size-4" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{item.explanation}</p>
                        <span className="mt-2 inline-block rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
                          {item.estimatedMonthlyGain > 0
                            ? `+AED ${item.estimatedMonthlyGain.toLocaleString()} / mo`
                            : `${item.confidence}% confidence`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-border bg-secondary/50 px-6 py-4">
                <p className="text-xs text-muted-foreground">Predicted monthly gain</p>
                <p className="font-serif text-lg font-medium text-primary">
                  +AED {totalGain.toLocaleString()}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Info className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Upload order, menu, and review data to generate your AI brief.
              </p>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
