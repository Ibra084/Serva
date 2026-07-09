import { LiveClient } from "@/app/portal/[restaurantSlug]/live/live-client";

export default async function LivePage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <LiveClient restaurantSlug={restaurantSlug} />;
}
