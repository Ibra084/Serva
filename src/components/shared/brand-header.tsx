import Image from "next/image";
import Link from "next/link";

export function BrandHeader() {
  return (
    <header className="flex items-center justify-center px-4 pt-8 sm:pt-10">
      <Link
        href="/"
        className="flex items-center gap-2 transition-transform duration-300 hover:scale-[1.03]"
      >
        <Image
          src="/serva_logo.png"
          alt="Serva"
          width={176}
          height={44}
          priority
          className="h-10 w-auto object-contain"
        />
      </Link>
    </header>
  );
}
