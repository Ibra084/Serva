"use client";

import { motion } from "framer-motion";
import { MessageCircle, Search, Signal, UtensilsCrossed, Wifi } from "lucide-react";

const dishes = [
  { name: "Steak Frites", price: "AED 92", tag: "Chef's pick" },
  { name: "Truffle Risotto", price: "AED 78", tag: "Popular" },
  { name: "Burrata & Fig", price: "AED 54", tag: "Recommended" },
];

export function PhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto w-full max-w-[260px]"
    >
      <div className="rounded-[2.75rem] bg-[#211f1a] p-[10px] shadow-[0_1px_2px_rgba(33,31,26,0.06),0_32px_56px_-24px_rgba(33,31,26,0.35)]">
        <div className="relative flex flex-col overflow-hidden rounded-[2.15rem] bg-card">
          <div className="flex items-center justify-between px-6 pt-3 text-[11px] font-medium text-foreground">
            <span>9:41</span>
            <div
              aria-hidden
              className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-[#1e1e1a]"
            />
            <span className="flex items-center gap-1">
              <Signal className="size-3" />
              <Wifi className="size-3" />
            </span>
          </div>

          <div className="flex flex-col px-4 pb-4 pt-4">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2">
              <Search className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Search menu</span>
            </div>

            <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-accent px-3 py-2">
              <MessageCircle className="size-3.5 shrink-0 text-accent-foreground" />
              <span className="text-xs text-accent-foreground">
                &ldquo;What pairs with red wine?&rdquo;
              </span>
            </div>

            <p className="mt-4 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Recommended
            </p>

            <div className="mt-2 flex flex-col gap-2">
              {dishes.map((dish) => (
                <div
                  key={dish.name}
                  className="flex items-center justify-between rounded-2xl glass-tile px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                      <UtensilsCrossed className="size-3" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {dish.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {dish.tag}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {dish.price}
                  </span>
                </div>
              ))}
            </div>

            <button className="mt-4 w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground">
              Order Now
            </button>
          </div>

          <div
            aria-hidden
            className="mx-auto mb-2 mt-3 h-1 w-24 rounded-full bg-foreground/20"
          />
        </div>
      </div>
    </motion.div>
  );
}
