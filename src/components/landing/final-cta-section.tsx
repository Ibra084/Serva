import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";

export function FinalCtaSection() {
  return (
    <section className="relative py-20 sm:py-28">
      <Container>
        <Reveal>
          <div className="glass-dark flex flex-col items-center gap-6 rounded-3xl px-6 py-16 text-center sm:px-12 sm:py-20">
            <h2 className="max-w-xl text-balance font-serif text-3xl font-medium tracking-tight text-white sm:text-4xl">
              Stop guessing why last night went the way it did.
            </h2>
            <p className="max-w-md text-balance text-base leading-relaxed text-white/60 sm:text-lg">
              See Serva running on your own menu and your own numbers.
            </p>
            <Button
              size="lg"
              className="h-11 rounded-lg bg-white px-6 text-[0.95rem] text-[#211f1a] hover:bg-white/90"
            >
              Request a demo
              <ArrowRight className="size-4 transition-transform duration-300 group-hover/button:translate-x-1" />
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
