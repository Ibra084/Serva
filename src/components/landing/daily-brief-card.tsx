import { Reveal } from "@/components/shared/reveal";

export function DailyBriefCard() {
  return (
    <Reveal>
      <div className="surface-raised mx-auto w-full max-w-md overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-border bg-secondary/60 px-6 py-4">
          <p className="text-sm font-medium text-foreground">Morning Brief</p>
          <p className="text-xs text-muted-foreground">Today, 7:02 AM</p>
        </div>

        <div className="flex flex-col gap-4 px-6 py-6 text-[0.95rem] leading-relaxed text-muted-foreground">
          <p className="text-foreground">Good morning.</p>
          <p>
            Revenue was up{" "}
            <span className="font-medium text-primary">12%</span> yesterday.
            Steak Frites led sales at{" "}
            <span className="font-medium text-foreground">AED 3,240</span>,
            but 37 guests skipped dessert after their main course.
          </p>

          <div className="rounded-2xl glass-tile p-4">
            <p className="text-sm font-medium text-foreground">
              Today&rsquo;s recommendation
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Offer dessert within 3 minutes of clearing mains &mdash;
              estimated at AED 3,800 in additional revenue this month.
            </p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
