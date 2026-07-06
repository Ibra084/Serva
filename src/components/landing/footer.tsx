import { Container } from "@/components/shared/container";

const links = [
  { label: "Product", href: "#product" },
  { label: "How it pays off", href: "#impact" },
  { label: "Guest experience", href: "#experience" },
];

export function Footer() {
  return (
    <footer className="relative py-10">
      <Container className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
        <div className="flex flex-col gap-2">
          <span className="font-serif text-xl font-medium tracking-tight text-foreground">
            Serva
          </span>
          <p className="max-w-xs text-sm text-muted-foreground">
            Software for restaurant owners.
          </p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </Container>

      <Container className="mt-8">
        <div className="border-t border-border pt-5 text-center text-xs text-muted-foreground sm:text-left">
          © {new Date().getFullYear()} Serva. All rights reserved.
        </div>
      </Container>
    </footer>
  );
}
