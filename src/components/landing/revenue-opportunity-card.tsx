import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";

const opportunities = [
  {
    title: "Increase average order value",
    reasoning:
      "Suggest a pairing the moment a guest orders a main, timed to when they're most likely to say yes.",
    impact: "+AED 3,800 / mo",
  },
  {
    title: "Reduce waiting times at peak hours",
    reasoning:
      "Shift one server to the 7–9pm window on Fridays, when tables are turning 30% slower than average.",
    impact: "+11 tables / wk",
  },
  {
    title: "Fix the dishes losing money",
    reasoning:
      "Reprice or retire the 4 menu items selling below cost once real ingredient prices are applied.",
    impact: "+AED 2,100 / mo",
  },
  {
    title: "Serve more covers with the same staff",
    reasoning:
      "Move QR ordering to the patio section, where servers currently spend the most time taking orders.",
    impact: "+18% covers",
  },
];

export function RevenueOpportunityCard() {
  return (
    <div className="surface-raised divide-y divide-border overflow-hidden rounded-2xl">
      {opportunities.map((item, index) => (
        <Reveal key={item.title} delay={index * 0.06}>
          <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex flex-col gap-1">
              <p className="text-base font-medium text-foreground">
                {item.title}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.reasoning}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
              <span className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground">
                {item.impact}
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
