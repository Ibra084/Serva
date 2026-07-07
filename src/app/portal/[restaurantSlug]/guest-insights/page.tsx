import { GuestsClient } from "@/app/portal/[restaurantSlug]/guest-insights/guests-client";

export default async function GuestInsightsPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <GuestsClient restaurantSlug={restaurantSlug} />;
}
