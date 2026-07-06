import { createClient } from "@/lib/supabase/server";

export async function getPortalDisplayName() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "Marco's Kitchen";

  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();

  return user.email ?? "Marco's Kitchen";
}
