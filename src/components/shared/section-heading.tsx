import { cn } from "@/lib/utils";
import { Reveal } from "@/components/shared/reveal";

export function SectionHeading({
  eyebrow,
  eyebrowClassName,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow?: string;
  eyebrowClassName?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow && (
        <Reveal>
          <span
            className={cn(
              "text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground",
              eyebrowClassName,
            )}
          >
            {eyebrow}
          </span>
        </Reveal>
      )}
      <Reveal delay={0.06}>
        <h2
          className={cn(
            "font-serif text-balance text-3xl font-medium tracking-tight sm:text-4xl lg:text-[2.75rem]",
            align === "center" ? "mx-auto max-w-3xl" : "max-w-2xl",
          )}
        >
          {title}
        </h2>
      </Reveal>
      {description && (
        <Reveal delay={0.12}>
          <p
            className={cn(
              "text-balance text-base leading-relaxed text-muted-foreground sm:text-lg",
              align === "center" ? "mx-auto max-w-2xl" : "max-w-xl",
            )}
          >
            {description}
          </p>
        </Reveal>
      )}
    </div>
  );
}
