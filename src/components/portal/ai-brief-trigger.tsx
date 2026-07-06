"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Sparkles, X, IceCream2, TrendingUp, Clock } from "lucide-react";

const recommendations = [
  {
    title: "Offer dessert within 3 minutes of clearing mains",
    detail: "37 guests skipped dessert last night after their main course.",
    metric: "+AED 3,800 / mo",
    icon: IceCream2,
  },
  {
    title: "Raise Truffle Pasta by AED 2",
    detail: "Current margin comfortably supports the increase.",
    metric: "92% confidence",
    icon: TrendingUp,
  },
  {
    title: "Add a server to the Friday dinner rush",
    detail: "Dinner traffic is starting 18 minutes earlier on Fridays.",
    metric: "+1 server, 6–9pm",
    icon: Clock,
  },
];

export function AIBriefTrigger({
  className,
  children,
  restaurantName,
}: {
  className?: string;
  children: React.ReactNode;
  restaurantName: string;
}) {
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
                  {restaurantName} · Tuesday, 7:02 AM
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

          <div className="flex flex-col divide-y divide-border overflow-y-auto">
            {recommendations.map((item) => (
              <div key={item.title} className="flex gap-3 px-6 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <item.icon className="size-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
                  <span className="mt-2 inline-block rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
                    {item.metric}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border bg-secondary/50 px-6 py-4">
            <p className="text-xs text-muted-foreground">Predicted monthly gain</p>
            <p className="font-serif text-lg font-medium text-primary">+AED 3,800</p>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
