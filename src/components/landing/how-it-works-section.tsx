import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Reveal } from "@/components/shared/reveal";
import { AppFrame } from "@/components/shared/app-frame";
import { RevenueChart } from "@/components/landing/revenue-chart";
import { MenuHealthScore } from "@/components/landing/menu-health-score";
import { PeakHourHeatmap } from "@/components/landing/peak-hour-heatmap";
import { TablePerformance } from "@/components/landing/table-performance";
import { RevenueOpportunityCard } from "@/components/landing/revenue-opportunity-card";
import { PhoneMockup } from "@/components/landing/phone-mockup";
import { CustomerJourneyTimeline } from "@/components/landing/customer-journey-timeline";

const testimonials = [
  {
    quote:
      "Serva flagged that our dessert attach rate was dropping before we noticed it ourselves. We fixed it within a week.",
    name: "Elena Cross",
    role: "Owner, Northside Kitchen",
  },
  {
    quote:
      "QR ordering paid for itself in the first month, just from faster table turns during dinner service.",
    name: "Priya Anand",
    role: "Operator, The Copper Fig",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative scroll-mt-24 py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-16">
        <SectionHeading
          eyebrow="How it Works"
          eyebrowClassName="font-bold"
          title="Everything you need to run service, in one screen."
          description="Sales, tables, menu, and timing all update from the same source of truth — then Serva turns that data into specific, prioritized recommendations."
        />

        <Reveal className="w-full">
          <AppFrame title="Serva — Overview" className="mx-auto max-w-4xl">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl glass-tile p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    Revenue &mdash; last 10 days
                  </p>
                  <span className="text-xs text-muted-foreground">AED</span>
                </div>
                <div className="mt-4 h-32 w-full">
                  <RevenueChart />
                </div>
              </div>
              <MenuHealthScore />
              <PeakHourHeatmap />
              <TablePerformance />
            </div>
          </AppFrame>
        </Reveal>

        <div className="w-full max-w-3xl">
          <RevenueOpportunityCard />
        </div>

        <div className="grid w-full items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="flex flex-col gap-5">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Guest experience
              </span>
              <h3 className="max-w-lg text-balance font-serif text-3xl font-medium tracking-tight sm:text-4xl">
                A faster way for guests to order, no app required.
              </h3>
              <p className="max-w-md text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                Guests scan a code, browse the full menu, ask questions about
                any dish, and order &mdash; straight to the kitchen, without
                downloading anything.
              </p>
            </div>
          </Reveal>

          <PhoneMockup />
        </div>

        <Reveal delay={0.1} className="w-full">
          <CustomerJourneyTimeline />
        </Reveal>

        <div className="grid w-full gap-6 sm:grid-cols-2">
          {testimonials.map((testimonial, index) => (
            <Reveal key={testimonial.name} delay={index * 0.08}>
              <figure className="surface flex h-full flex-col gap-4 rounded-2xl p-7">
                <blockquote className="text-lg leading-relaxed text-foreground">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <figcaption className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {testimonial.name}
                  </span>{" "}
                  &mdash; {testimonial.role}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
