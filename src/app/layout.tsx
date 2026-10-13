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
  // Makes the share image and canonical links absolute, which link previews need.
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
  // Icons come from files in this folder: favicon.ico (browser tab) and
  // apple-icon.png (home screen). The share image is opengraph-image.png, a
  // screenshot of the home page at 1200×630.
  openGraph: {
    title: "GED Prep — Adaptive Study Platform",
    description:
      "AI-powered adaptive GED exam preparation with personalized study plans driven by Genetic Algorithm optimization.",
    siteName: "GED Prep",
    url: "/",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
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
