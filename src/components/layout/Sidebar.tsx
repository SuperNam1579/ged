"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import ThemeToggle from "@/components/ui/ThemeToggle";
import {
  LayoutDashboard, TrendingUp, Calendar, ClipboardList, Settings,
  BookOpen, LogOut, X, ChevronLeft, ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/progress",  label: "Progress",  icon: TrendingUp      },
  { href: "/schedule",  label: "Schedule",  icon: Calendar         },
  { href: "/mock-test", label: "Mock Test", icon: ClipboardList    },
  { href: "/settings",  label: "Settings",  icon: Settings         },
];

function MiniKaiFace() {
  return (
    <svg viewBox="16 44 108 100" width="36" height="36" fill="none">
      <ellipse cx="70" cy="56" rx="64" ry="50" fill="#2C1A0E" />
      <ellipse cx="70" cy="78" rx="52" ry="50" fill="#FDDCB5" />
      <ellipse cx="52" cy="84" rx="14" ry="15" fill="white" />
      <ellipse cx="88" cy="84" rx="14" ry="15" fill="white" />
      <rect x="36" y="72" width="32" height="24" rx="8" fill="none" stroke="#3D2614" strokeWidth="2.5" />
      <rect x="72" y="72" width="32" height="24" rx="8" fill="none" stroke="#3D2614" strokeWidth="2.5" />
      <circle cx="52" cy="85" r="8" fill="#1A0E05" />
      <circle cx="88" cy="85" r="8" fill="#1A0E05" />
      <circle cx="56" cy="81" r="3.5" fill="white" />
      <circle cx="92" cy="81" r="3.5" fill="white" />
    </svg>
  );
}

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

function SidebarTooltip({ label, collapsed }: { label: string; collapsed: boolean }) {
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
      <span className="relative flex items-center bg-foreground text-background text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
        <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-foreground" />
        {label}
      </span>
    </span>
  );
}

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  userName?: string;
  daysUntilExam?: number;
  overallProgress?: number;
  onClose?: () => void;
}

export default function Sidebar({
  collapsed = false,
  onToggleCollapse,
  userName,
  daysUntilExam,
  overallProgress = 0,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const pct = Math.round(overallProgress);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <aside className="w-full h-full flex flex-col" style={{ background: "#060D1C" }}>

      {/* ── Header ── */}
      <div
        className="shrink-0 flex items-center px-4 py-[18px]"
        style={{ gap: 9, borderBottom: "1px solid rgba(255,255,255,.07)" }}
      >
        <div
          className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0"
          style={{ boxShadow: "0 3px 0 rgba(0,0,0,.35)" }}
        >
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <FadeLabel collapsed={collapsed} className="text-base font-bold text-white">
          GED Prep
        </FadeLabel>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-white/30 hover:text-white/60 transition-colors ml-auto"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-white/30 hover:text-white/60 transition-colors ml-auto"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav aria-label="Main navigation" className="flex-1 py-2.5 space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <div key={item.href} className="relative group/item">
              <Link
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center w-full rounded-[10px] py-2.5 transition-colors duration-200",
                  isActive ? "bg-blue-600/25" : "hover:bg-white/5",
                )}
              >
                <span className="w-11 flex items-center justify-center shrink-0">
                  <Icon
                    aria-hidden="true"
                    className={cn("w-4 h-4", isActive ? "text-blue-400" : "text-white/30")}
                  />
                </span>
                <FadeLabel
                  collapsed={collapsed}
                  className={cn(
                    "text-[13px] font-medium",
                    isActive ? "text-blue-400" : "text-white/40",
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

      {/* ── Bottom: user + ring + theme + logout ── */}
      <div className="shrink-0 px-4 pt-4 pb-4" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>

        {/* User row */}
        {!collapsed && (
          <div className="flex items-center gap-2.5 mb-3">
            <div style={{
              width: 36, height: 36, borderRadius: "50%", overflow: "hidden",
              flexShrink: 0, border: "2px solid rgba(37,99,235,.6)", background: "#FDDCB5",
            }}>
              <MiniKaiFace />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-white leading-tight">
                {userName ?? "Student"}
              </div>
              {daysUntilExam !== undefined && (
                <div className="text-[11px] leading-tight text-white/35">
                  {daysUntilExam} days to exam
                </div>
              )}
            </div>
          </div>
        )}

        {/* Readiness ring */}
        {!collapsed && (
          <div
            className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 mb-2"
            style={{ background: "rgba(255,255,255,.05)" }}
          >
            <div style={{ position: "relative", width: 38, height: 38, flexShrink: 0 }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: `conic-gradient(#3B82F6 ${pct}%, rgba(255,255,255,.1) 0)`,
                WebkitMask: "radial-gradient(farthest-side,transparent 54%,black 0)",
                mask: "radial-gradient(farthest-side,transparent 54%,black 0)",
              }} />
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700, color: "white",
              }}>
                {pct}%
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-white/70">GED Readiness</div>
              <div className="text-[10px] text-white/30">AI-optimized plan</div>
            </div>
          </div>
        )}

        {/* ThemeToggle */}
        <div className={cn("mb-1", collapsed ? "flex justify-center" : "")}>
          <ThemeToggle
            showLabel={!collapsed}
            className={cn(
              "border-white/10 bg-transparent hover:bg-white/5",
              collapsed ? "px-2" : "w-full justify-start",
            )}
          />
        </div>

        {/* Logout */}
        <div className="relative group/item">
          <button
            onClick={handleLogout}
            className="flex items-center w-full rounded-xl py-2 hover:bg-white/5 transition-colors duration-200"
          >
            <span className="w-11 flex items-center justify-center shrink-0">
              <LogOut aria-hidden="true" className="w-4 h-4 text-white/25" />
            </span>
            <FadeLabel collapsed={collapsed} className="text-[12px] font-medium text-white/25">
              Log out
            </FadeLabel>
          </button>
          <SidebarTooltip label="Log out" collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}
