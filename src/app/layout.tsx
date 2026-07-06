import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import { MotionConfig } from "framer-motion";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geist = Geist({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Serva — Software for Restaurant Owners",
  description:
    "Serva turns your POS data into a plain-language morning brief, so you know why revenue changed, which dishes are costing you money, and what to do about it today.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geist.variable} h-full antialiased`}
    >
      <body className="relative min-h-full bg-[#1a1815] p-1.5 text-foreground sm:p-3">
        <div className="canvas-grid relative isolate flex min-h-[calc(100vh-0.75rem)] flex-col overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-background shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_30px_60px_-28px_rgba(0,0,0,0.45)] sm:min-h-[calc(100vh-1.5rem)] sm:rounded-[2.25rem]">
          <MotionConfig reducedMotion="user">{children}</MotionConfig>
        </div>
      </body>
    </html>
  );
}
