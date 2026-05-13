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
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/mock-test", label: "Mock Test", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  userName?: string;
  daysUntilExam?: number;
}

export default function Sidebar({ userName, daysUntilExam }: SidebarProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">GED Prep</span>
        </div>
      </div>

      {/* User info */}
      {userName && (
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-xs text-gray-500 mb-0.5">Studying as</p>
          <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
          {daysUntilExam !== undefined && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-md px-2.5 py-1 text-xs font-medium">
              <span className="text-blue-900 font-bold">{daysUntilExam}</span>
              days until exam
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className={cn("w-4.5 h-4.5", isActive ? "text-blue-600" : "text-gray-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4.5 h-4.5 text-gray-400" />
          Log out
        </button>
      </div>
    </aside>
  );
}
