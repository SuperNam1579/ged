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
    "How your study plan gets built: a short test that scores every lesson, an algorithm that weighs six goals at once, and a schedule you can rebuild whenever your results move.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return <HowItWorksContent />;
}
