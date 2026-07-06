import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BrandHeader } from "@/components/shared/brand-header";

export default function ThankYouPage() {
  return (
    <div className="hero-wash flex min-h-full flex-1 flex-col">
      <BrandHeader />

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="surface-raised flex w-full max-w-md flex-col items-center gap-5 rounded-3xl px-8 py-12 text-center sm:px-10">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
            <CheckCircle2 className="size-7" />
          </span>

          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Thanks for requesting a demo.
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              We&rsquo;ll contact you soon.
            </p>
          </div>

          <Link
            href="/"
            className={buttonVariants({
              size: "lg",
              className: "mt-2 h-11 rounded-lg px-6 text-[0.95rem]",
            })}
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
