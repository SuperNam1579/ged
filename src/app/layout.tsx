import type { Metadata } from "next";
import { Fredoka, Nunito_Sans } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const fredoka = Fredoka({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-feather",
  display: "swap",
});

const nunitoSans = Nunito_Sans({
  weight: ["400", "500", "700", "800"],
  subsets: ["latin"],
  variable: "--font-din-round",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GED Prep — Adaptive Study Platform",
  description:
    "AI-powered adaptive GED exam preparation with personalized study plans driven by Genetic Algorithm optimization.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full bg-background ${fredoka.variable} ${nunitoSans.variable}`}
    >
      <body className="min-h-full bg-background text-foreground font-[family-name:var(--font-din-round)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
