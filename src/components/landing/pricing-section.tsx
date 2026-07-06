import { ArrowRight, Check } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Reveal } from "@/components/shared/reveal";
import { CountUp } from "@/components/shared/count-up";
import { Button } from "@/components/ui/button";

const stats = [
  { value: 12, suffix: "%", label: "Average revenue lift within 90 days" },
  { value: 3.5, suffix: " hrs", decimals: 1, label: "Saved every week on reporting" },
  { value: 2, suffix: "x", label: "Faster decisions than monthly reviews" },
];

const included = [
  "Daily morning brief for every location",
  "Menu, margin, and table performance tracking",
  "Guest-facing QR ordering",
  "Unlimited staff seats",
];

export function PricingSection() {
  return (
    <section id="pricing" className="relative scroll-mt-24 py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow="Pricing"
          eyebrowClassName="font-bold"
          title="Built around your numbers, not a seat count."
          description="We're onboarding restaurants individually right now, so pricing is set up around your menu, your volume, and your locations rather than a fixed tier."
        />

        <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 0.08}>
              <div className="surface flex flex-col gap-1 rounded-2xl p-6 text-center sm:text-left">
                <p className="font-serif text-4xl font-medium tracking-tight text-foreground">
                  <CountUp
                    value={stat.value}
                    suffix={stat.suffix}
                    decimals={stat.decimals ?? 0}
                  />
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="w-full max-w-xl">
          <div className="surface-raised flex flex-col items-center gap-6 rounded-3xl p-10 text-center">
            <p className="font-serif text-2xl font-medium tracking-tight text-foreground">
              One plan. Everything included.
            </p>
            <ul className="flex flex-col gap-3 text-left">
              {included.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-sm leading-relaxed text-muted-foreground"
                >
                  <Check className="size-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <Button size="lg" className="group h-11 w-full rounded-lg sm:w-auto sm:px-8">
              Request a demo
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
