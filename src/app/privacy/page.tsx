import type { Metadata } from "next";
import LandingNavbar from "@/components/layout/LandingNavbar";
import LandingFooter from "@/components/layout/LandingFooter";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How GED Prep collects, uses, and protects your data.",
};

const INK = "#0f2748";
const MUTED = "#5b769a";

const SECTIONS = [
  {
    title: "1. Information we collect",
    body: "When you create an account, we collect your name, email address, and date of birth. As you use GED Prep, we record your diagnostic and quiz results, study schedule, and progress so we can build and adapt your study plan.",
  },
  {
    title: "2. How we use your information",
    body: "Your data is used to generate your personalized study plan, track your progress, adapt lesson recommendations, and keep your account secure. We don't use your study data to build a profile for advertising.",
  },
  {
    title: "3. What we don't do",
    body: "We don't sell your personal information. We don't share your quiz results or study history with third parties except as needed to operate the service (for example, hosting and authentication providers).",
  },
  {
    title: "4. Data retention",
    body: "We keep your account and study data for as long as your account is active. If you delete your account, we remove your personal information within a reasonable time, except where retention is required by law.",
  },
  {
    title: "5. Security",
    body: "We use industry-standard measures — encrypted connections, hashed passwords, and access controls — to protect your data. No system is perfectly secure, but we work to keep yours safe.",
  },
  {
    title: "6. Your choices",
    body: "You can review, update, or delete your account information at any time from your account settings. You can also request a copy of the data we hold about you.",
  },
  {
    title: "7. Cookies",
    body: "We use essential cookies to keep you signed in and remember your preferences. We don't use third-party advertising cookies.",
  },
  {
    title: "8. Changes to this policy",
    body: "If we make material changes to how we handle your data, we'll update this page and, where appropriate, notify you directly.",
  },
  {
    title: "9. Contact",
    body: "Questions about your data? Reach out through the support link in your account settings.",
  },
];

export default function PrivacyPage() {
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
            Privacy Policy
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
