"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export type CommandGroup =
  | "Recent"
  | "Suggested"
  | "Navigation"
  | "Quick Actions"
  | "Menu Items"
  | "Opportunities"
  | "Live Tables"
  | "Data";

export interface CommandItem {
  id: string;
  group: CommandGroup;
  label: string;
  sublabel?: string;
  icon?: LucideIcon;
  keywords?: string[];
  onSelect: () => void;
}

const GROUP_ORDER: CommandGroup[] = [
  "Recent",
  "Suggested",
  "Navigation",
  "Quick Actions",
  "Menu Items",
  "Opportunities",
  "Live Tables",
  "Data",
];

function recentStorageKey(scope: string) {
  return `serva:command-palette:recent:${scope}`;
}

function loadRecentIds(scope: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(recentStorageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveRecentIds(scope: string, ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(recentStorageKey(scope), JSON.stringify(ids.slice(0, 5)));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — recents just won't persist
  }
}

/**
 * Owns command-palette open state, the global Cmd/Ctrl+K shortcut, query filtering,
 * keyboard-navigable selection, and recent-command persistence for a given item list.
 */
export function useCommandPalette(items: CommandItem[], recentScope: string, onOpen?: () => void) {
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentState, setRecentState] = useState(() => ({ scope: recentScope, ids: loadRecentIds(recentScope) }));
  const triggerRef = useRef<HTMLElement | null>(null);
  const onOpenRef = useRef(onOpen);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  // Re-derive recents when the scope (restaurant) changes — adjusted during render rather than in an effect.
  if (recentState.scope !== recentScope) {
    setRecentState({ scope: recentScope, ids: loadRecentIds(recentScope) });
  }
  const recentIds = recentState.ids;
  const setRecentIds = useCallback(
    (ids: string[]) => {
      setRecentState({ scope: recentScope, ids });
    },
    [recentScope]
  );

  const setOpen = useCallback((next: boolean, trigger?: HTMLElement | null) => {
    if (next) {
      if (trigger) triggerRef.current = trigger;
      onOpenRef.current?.();
    }
    setOpenState(next);
  }, []);

  const toggle = useCallback(() => {
    setOpenState((prev) => {
      const next = !prev;
      if (next) onOpenRef.current?.();
      return next;
    });
  }, []);

  // Clear the query once the palette closes — adjusted during render rather than in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setQuery("");
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isCommandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isCommandK) {
        event.preventDefault();
        setOpenState((prev) => {
          const next = !prev;
          if (next) onOpenRef.current?.();
          return next;
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const groupedResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const groups = new Map<CommandGroup, CommandItem[]>();

    function push(group: CommandGroup, item: CommandItem) {
      const list = groups.get(group) ?? [];
      list.push(item);
      groups.set(group, list);
    }

    if (!trimmed) {
      const recent = recentIds.map((id) => itemsById.get(id)).filter((item): item is CommandItem => Boolean(item));
      for (const item of recent) push("Recent", item);

      const suggested = items
        .filter((item) => (item.group === "Navigation" || item.group === "Quick Actions") && !recentIds.includes(item.id))
        .slice(0, 5);
      for (const item of suggested) push("Suggested", item);
    } else {
      for (const item of items) {
        const haystack = [item.label, item.sublabel ?? "", item.group, ...(item.keywords ?? [])].join(" ").toLowerCase();
        if (haystack.includes(trimmed)) push(item.group, item);
      }
    }

    return GROUP_ORDER.map((group) => ({ group, items: groups.get(group) ?? [] })).filter((entry) => entry.items.length > 0);
  }, [items, itemsById, query, recentIds]);

  const flatResults = useMemo(() => groupedResults.flatMap((entry) => entry.items), [groupedResults]);

  const [selectionKey, setSelectionKey] = useState({ query, open });
  if (selectionKey.query !== query || selectionKey.open !== open) {
    setSelectionKey({ query, open });
    setSelectedIndex(0);
  }

  const moveSelection = useCallback(
    (delta: number) => {
      if (flatResults.length === 0) return;
      setSelectedIndex((prev) => (prev + delta + flatResults.length) % flatResults.length);
    },
    [flatResults.length]
  );

  const executeCommand = useCallback(
    (item?: CommandItem) => {
      const target = item ?? flatResults[selectedIndex];
      if (!target) return;
      const nextRecent = [target.id, ...recentIds.filter((id) => id !== target.id)].slice(0, 5);
      setRecentIds(nextRecent);
      saveRecentIds(recentScope, nextRecent);
      setOpen(false);
      target.onSelect();
    },
    [flatResults, selectedIndex, recentIds, recentScope, setOpen, setRecentIds]
  );

  return {
    open,
    setOpen,
    toggle,
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    moveSelection,
    groupedResults,
    flatResults,
    executeCommand,
    triggerRef,
  };
}
