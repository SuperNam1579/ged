"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  TrendingUp,
  Calendar,
  ClipboardList,
  Settings,
  BookOpen,
  LogOut,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/progress",  label: "Progress",  icon: TrendingUp     },
  { href: "/schedule",  label: "Schedule",  icon: Calendar        },
  { href: "/mock-test", label: "Mock Test", icon: ClipboardList   },
  { href: "/settings",  label: "Settings",  icon: Settings        },
];

interface SidebarProps {
  userName?: string;
  daysUntilExam?: number;
  onClose?: () => void;
}

export default function Sidebar({ userName, daysUntilExam, onClose }: SidebarProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    /*
      w-64    — fixed 256 px width, never negotiable
      shrink-0 — critical: prevents flex from squeezing the sidebar
      h-full  — fills the parent column (h-screen on desktop, full pane on mobile)
    */
    <aside className="w-64 shrink-0 h-full bg-white border-r border-gray-200 flex flex-col overflow-y-auto">

      {/* ── Logo ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold text-gray-900 truncate tracking-normal">
            GED Prep
          </span>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded-lg hover:bg-gray-100 transition-colors shrink-0 ml-2"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* ── User info ────────────────────────────────────── */}
      {userName && (
        <div className="px-5 py-3.5 border-b border-gray-100 shrink-0">
          <p className="text-xs text-gray-400 mb-0.5 tracking-normal">Studying as</p>
          <p className="text-sm font-semibold text-gray-800 truncate tracking-normal">{userName}</p>
          {daysUntilExam !== undefined && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-md px-2.5 py-1 text-xs font-medium tracking-normal">
              <span className="font-bold text-blue-900">{daysUntilExam}</span>
              days until exam
            </div>
          )}
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="flex-1 px-3 py-3 space-y-0.5" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                "tracking-normal whitespace-nowrap",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 shrink-0",
                  isActive ? "text-blue-600" : "text-gray-400"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Logout ───────────────────────────────────────── */}
      <div className="px-3 py-3 border-t border-gray-100 shrink-0">
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg",
            "text-sm font-medium tracking-normal whitespace-nowrap",
            "text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0 text-gray-400" />
          Log out
        </button>
      </div>

    </aside>
  );
}
