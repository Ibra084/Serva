import { DataExplorerClient } from "@/app/portal/[restaurantSlug]/data/data-client";

export default async function DataExplorerPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <DataExplorerClient restaurantSlug={restaurantSlug} />;
}
