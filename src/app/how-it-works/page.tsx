import type { Metadata } from "next";
import HowItWorksContent from "@/components/landing/HowItWorksContent";

/**
 * The figures this page quotes (GA weights, population size, generation count,
 * lesson totals) are imported from the code they describe, so it can't drift
 * from the system the way the hardcoded topic counts on the landing page did.
 */
export const metadata: Metadata = {
  title: "How it works",
  description:
    "How your study plan gets built: pick your subjects, give your free time, take a short test — we plan every day to your exam once, and after that the plan is yours to change.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return <HowItWorksContent />;
}
