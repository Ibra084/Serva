import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Reveal } from "@/components/shared/reveal";
import { DailyBriefCard } from "@/components/landing/daily-brief-card";

const capabilities = [
  {
    title: "A morning brief, not a dashboard",
    description:
      "Every day starts with a plain-language summary of what happened and why, so nobody has to interpret a chart before opening the doors.",
  },
  {
    title: "Menu items ranked by what they actually earn",
    description:
      "Serva tracks margin, velocity, and pairing behavior for every dish, so you know exactly which items to fix, feature, or drop.",
  },
  {
    title: "A direct answer, whenever you need one",
    description:
      "Ask about last week's slow Tuesdays or your top server's sales and get a specific, data-backed answer in seconds.",
  },
];

const stats = [
  {
    value: "6 hrs",
    description:
      "spent most weeks pulling numbers from three different systems just to answer “how did we do?”",
  },
  {
    value: "1 in 5",
    description:
      "menu items sell at a loss once real ingredient cost is accounted for — and most owners can’t say which.",
  },
];

export function PlatformSection() {
  return (
    <section id="product" className="relative scroll-mt-24 py-20 sm:py-28">
      <Container className="flex flex-col gap-16">
        <SectionHeading
          eyebrow="Platform"
          eyebrowClassName="font-bold"
          title="It explains what happened, and what to do next."
          description="Your POS can tell you what sold last night. It can't tell you why revenue dropped, which dishes are quietly losing money, or what to change before tomorrow's service. Serva turns that raw data into a plain-language answer."
        />

        <div className="grid gap-14 lg:grid-cols-[0.9fr_1fr] lg:items-center lg:gap-16">
          <div className="flex flex-col gap-8">
            {capabilities.map((item, index) => (
              <Reveal key={item.title} delay={0.1 + index * 0.06}>
                <div className="flex gap-5">
                  <span className="font-serif text-lg text-muted-foreground/50">
                    0{index + 1}
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-base font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <DailyBriefCard />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {stats.map((stat, index) => (
            <Reveal key={stat.value} delay={0.1 + index * 0.06}>
              <div className="surface flex h-full flex-col gap-2 rounded-2xl p-8">
                <p className="font-serif text-5xl font-medium tracking-tight text-foreground">
                  {stat.value}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {stat.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
