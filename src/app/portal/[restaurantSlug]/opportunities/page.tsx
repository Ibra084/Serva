import { OpportunitiesClient } from "@/app/portal/[restaurantSlug]/opportunities/opportunities-client";

export default async function OpportunitiesPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <OpportunitiesClient restaurantSlug={restaurantSlug} />;
}
