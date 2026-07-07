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

  const refresh = useCallback(() => {
    setUser(getCurrentUser());
    setWorkspace(getWorkspaceBySlug(restaurantSlug));
    setMembership(getMembershipForSlug(restaurantSlug));
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
    setUser(getCurrentUser());
    setWorkspaces(getUserWorkspaces());
    setLoading(false);
  }, []);

  return { user, workspaces, loading };
}
