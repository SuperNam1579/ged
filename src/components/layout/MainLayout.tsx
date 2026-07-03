"use client";

import { useState } from "react";
import { Menu, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import Sidebar from "./Sidebar";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface MainLayoutProps {
  children: React.ReactNode;
  userName?: string;
  daysUntilExam?: number;
}

export default function MainLayout({ children, userName, daysUntilExam }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Mobile backdrop ──────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar wrapper ──────────────────────────────── */}
      {/*
        Width transitions live here (desktop).
        Slide-in transition lives here (mobile).
        The <aside> inside uses w-full so it fills whatever width
        this wrapper gives it.

        Mobile:  fixed overlay, always w-64, translates in/out.
        Desktop: static flex item, transitions between w-64 ↔ w-18 (72 px).
      */}
      <div
        className={cn(
          "shrink-0 z-30 h-full",
          // ─ mobile ─
          "fixed inset-y-0 left-0 w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // ─ desktop override ─
          "md:relative md:inset-auto md:translate-x-0",
          "transition-all duration-300 ease-in-out",
          collapsed ? "md:w-18" : "md:w-64",
        )}
      >
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          userName={userName}
          daysUntilExam={daysUntilExam}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      {/* ── Content column ───────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile top bar — hidden on md+ */}
        <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground text-sm tracking-normal">GED Prep</span>
          </div>
          <ThemeToggle className="border-0 bg-transparent px-2 hover:bg-muted" />
        </header>

        {/* Page content — sole scrolling region */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

      </div>
    </div>
  );
}
