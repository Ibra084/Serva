"use client";

import { useState } from "react";
import { Pencil, Users } from "lucide-react";
import { isParticipantConnected } from "@/lib/table-session-store";
import type { TableParticipant } from "@/lib/types";

/** Shows how many devices/guests are currently connected at this table, and lets the current device rename itself. */
export function GuestStrip({
  participants,
  selfParticipantId,
  onRename,
}: {
  participants: TableParticipant[];
  selfParticipantId: string | null;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (participants.length === 0) return null;
  const connected = participants.filter(isParticipantConnected);
  const self = participants.find((participant) => participant.id === selfParticipantId);

  function startEditing() {
    setDraft(self?.displayName ?? "");
    setEditing(true);
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed) onRename(trimmed);
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Users className="size-3.5" />
        {connected.length} guest{connected.length === 1 ? "" : "s"} viewing this table
      </div>
      <div className="flex flex-wrap gap-1.5">
        {participants.map((participant) => {
          const isSelf = participant.id === selfParticipantId;
          return (
            <span
              key={participant.id}
              className={
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium " +
                (isSelf ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground") +
                (isParticipantConnected(participant) ? "" : " opacity-50")
              }
            >
              {participant.displayName}
              {isSelf && (
                <button onClick={startEditing} aria-label="Rename yourself" className="ml-0.5">
                  <Pencil className="size-3" />
                </button>
              )}
            </span>
          );
        })}
      </div>
      {editing && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && save()}
            placeholder="Your name"
            maxLength={24}
            className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
          <button
            onClick={save}
            className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
