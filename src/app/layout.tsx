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
  //metadataBase: new URL("https://www.ged-nn.com"),
  title: {
    default: "GED Prep — Adaptive Study Platform",
    template: "%s | GED Prep",
  },
  description:
    "AI-powered adaptive GED exam preparation with personalized study plans driven by Genetic Algorithm optimization.",
  alternates: {
    canonical: "/",
  },
  icons: {
      icon: "https://marketplace.canva.com/k5zKE/MAGrKHk5zKE/1/tl/canva-%E0%B8%A0%E0%B8%B2%E0%B8%9E%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%81%E0%B8%AD%E0%B8%9A%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B9%8C%E0%B8%95%E0%B8%B9%E0%B8%99%E0%B8%9C%E0%B8%B6%E0%B9%89%E0%B8%87%E0%B8%AA%E0%B8%B8%E0%B8%94%E0%B8%99%E0%B9%88%E0%B8%B2%E0%B8%A3%E0%B8%B1%E0%B8%81-MAGrKHk5zKE.jpg",
      shortcut: "https://marketplace.canva.com/k5zKE/MAGrKHk5zKE/1/tl/canva-%E0%B8%A0%E0%B8%B2%E0%B8%9E%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%81%E0%B8%AD%E0%B8%9A%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B9%8C%E0%B8%95%E0%B8%B9%E0%B8%99%E0%B8%9C%E0%B8%B6%E0%B9%89%E0%B8%87%E0%B8%AA%E0%B8%B8%E0%B8%94%E0%B8%99%E0xB9%88%E0xB8%B2%E0xB8%A3%E0xB8%B1%E0xB8%81-MAGrKHk5zKE.jpg",
      apple: "https://marketplace.canva.com/k5zKE/MAGrKHk5zKE/1/tl/canva-%E0%B8%A0%E0xB8%B2%E0xB8%9E%E0xB8%9B%E0xB8%A3%E0xB8%B0%E0xB8%81%E0xB8%AD%E0xB8%9A%E0xB8%81%E0xB8%B2%E0xB8%A3%E0%B9%8C%E0%B8%95%E0%B8%B9%E0%B8%99%E0%B8%9C%E0%B8%B6%E0%B9%89%E0%B8%87%E0%B8%AA%E0%B8%B8%E0%B8%94%E0%B8%99%E0xB9%88%E0xB8%B2%E0xB8%A3%E0xB8%B1%E0xB8%81-MAGrKHk5zKE.jpg",
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
