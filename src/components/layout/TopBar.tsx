"use client";

import { Bell } from "lucide-react";

interface TopBarProps {
  title: string;
  unreadCount?: number;
}

export default function TopBar({ title, unreadCount = 0 }: TopBarProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <h1 className="font-display text-xl font-semibold text-dark">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Cloche de notifications */}
        <button
          className="relative p-2 rounded-lg text-gray-medium hover:text-dark hover:bg-gray-light transition-colors"
          aria-label="Notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-coral-red" />
          )}
        </button>
      </div>
    </header>
  );
}
