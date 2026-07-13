import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check Your Email",
  robots: { index: false, follow: false },
};

export default function CheckEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
