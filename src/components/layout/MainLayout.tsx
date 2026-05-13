"use client";

import Sidebar from "./Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
  userName?: string;
  daysUntilExam?: number;
}

export default function MainLayout({ children, userName, daysUntilExam }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar userName={userName} daysUntilExam={daysUntilExam} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
