"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { HeroProductPreview } from "@/components/landing/hero-product-preview";

export function Hero() {
  return (
    <section
      id="top"
      className="hero-wash relative flex flex-col justify-center pt-28 pb-0 sm:pt-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <motion.span
          className="hero-glow size-72 bg-primary/25 sm:size-96"
          style={{ top: "-6rem", left: "8%" }}
          animate={{
            x: [0, 30, -10, 0],
            y: [0, 20, -10, 0],
            scale: [1, 1.08, 0.96, 1],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className="hero-glow size-64 bg-highlight/40 sm:size-80"
          style={{ top: "-2rem", right: "10%" }}
          animate={{
            x: [0, -24, 16, 0],
            y: [0, 16, -18, 0],
            scale: [1, 0.94, 1.06, 1],
          }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.span
          className="hero-glow size-56 bg-clay/20 sm:size-72"
          style={{ top: "6rem", left: "42%" }}
          animate={{
            x: [0, 18, -22, 0],
            y: [0, -14, 12, 0],
            scale: [1, 1.05, 0.95, 1],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>

      <Container className="relative z-10 flex flex-col items-center text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl text-balance font-serif text-4xl font-medium tracking-tight sm:text-5xl lg:text-[3.4rem]"
        >
          Know{" "}
          <span className="bg-gradient-to-r from-primary via-clay to-primary bg-[length:200%_auto] bg-clip-text text-transparent motion-safe:animate-[shimmer_6s_linear_infinite]">
            why
          </span>{" "}
          revenue changed yesterday.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          Serva turns your POS data into a plain-language morning brief,
          showing which dishes are costing you money, where revenue moved,
          and what to do before service starts.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button size="lg" className="h-11 rounded-lg px-6 text-[0.95rem]">
            Request a demo
            <ArrowRight className="size-4 transition-transform duration-300 group-hover/button:translate-x-1" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 rounded-lg px-6 text-[0.95rem]"
          >
            See how it works
          </Button>
        </motion.div>

        <HeroProductPreview />
      </Container>
    </section>
  );
}
