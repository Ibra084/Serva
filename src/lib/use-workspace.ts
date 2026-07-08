"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getCurrentUser,
  getMembershipForSlug,
  getUserWorkspaces,
  getWorkspaceBySlug,
  setActiveWorkspace,
} from "@/lib/workspace-store";
import type { Membership, RestaurantWorkspace, User } from "@/lib/types";

interface WorkspaceData {
  user: User | null;
  workspace: RestaurantWorkspace | null;
  membership: Membership | null;
}

interface WorkspaceCacheEntry {
  data?: WorkspaceData;
  promise?: Promise<WorkspaceData>;
  listeners: Set<(data: WorkspaceData) => void>;
}

const workspaceCache = new Map<string, WorkspaceCacheEntry>();

function getCacheEntry(restaurantSlug: string): WorkspaceCacheEntry {
  let entry = workspaceCache.get(restaurantSlug);
  if (!entry) {
    entry = { listeners: new Set() };
    workspaceCache.set(restaurantSlug, entry);
  }
  return entry;
}

/** Fetches (or reuses an in-flight fetch of) the workspace data for a slug, notifying all subscribers once resolved. */
function fetchWorkspace(restaurantSlug: string): Promise<WorkspaceData> {
  const entry = getCacheEntry(restaurantSlug);
  if (entry.promise) return entry.promise;

  entry.promise = Promise.all([
    getCurrentUser(),
    getWorkspaceBySlug(restaurantSlug),
    getMembershipForSlug(restaurantSlug),
  ]).then(([user, workspace, membership]) => {
    const data: WorkspaceData = { user, workspace, membership };
    entry.data = data;
    entry.promise = undefined;
    for (const listener of entry.listeners) listener(data);
    return data;
  });

  return entry.promise;
}

/** Resolves the active restaurant workspace + the current user's membership in it. Shares one fetch per slug across every caller (e.g. shell + topbar). */
export function useWorkspace(restaurantSlug: string) {
  const cached = workspaceCache.get(restaurantSlug)?.data;
  const [data, setData] = useState<WorkspaceData | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);

  const refresh = useCallback(async () => {
    setLoading(true);
    const entry = getCacheEntry(restaurantSlug);
    entry.data = undefined;
    entry.promise = undefined;
    const result = await fetchWorkspace(restaurantSlug);
    setData(result);
    setLoading(false);
  }, [restaurantSlug]);

  useEffect(() => {
    setActiveWorkspace(restaurantSlug);

    const entry = getCacheEntry(restaurantSlug);
    const listener = (result: WorkspaceData) => {
      setData(result);
      setLoading(false);
    };
    entry.listeners.add(listener);

    if (entry.data) {
      setData(entry.data);
      setLoading(false);
    } else {
      setLoading(true);
      fetchWorkspace(restaurantSlug).then(listener);
    }

    return () => {
      entry.listeners.delete(listener);
    };
  }, [restaurantSlug]);

  return { user: data?.user ?? null, workspace: data?.workspace ?? null, membership: data?.membership ?? null, loading, refresh };
}

/** All restaurant workspaces the current user belongs to — for the workspace switcher. */
export function useUserWorkspaces() {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<{ workspace: RestaurantWorkspace; membership: Membership }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [currentUser, userWorkspaces] = await Promise.all([getCurrentUser(), getUserWorkspaces()]);
      if (cancelled) return;
      setUser(currentUser);
      setWorkspaces(userWorkspaces);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, workspaces, loading };
}
