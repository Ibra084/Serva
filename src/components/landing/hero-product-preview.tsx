"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Lightbulb, Star } from "lucide-react";
import { AppFrame } from "@/components/shared/app-frame";
import { RevenueChart } from "@/components/landing/revenue-chart";
import { MiniSparkline } from "@/components/shared/mini-sparkline";
import { CountUp } from "@/components/shared/count-up";

const guestsTrend = [12, 18, 15, 22, 19, 26, 24, 30];

export function HeroProductPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-10 mx-auto mt-10 w-full max-w-4xl -mb-16 sm:-mb-20"
    >
      <AppFrame title="Serva — Today">
        <div className="flex items-center justify-between px-1 pb-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Good morning, Marco&rsquo;s Kitchen
            </p>
            <p className="text-xs text-muted-foreground">Tuesday, 7:02 AM</p>
          </div>
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
            On track
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl glass-tile p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Today&rsquo;s revenue
              </p>
              <span className="flex items-center gap-0.5 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                <ArrowUpRight className="size-3" />
                12%
              </span>
            </div>
            <p className="mt-2 font-serif text-3xl font-medium tracking-tight text-foreground">
              <CountUp value={18240} prefix="AED " decimals={0} delay={0.7} />
            </p>
            <div className="mt-4 h-24 w-full">
              <RevenueChart />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-1 flex-col justify-center rounded-2xl glass-tile p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Guests today</p>
                <span className="text-primary">
                  <MiniSparkline data={guestsTrend} className="h-4 w-10" />
                </span>
              </div>
              <p className="mt-1 text-base font-medium text-foreground">184</p>
            </div>

            <div className="flex flex-1 flex-col justify-center rounded-2xl glass-tile p-4">
              <p className="text-xs text-muted-foreground">Active tables</p>
              <p className="mt-1 text-base font-medium text-foreground">14 / 18</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div className="h-full w-[78%] rounded-full bg-primary" />
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-center gap-1 rounded-2xl glass-tile p-4">
              <p className="text-xs text-muted-foreground">Best selling dish</p>
              <div className="flex items-center gap-1.5">
                <Star className="size-3.5 fill-highlight text-highlight" />
                <p className="text-base font-medium text-foreground">
                  Steak Frites
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-clay/20 bg-clay/[0.06] p-4 backdrop-blur-md sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-clay/10 text-clay">
                <Lightbulb className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Opportunity &mdash; 37 guests skipped dessert last night
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Offer dessert within 3 minutes of clearing mains.
                </p>
              </div>
            </div>
            <div className="shrink-0 pl-12 sm:pl-0 sm:text-right">
              <p className="text-xs text-muted-foreground">Predicted monthly gain</p>
              <p className="font-serif text-lg font-medium text-primary">
                +AED 3,800
              </p>
            </div>
          </div>
        </div>
      </AppFrame>
    </motion.div>
  );
}
