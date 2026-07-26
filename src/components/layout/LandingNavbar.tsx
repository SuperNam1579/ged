"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { BookOpen, ChevronDown, Menu, X } from "lucide-react";
import { LANDING_SUBJECTS, TOTAL_TOPICS, subtopicCount } from "@/components/landing/subjects";

// Order matters: it must match the order the sections appear on the page
// (features → how-it-works → subjects). The active pill slides between links by
// position, so a nav order that disagrees with the page order makes it jump
// forward past a link and then double back as the user scrolls straight down.
// hrefs are root-relative (`/#features`, not `#features`) because this navbar
// also renders on /subjects — a bare hash there would just sit on the current
// page doing nothing. `id` is separate: it's what the scroll spy matches while
// the user is actually on the landing page.
const NAV_LINKS = [
  { href: "/#features", label: "Features", id: "features" },
  { href: "/how-it-works", label: "How it works", id: "how-it-works" },
  { href: "/subjects", label: "Subjects", id: "subjects", hasMenu: true },
];

const NAV_HEIGHT = 64;
/** How far below the navbar a section's top must pass to count as "current". */
const ACTIVE_OFFSET = NAV_HEIGHT + 40;
/** Grace period before a hover-opened dropdown closes, so crossing the gap
 *  between the trigger and the panel doesn't dismiss it. */
const CLOSE_DELAY_MS = 120;

export default function LandingNavbar() {
  // Solid + blurred once scrolled; transparent over the hero so the bar melts
  // into it on first paint.
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSubjects = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setSubjectsOpen(true);
  };

  const closeSubjectsSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setSubjectsOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  // One rAF-throttled listener drives both the scrolled flag and the scroll
  // spy, so we never stack two handlers on the same event.
  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > 8);

      // Still in the hero — no link should read as current.
      if (y < 120) {
        setActiveId("");
        return;
      }
      // Of the sections whose top has passed the line under the navbar, the
      // current one is whichever sits closest to that line. Comparing measured
      // positions (rather than taking the last match while iterating) keeps this
      // correct even though NAV_LINKS isn't in document order — the page lays
      // out how-it-works before subjects, which previously let how-it-works win
      // permanently and meant Subjects never highlighted.
      let current = "";
      let closestTop = -Infinity;
      for (const { id } of NAV_LINKS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= ACTIVE_OFFSET && top > closestTop) {
          closestTop = top;
          current = id;
        }
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Escape closes the subjects dropdown.
  useEffect(() => {
    if (!subjectsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSubjectsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [subjectsOpen]);

  // Escape closes the mobile sheet, and while it's open the page behind it
  // shouldn't scroll.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50"
      initial={{ y: -NAV_HEIGHT }}
      animate={{ y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        // Always opaque enough to read against. The hero's light diagonal panel
        // runs all the way to y=0, so a transparent bar left the right-hand
        // links (white on #EFF6FF) invisible until the user scrolled.
        // The scrolled state still reads differently — it gains blur, a lift
        // shadow and a hairline — without ever giving up contrast.
        background: scrolled ? "rgba(6,13,28,.86)" : "#060D1C",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: `1px solid ${scrolled ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.07)"}`,
        boxShadow: scrolled ? "0 8px 24px -16px rgba(0,0,0,.7)" : "none",
        transition:
          "background .3s ease, backdrop-filter .3s ease, border-color .3s ease, box-shadow .3s ease",
      }}
    >
      <div
        className="max-w-[1200px] mx-auto px-4 md:px-10 flex items-center justify-between"
        style={{ height: NAV_HEIGHT }}
      >
        {/* ── Logo ── */}
        <Link
          href="/"
          className="flex items-center gap-[10px] group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label="GED Prep — home"
        >
          <motion.span
            className="flex items-center justify-center shrink-0"
            whileHover={{ rotate: -8, scale: 1.06 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            style={{
              width: 34,
              height: 34,
              background: "#1e90e8",
              borderRadius: 9,
              boxShadow: "0 3px 0 #1670be",
            }}
          >
            <BookOpen className="text-white" style={{ width: 18, height: 18 }} strokeWidth={2.5} />
          </motion.span>
          <span
            style={{
              fontFamily: "var(--font-feather)",
              fontSize: 18,
              fontWeight: 700,
              color: "white",
            }}
          >
            GED Prep
          </span>
        </Link>

        {/* ── Desktop links, with a pill that slides to the current section ── */}
        <div className="hidden md:flex items-center gap-1">
          {/* LayoutGroup keeps the shared-layout pill measuring against these
              links specifically, so it interpolates between them rather than
              re-appearing at each new position. */}
          <LayoutGroup id="landing-nav">
            {NAV_LINKS.map((link) => {
              const isActive = activeId === link.id;
              const linkEl = (
                <Link
                  href={link.href}
                  aria-current={isActive ? "true" : undefined}
                  aria-expanded={link.hasMenu ? subjectsOpen : undefined}
                  aria-haspopup={link.hasMenu ? "true" : undefined}
                  className="relative flex items-center gap-1 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  style={{ color: isActive ? "white" : "rgba(255,255,255,.45)" }}
                >
                  {isActive && (
                    // Shared layoutId makes the highlight travel between links
                    // instead of blinking out and in.
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 -z-10 rounded-lg"
                      style={{ background: "rgba(255,255,255,.10)" }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative hover:text-white transition-colors">{link.label}</span>
                  {link.hasMenu && (
                    <motion.span
                      className="relative flex"
                      animate={{ rotate: subjectsOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </motion.span>
                  )}
                </Link>
              );

              if (!link.hasMenu) {
                return <div key={link.href}>{linkEl}</div>;
              }

              // Subjects gets a dropdown listing all four subjects. Hover and
              // focus-within both drive it so keyboard users reach it too, and
              // the panel is a child of this wrapper so moving the pointer from
              // trigger to panel never leaves the hover area.
              return (
                <div
                  key={link.href}
                  className="relative"
                  onMouseEnter={openSubjects}
                  onMouseLeave={closeSubjectsSoon}
                  onFocus={openSubjects}
                  onBlur={closeSubjectsSoon}
                >
                  {linkEl}
                  <AnimatePresence>
                    {subjectsOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="absolute right-0 top-full pt-2 w-[340px]"
                        role="group"
                        aria-label="GED subjects"
                      >
                        <div
                          className="rounded-2xl overflow-hidden"
                          style={{
                            background: "rgba(10,19,38,.97)",
                            backdropFilter: "blur(16px)",
                            WebkitBackdropFilter: "blur(16px)",
                            border: "1px solid rgba(255,255,255,.12)",
                            boxShadow: "0 24px 48px -20px rgba(0,0,0,.8)",
                          }}
                        >
                          <div className="p-2">
                            {LANDING_SUBJECTS.map((subject) => (
                              <Link
                                key={subject.slug}
                                href={`/subjects/${subject.slug}`}
                                onClick={() => setSubjectsOpen(false)}
                                className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-colors hover:bg-white/[.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                              >
                                <span
                                  className="flex items-center justify-center shrink-0"
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 10,
                                    background: subject.iconBg,
                                  }}
                                >
                                  {/* Icons are authored at 22px for the page's
                                      larger rows; scale down for the menu. */}
                                  <span className="flex scale-[.78]">{subject.icon}</span>
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] font-semibold text-white truncate">
                                    {subject.shortName}
                                  </span>
                                  <span
                                    className="block text-[11px] font-medium"
                                    style={{ color: "rgba(255,255,255,.4)" }}
                                  >
                                    {subtopicCount(subject)} topics
                                  </span>
                                </span>
                              </Link>
                            ))}
                          </div>
                          <div
                            className="px-4 py-2.5 flex items-center justify-between"
                            style={{
                              borderTop: "1px solid rgba(255,255,255,.09)",
                              background: "rgba(255,255,255,.03)",
                            }}
                          >
                            <span className="text-[11px]" style={{ color: "rgba(255,255,255,.4)" }}>
                              {TOTAL_TOPICS} topics across all 4 subjects
                            </span>
                            <Link
                              href="/subjects"
                              onClick={() => setSubjectsOpen(false)}
                              className="text-[11px] font-bold hover:underline"
                              style={{ color: "#4aa8f0" }}
                            >
                              View full syllabus →
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </LayoutGroup>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-2 md:gap-[10px]">
          <Link
            href="/login"
            className="hidden sm:inline-block transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.08] hover:bg-white/10 active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            style={{
              padding: "8px 14px",
              background: "transparent",
              color: "rgba(255,255,255,.65)",
              border: "1.5px solid rgba(255,255,255,.18)",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="inline-block transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.08] hover:brightness-110 active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{
              padding: "8px 16px",
              background: "#1e90e8",
              color: "white",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              boxShadow: "0 3px 0 #1670be",
              textDecoration: "none",
            }}
          >
            Get Started
          </Link>

          {/* Hamburger — the mobile links used to simply not exist */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={menuOpen ? "close" : "open"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* ── Mobile sheet ── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="landing-mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden overflow-hidden"
            style={{
              background: "rgba(6,13,28,.96)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderTop: "1px solid rgba(255,255,255,.09)",
            }}
          >
            <div className="px-4 py-3 flex flex-col">
              {NAV_LINKS.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 + i * 0.05, duration: 0.25 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block py-3 text-[15px] font-medium rounded-lg px-2 transition-colors"
                    style={{ color: activeId === link.id ? "white" : "rgba(255,255,255,.55)" }}
                  >
                    {link.label}
                  </Link>
                  {/* The dropdown is hover-driven, so on touch the subject list
                      is inlined here instead — same information, no hover. */}
                  {link.hasMenu && (
                    <div className="pl-2 pb-1 flex flex-col gap-0.5">
                      {LANDING_SUBJECTS.map((subject) => (
                        <Link
                          key={subject.slug}
                          href={`/subjects/${subject.slug}`}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 py-2 px-2 rounded-lg transition-colors hover:bg-white/[.06]"
                        >
                          <span
                            className="shrink-0"
                            style={{
                              width: 3,
                              height: 22,
                              borderRadius: 2,
                              background: subject.color,
                            }}
                          />
                          <span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,.6)" }}>
                            {subject.shortName}
                          </span>
                          <span className="text-[11px] ml-auto" style={{ color: "rgba(255,255,255,.3)" }}>
                            {subtopicCount(subject)} lessons
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
              {/* Sign In lives here on mobile, where it's hidden in the bar */}
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 + NAV_LINKS.length * 0.05, duration: 0.25 }}
                className="sm:hidden mt-2 pt-3"
                style={{ borderTop: "1px solid rgba(255,255,255,.09)" }}
              >
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="block text-center py-2.5 rounded-[10px] text-[14px] font-semibold"
                  style={{
                    color: "rgba(255,255,255,.75)",
                    border: "1.5px solid rgba(255,255,255,.18)",
                  }}
                >
                  Sign In
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
