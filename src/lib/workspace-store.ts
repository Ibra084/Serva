import type { Membership, MembershipRole, RestaurantWorkspace, User } from "@/lib/types";

const USER_KEY = "serva_user";
const WORKSPACES_KEY = "serva_workspaces";
const MEMBERSHIPS_KEY = "serva_memberships";
const ACTIVE_WORKSPACE_KEY = "serva_active_workspace";

const DEMO_USER: User = {
  id: "user-demo",
  name: "Demo User",
  email: "demo@serva.app",
};

const DEMO_WORKSPACE_NAME = "Marco's Kitchen";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "") || "restaurant"
  );
}

function uniqueSlug(name: string): string {
  const base = slugify(name);
  const existingSlugs = new Set(getWorkspaces().map((workspace) => workspace.slug));
  if (!existingSlugs.has(base)) return base;

  let suffix = 2;
  while (existingSlugs.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function getCurrentUser(): User | null {
  return readJson<User>(USER_KEY);
}

/** Sets the signed-in identity (a real Supabase user, or the fixed demo identity). */
export function setCurrentUser(user: User) {
  writeJson(USER_KEY, user);
}

/** Marks the current session as the fixed demo identity, used only by the explicit "demo account" entry points. */
export function loginAsDemoUser(): User {
  setCurrentUser(DEMO_USER);
  return DEMO_USER;
}

export function getWorkspaces(): RestaurantWorkspace[] {
  return readJson<RestaurantWorkspace[]>(WORKSPACES_KEY) ?? [];
}

export function getWorkspaceBySlug(slug: string): RestaurantWorkspace | null {
  return getWorkspaces().find((workspace) => workspace.slug === slug) ?? null;
}

export function getMemberships(): Membership[] {
  return readJson<Membership[]>(MEMBERSHIPS_KEY) ?? [];
}

export function getMembershipForWorkspaceId(restaurantId: string): Membership | null {
  const user = getCurrentUser();
  if (!user) return null;
  return (
    getMemberships().find(
      (membership) => membership.restaurantId === restaurantId && membership.userId === user.id
    ) ?? null
  );
}

export function getMembershipForSlug(slug: string): Membership | null {
  const workspace = getWorkspaceBySlug(slug);
  if (!workspace) return null;
  return getMembershipForWorkspaceId(workspace.id);
}

/** Restaurants the current user actually created or joined — never auto-populated. */
export function getUserWorkspaces(): { workspace: RestaurantWorkspace; membership: Membership }[] {
  const user = getCurrentUser();
  if (!user) return [];
  const memberships = getMemberships().filter((membership) => membership.userId === user.id);
  const workspaces = getWorkspaces();

  return memberships
    .map((membership) => {
      const workspace = workspaces.find((item) => item.id === membership.restaurantId);
      return workspace ? { workspace, membership } : null;
    })
    .filter((entry): entry is { workspace: RestaurantWorkspace; membership: Membership } => entry !== null);
}

export interface CreateRestaurantInput {
  name: string;
  location: string;
  cuisine: string;
  numTables: number;
  numSeats: number;
  posSystem: string;
  role: MembershipRole;
  isDemo?: boolean;
}

/** Creates a new restaurant workspace owned by the current user and a membership with the chosen role. */
export function createRestaurantWorkspace(input: CreateRestaurantInput): RestaurantWorkspace {
  const user = getCurrentUser();
  if (!user) throw new Error("No signed-in user to create a restaurant for.");

  const slug = uniqueSlug(input.name);
  const workspace: RestaurantWorkspace = {
    id: `ws-${slug}-${Date.now().toString(36)}`,
    slug,
    name: input.name,
    location: input.location,
    cuisine: input.cuisine,
    numTables: input.numTables,
    numSeats: input.numSeats,
    posSystem: input.posSystem,
    logo: null,
    ownerUserId: user.id,
    isDemo: input.isDemo ?? false,
  };

  writeJson(WORKSPACES_KEY, [...getWorkspaces(), workspace]);
  writeJson(MEMBERSHIPS_KEY, [
    ...getMemberships(),
    { userId: user.id, restaurantId: workspace.id, role: input.role },
  ]);

  setActiveWorkspace(slug);
  return workspace;
}

/** Creates (or reuses) the single explicit demo restaurant for the current user. Never creates more than one. */
export function createDemoWorkspace(): RestaurantWorkspace {
  const user = getCurrentUser();
  if (!user) throw new Error("No signed-in user to create a demo restaurant for.");

  const existing = getWorkspaces().find((workspace) => workspace.isDemo && workspace.ownerUserId === user.id);
  if (existing) {
    setActiveWorkspace(existing.slug);
    return existing;
  }

  return createRestaurantWorkspace({
    name: DEMO_WORKSPACE_NAME,
    location: "Dubai Marina",
    cuisine: "Italian",
    numTables: 18,
    numSeats: 72,
    posSystem: "Square",
    role: "owner",
    isDemo: true,
  });
}

export function setActiveWorkspace(slug: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, slug);
}

export function getActiveWorkspace(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

/** Clears auth/workspace identity only — uploaded restaurant data stays intact per slug. */
export function logout() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(WORKSPACES_KEY);
  window.localStorage.removeItem(MEMBERSHIPS_KEY);
  window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
}

/** Removes demo workspaces/memberships (not the underlying restaurant data — callers should also
 * clear the scoped data/QR/opportunity stores for each returned slug). Returns the removed slugs. */
export function clearDemoData(): string[] {
  if (typeof window === "undefined") return [];

  const workspaces = getWorkspaces();
  const demoWorkspaces = workspaces.filter((workspace) => workspace.isDemo);
  if (demoWorkspaces.length === 0) return [];

  const demoIds = new Set(demoWorkspaces.map((workspace) => workspace.id));
  const demoSlugs = demoWorkspaces.map((workspace) => workspace.slug);

  writeJson(
    WORKSPACES_KEY,
    workspaces.filter((workspace) => !demoIds.has(workspace.id))
  );
  writeJson(
    MEMBERSHIPS_KEY,
    getMemberships().filter((membership) => !demoIds.has(membership.restaurantId))
  );

  const active = getActiveWorkspace();
  if (active && demoSlugs.includes(active)) {
    window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
  }

  return demoSlugs;
}
