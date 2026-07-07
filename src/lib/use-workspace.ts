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

/** Resolves the active restaurant workspace + the current user's membership in it. */
export function useWorkspace(restaurantSlug: string) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<RestaurantWorkspace | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [currentUser, currentWorkspace, currentMembership] = await Promise.all([
      getCurrentUser(),
      getWorkspaceBySlug(restaurantSlug),
      getMembershipForSlug(restaurantSlug),
    ]);
    setUser(currentUser);
    setWorkspace(currentWorkspace);
    setMembership(currentMembership);
    setLoading(false);
  }, [restaurantSlug]);

  useEffect(() => {
    refresh();
    setActiveWorkspace(restaurantSlug);
  }, [refresh, restaurantSlug]);

  return { user, workspace, membership, loading, refresh };
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
