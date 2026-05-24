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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ─── nav config ──────────────────────────────────────────────────────────────

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/progress",  label: "Progress",  icon: TrendingUp      },
  { href: "/schedule",  label: "Schedule",  icon: Calendar         },
  { href: "/mock-test", label: "Mock Test", icon: ClipboardList    },
  { href: "/settings",  label: "Settings",  icon: Settings         },
];

// ─── module-level helpers ────────────────────────────────────────────────────

/**
 * Slides a label in/out via max-width + opacity.
 * `shrink-0` prevents the flex parent from squishing the span before
 * the max-width transition can animate it to 0.
 */
function FadeLabel({
  children,
  collapsed,
  className,
}: {
  children: React.ReactNode;
  collapsed: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap overflow-hidden tracking-normal shrink-0",
        "transition-[max-width,opacity] duration-300 ease-in-out",
        collapsed ? "max-w-0 opacity-0" : "max-w-50 opacity-100",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Tooltip that appears to the right of the sidebar in collapsed mode.
 * The inner box is `relative` so the CSS-triangle arrow anchors to it.
 */
function SidebarTooltip({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  if (!collapsed) return null;
  return (
    <span
      role="tooltip"
      className={cn(
        "absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50",
        "pointer-events-none select-none",
        "opacity-0 group-hover/item:opacity-100",
        "transition-opacity duration-150 ease-in-out delay-75",
      )}
    >
      <span className="relative flex items-center bg-gray-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
        <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-900" />
        {label}
      </span>
    </span>
  );
}

// ─── types ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  userName?: string;
  daysUntilExam?: number;
  onClose?: () => void;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function Sidebar({
  collapsed = false,
  onToggleCollapse,
  userName,
  daysUntilExam,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <aside className="w-full h-full bg-white border-r border-gray-200 flex flex-col">

      {/* ══ Header ═══════════════════════════════════════════════════════════
          Collapsed and expanded are separate DOM nodes.
          A single-element header animated between flex-row and flex-col
          makes the toggle button overflow the 72 px collapsed width.
      */}
      {collapsed ? (
        <div className="flex flex-col items-center py-3 border-b border-gray-100 shrink-0 gap-1.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-150"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center px-4 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-gray-900">GED Prep</span>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="hidden md:flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-150 shrink-0"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      )}

      {/* ══ User info ════════════════════════════════════════════════════════ */}
      {userName && !collapsed && (
        <div className="border-b border-gray-100 shrink-0 py-3 px-4">
          <p className="text-xs text-gray-400 mb-0.5 tracking-normal">Studying as</p>
          <p className="text-sm font-semibold text-gray-800 truncate tracking-normal">{userName}</p>
          {daysUntilExam !== undefined && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-md px-2.5 py-1 text-xs font-medium tracking-normal whitespace-nowrap">
              <span className="font-bold text-blue-900">{daysUntilExam}</span>
              <span>days until exam</span>
            </div>
          )}
        </div>
      )}

      {/* ══ Navigation ═══════════════════════════════════════════════════════
          px-2 is constant in both states so icons never shift horizontally.
          Each nav item uses a fixed w-11 icon column; the label animates via
          FadeLabel. No justify-center toggling needed.
      */}
      <nav
        aria-label="Main navigation"
        className="flex-1 py-3 space-y-0.5 px-2"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <div key={item.href} className="relative group/item">
              <Link
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center w-full rounded-xl py-2.5",
                  "transition-colors duration-200",
                  isActive
                    ? "bg-blue-50"
                    : "hover:bg-gray-100",
                )}
              >
                {/*
                  w-11 (44 px) fixed column — icon is always centered at the
                  same x-position regardless of collapsed state.
                  With nav px-2 (8 px each side), icon center sits at
                  8 + 22 = 30 px from the sidebar's left edge in both modes.
                */}
                <span className="w-11 flex items-center justify-center shrink-0">
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      "w-5 h-5",
                      isActive ? "text-blue-600" : "text-gray-400",
                    )}
                  />
                </span>
                <FadeLabel
                  collapsed={collapsed}
                  className={cn(
                    "text-sm font-medium",
                    isActive ? "text-blue-700" : "text-gray-700",
                  )}
                >
                  {item.label}
                </FadeLabel>
              </Link>

              <SidebarTooltip label={item.label} collapsed={collapsed} />
            </div>
          );
        })}
      </nav>

      {/* ══ Logout ═══════════════════════════════════════════════════════════ */}
      <div className="border-t border-gray-100 shrink-0 px-2 py-3">
        <div className="relative group/item">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center w-full rounded-xl py-2.5",
              "transition-colors duration-200",
              "hover:bg-red-50",
            )}
          >
            <span className="w-11 flex items-center justify-center shrink-0">
              <LogOut
                aria-hidden="true"
                className="w-5 h-5 text-gray-400 transition-colors duration-150 group-hover/item:text-red-500"
              />
            </span>
            <FadeLabel
              collapsed={collapsed}
              className="text-sm font-medium text-gray-600 group-hover/item:text-red-600"
            >
              Log out
            </FadeLabel>
          </button>

          <SidebarTooltip label="Log out" collapsed={collapsed} />
        </div>
      </div>

    </aside>
  );
}
