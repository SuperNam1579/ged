import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
