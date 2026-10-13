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
  metadataBase: new URL("https://www.ged-nn.com"),
  title: {
    default: "GED Prep — Adaptive Study Platform",
    template: "%s | GED Prep",
  },
  description:
    "AI-powered adaptive GED exam preparation with personalized study plans driven by Genetic Algorithm optimization.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
      title: "GED Prep — Adaptive Study Platform",
      description:
        "AI-powered adaptive GED exam preparation with personalized study plans driven by Genetic Algorithm optimization.",
      siteName: "GED Prep",
      images: [
        {
          url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSrxNElUnztpn_6a3Y0RuS_dnTmNGiLo8fHqsPCK57yJQ&s=10",
          width: 1024,
          height: 1024,
        },
      ],
      locale: "th_TH",
      type: "website",
    },
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
