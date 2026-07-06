"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";

const links = [
  { label: "Platform", href: "#product" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

function scrollToHash(href: string) {
  const el = document.querySelector(href);
  if (el instanceof HTMLElement) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleNavClick(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    scrollToHash(href);
    setOpen(false);
  }

  return (
    <header className="fixed inset-x-1.5 top-1.5 z-50 flex flex-col items-center px-2 pt-2 sm:inset-x-3 sm:top-3 sm:px-4 sm:pt-4">
      <Container
        className={`flex items-center justify-between rounded-2xl border transition-all duration-500 ${
          scrolled
            ? "border-white/40 bg-background/55 px-4 py-2.5 shadow-[0_1px_1px_rgba(255,255,255,0.5)_inset,0_12px_36px_-10px_rgba(33,31,26,0.32)] backdrop-blur-2xl backdrop-saturate-150"
            : "border-transparent bg-transparent px-5 py-3.5 backdrop-blur-0"
        }`}
      >
        <a
          href="#top"
          onClick={(event) => handleNavClick(event, "#top")}
          className="flex items-center gap-2 transition-transform duration-300 hover:scale-[1.03]"
        >
          <Image
            src="/serva_logo.png"
            alt="Serva"
            width={176}
            height={44}
            priority
            className="h-11 w-auto object-contain"
          />
        </a>

        <nav className="hidden items-center gap-10 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(event) => handleNavClick(event, link.href)}
              className="group/link font-heading relative py-1.5 text-[0.925rem] font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
            >
              {link.label}
              <span className="absolute inset-x-0 -bottom-0.5 h-px origin-center scale-x-0 bg-primary transition-transform duration-300 ease-out group-hover/link:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Button className="group h-9 rounded-lg px-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-8px_rgba(31,107,66,0.55)]">
            Request a demo
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        </div>

        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center rounded-lg p-2 text-foreground lg:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </Container>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full lg:hidden"
        >
          <Container className="mt-2 flex flex-col gap-1 rounded-2xl border border-white/40 bg-background/70 p-4 shadow-[0_1px_1px_rgba(255,255,255,0.5)_inset,0_8px_30px_-12px_rgba(33,31,26,0.25)] backdrop-blur-xl backdrop-saturate-150">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(event) => handleNavClick(event, link.href)}
                className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <Button className="mt-2 w-full rounded-lg">Request a demo</Button>
          </Container>
        </motion.div>
      )}
    </header>
  );
}
