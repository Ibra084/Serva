"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { subscribeToasts, type ToastMessage } from "@/lib/toast";

/** Minimal global toast stack. Mount once near the root of the portal shell. */
export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-[0_24px_48px_-24px_rgba(33,31,26,0.4)]"
        >
          <Info className="size-4 shrink-0 text-muted-foreground" />
          {toast.text}
        </div>
      ))}
    </div>
  );
}
