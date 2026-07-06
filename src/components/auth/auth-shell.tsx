import Image from "next/image";
import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="hero-wash relative flex min-h-full flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <div className="relative z-10 flex w-full max-w-[19rem] flex-col items-center text-center">
        <Link href="/" className="transition-transform duration-300 hover:scale-[1.03]">
          <Image
            src="/serva_logo.png"
            alt="Serva"
            width={176}
            height={44}
            priority
            className="h-16 w-auto object-contain"
          />
        </Link>

        <h1 className="mt-5 font-serif text-lg font-medium tracking-tight text-foreground sm:text-xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

        <div className="mt-6 flex w-full flex-col gap-3">{children}</div>

        {footer && <div className="mt-6 text-xs text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium tracking-wide text-muted-foreground">OR</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
