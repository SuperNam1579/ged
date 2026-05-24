"use client";

import { useState } from "react";
import { Menu, BookOpen } from "lucide-react";
import Sidebar from "./Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
  userName?: string;
  daysUntilExam?: number;
}

export default function MainLayout({ children, userName, daysUntilExam }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    // h-screen + overflow-hidden creates the fixed app-shell; each pane scrolls independently
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── Mobile backdrop ──────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      {/*
        Mobile: fixed, slides in from left (z-30 so it's above backdrop).
        Desktop (md+): static in the flex row, never moves.
      */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-30 w-64 transition-transform duration-200 ease-in-out",
          "md:relative md:inset-y-auto md:left-auto md:z-auto md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <Sidebar
          userName={userName}
          daysUntilExam={daysUntilExam}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* ── Content column ───────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile top bar — hidden on md+ */}
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-normal">GED Prep</span>
          </div>
        </header>

        {/* Page content — this is the only scrolling pane */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

      </div>
    </div>
  );
}
