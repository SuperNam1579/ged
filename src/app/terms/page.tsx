import type { Metadata } from "next";
import LandingNavbar from "@/components/layout/LandingNavbar";
import LandingFooter from "@/components/layout/LandingFooter";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of GED Prep.",
};

const INK = "#0f2748";
const MUTED = "#5b769a";

const SECTIONS = [
  {
    title: "1. Accepting these terms",
    body: "By creating an account or using GED Prep, you agree to these Terms of Service and to our Privacy Policy. If you don't agree, please don't use the service.",
  },
  {
    title: "2. What GED Prep is",
    body: "GED Prep is a study platform that builds a personalized schedule from a diagnostic assessment and adapts it as you complete quizzes. It is a study aid, not a guarantee of exam results.",
  },
  {
    title: "3. Your account",
    body: "You're responsible for the accuracy of the information you provide and for keeping your login credentials secure. Let us know right away if you believe your account has been accessed without authorization.",
  },
  {
    title: "4. Acceptable use",
    body: "Use GED Prep only for its intended purpose: your own studying. Don't attempt to disrupt the service, scrape content at scale, or share your account access with others.",
  },
  {
    title: "5. Content and ownership",
    body: "The lessons, questions, and study plans generated for you are provided for personal, non-commercial study use. We retain ownership of the underlying platform, curriculum, and algorithms.",
  },
  {
    title: "6. Cancellation",
    body: "You can stop using GED Prep and delete your account at any time from your account settings, free of charge, with no cancellation fee.",
  },
  {
    title: "7. Disclaimer",
    body: "GED Prep is provided \"as is.\" We work to keep the content accurate and the platform available, but we don't guarantee uninterrupted access or specific exam outcomes.",
  },
  {
    title: "8. Changes to these terms",
    body: "We may update these terms as the product evolves. Continued use of GED Prep after an update means you accept the revised terms.",
  },
  {
    title: "9. Contact",
    body: "Questions about these terms? Reach out through the support link in your account settings.",
  },
];

export default function TermsPage() {
  return (
    <>
      <LandingNavbar />
      <main className="px-5 md:px-10" style={{ background: "#f4f8ff" }}>
        <div
          className="max-w-[760px] mx-auto"
          style={{ paddingTop: 64 + 52, paddingBottom: 72 }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "#1e90e8",
              marginBottom: 12,
            }}
          >
            Legal
          </p>
          <h1
            className="text-[32px] md:text-[44px]"
            style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: INK, lineHeight: 1.1 }}
          >
            Terms of Service
          </h1>
          <p className="text-[14px]" style={{ color: MUTED, marginTop: 10 }}>
            Last updated July 2026
          </p>

          <div className="mt-10 flex flex-col gap-8">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2
                  className="text-[17px] md:text-[19px]"
                  style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: INK }}
                >
                  {section.title}
                </h2>
                <p className="text-[14.5px]" style={{ color: MUTED, lineHeight: 1.7, marginTop: 6 }}>
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
