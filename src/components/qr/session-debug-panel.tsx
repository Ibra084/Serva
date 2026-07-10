"use client";

import { useState } from "react";
import { Bug, ChevronDown, ChevronUp } from "lucide-react";
import { calculateBill, type TableSession } from "@/lib/session-store";

function SessionRow({ session }: { session: TableSession }) {
  const bill = calculateBill(session);
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
      <span className="text-muted-foreground">sessionId</span>
      <span className="truncate">{session.sessionId}</span>
      <span className="text-muted-foreground">tableId</span>
      <span>{session.tableId}</span>
      <span className="text-muted-foreground">status</span>
      <span>{session.status}</span>
      <span className="text-muted-foreground">orders</span>
      <span>{session.orders.length}</span>
      <span className="text-muted-foreground">payments</span>
      <span>{session.payments.length}</span>
      <span className="text-muted-foreground">remaining</span>
      <span>AED {bill.remaining.toLocaleString()}</span>
    </div>
  );
}

/** Dev-only collapsible panel showing raw session state, for verifying the QR/live pages agree on the same source of truth. Renders nothing in production. */
export function SessionDebugPanel({
  session,
  sessions,
}: {
  session?: TableSession | null;
  sessions?: TableSession[];
}) {
  const [open, setOpen] = useState(false);
  if (process.env.NODE_ENV === "production") return null;

  const list = sessions ?? (session ? [session] : []);
  if (list.length === 0) return null;

  return (
    <div className="fixed bottom-3 left-3 z-50 max-w-xs font-mono text-[10px]">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-foreground shadow-sm"
      >
        <Bug className="size-3" />
        debug ({list.length})
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {open && (
        <div className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-sm">
          {list.map((entry) => (
            <div key={entry.sessionId} className="border-b border-border py-1.5 first:pt-0 last:border-b-0 last:pb-0">
              <SessionRow session={entry} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
