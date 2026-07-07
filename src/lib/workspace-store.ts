import { createClient } from "@/lib/supabase/client";
import type { Membership, MembershipRole, RestaurantWorkspace, User } from "@/lib/types";

const ACTIVE_WORKSPACE_KEY = "serva_active_workspace";
const DEMO_WORKSPACE_NAME = "Marco's Kitchen";

type RestaurantRow = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  cuisine: string | null;
  num_tables: number | null;
  num_seats: number | null;
  pos_system: string | null;
  logo_url: string | null;
  owner_user_id: string;
  is_demo: boolean;
};

type MembershipRow = {
  user_id: string;
  restaurant_id: string;
  role: MembershipRole;
};

function mapRestaurant(row: RestaurantRow): RestaurantWorkspace {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    location: row.location ?? "",
    cuisine: row.cuisine ?? "",
    numTables: row.num_tables ?? 0,
    numSeats: row.num_seats ?? 0,
    posSystem: row.pos_system ?? "",
    logo: row.logo_url,
    ownerUserId: row.owner_user_id,
    isDemo: row.is_demo,
  };
}

function mapMembership(row: MembershipRow): Membership {
  return { userId: row.user_id, restaurantId: row.restaurant_id, role: row.role };
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

export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Guest",
    email: user.email ?? "",
  };
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}

/** Starts an anonymous Supabase session for the "Continue with demo" entry point. */
export async function loginAsDemoUser(): Promise<User> {
  const supabase = createClient();
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();
  if (existingUser) {
    const current = await getCurrentUser();
    if (current) return current;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error("Failed to start demo session.");
  return { id: data.user.id, name: "Demo User", email: "" };
}

export async function getWorkspaceBySlug(slug: string): Promise<RestaurantWorkspace | null> {
  const supabase = createClient();
  const { data } = await supabase.from("restaurants").select("*").eq("slug", slug).maybeSingle();
  return data ? mapRestaurant(data as RestaurantRow) : null;
}

export async function getMembershipForWorkspaceId(restaurantId: string): Promise<Membership | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("memberships")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", user.id)
    .maybeSingle();
  return data ? mapMembership(data as MembershipRow) : null;
}

export async function getMembershipForSlug(slug: string): Promise<Membership | null> {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return null;
  return getMembershipForWorkspaceId(workspace.id);
}

/** Restaurants the current user actually created or joined — never auto-populated. */
export async function getUserWorkspaces(): Promise<
  { workspace: RestaurantWorkspace; membership: Membership }[]
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("memberships")
    .select("user_id, restaurant_id, role, restaurants(*)")
    .eq("user_id", user.id);
  if (!data) return [];

  return data
    .filter((row) => row.restaurants)
    .map((row) => ({
      workspace: mapRestaurant(row.restaurants as unknown as RestaurantRow),
      membership: mapMembership({ user_id: row.user_id, restaurant_id: row.restaurant_id, role: row.role }),
    }));
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
export async function createRestaurantWorkspace(input: CreateRestaurantInput): Promise<RestaurantWorkspace> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No signed-in user to create a restaurant for.");

  const base = slugify(input.name);
  let slug = base;
  let attempt = 2;
  let row: RestaurantRow | null = null;

  while (!row) {
    const { data, error } = await supabase
      .from("restaurants")
      .insert({
        slug,
        name: input.name,
        location: input.location,
        cuisine: input.cuisine,
        num_tables: input.numTables,
        num_seats: input.numSeats,
        pos_system: input.posSystem,
        logo_url: null,
        owner_user_id: user.id,
        is_demo: input.isDemo ?? false,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        slug = `${base}-${attempt}`;
        attempt += 1;
        continue;
      }
      throw error;
    }
    row = data as RestaurantRow;
  }

  const { error: membershipError } = await supabase
    .from("memberships")
    .insert({ user_id: user.id, restaurant_id: row.id, role: input.role });
  if (membershipError) throw membershipError;

  const workspace = mapRestaurant(row);
  setActiveWorkspace(workspace.slug);
  return workspace;
}

/** Creates (or reuses) the single explicit demo restaurant for the current user. Never creates more than one. */
export async function createDemoWorkspace(): Promise<RestaurantWorkspace> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No signed-in user to create a demo restaurant for.");

  const { data: existing } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("is_demo", true)
    .maybeSingle();

  if (existing) {
    const workspace = mapRestaurant(existing as RestaurantRow);
    setActiveWorkspace(workspace.slug);
    return workspace;
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

/** Signs out the Supabase session and clears local navigation state. */
export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
}

/** Deletes the current user's demo restaurant(s) (cascades to memberships and all restaurant data). Returns the removed slugs. */
export async function clearDemoData(): Promise<string[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: demoWorkspaces } = await supabase
    .from("restaurants")
    .select("id, slug")
    .eq("owner_user_id", user.id)
    .eq("is_demo", true);
  if (!demoWorkspaces || demoWorkspaces.length === 0) return [];

  const ids = demoWorkspaces.map((w) => w.id);
  const slugs = demoWorkspaces.map((w) => w.slug as string);

  await supabase.from("restaurants").delete().in("id", ids);

  const active = getActiveWorkspace();
  if (active && slugs.includes(active) && typeof window !== "undefined") {
    window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
  }

  return slugs;
}
