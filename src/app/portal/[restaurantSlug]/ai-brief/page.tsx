import { BriefClient } from "@/app/portal/[restaurantSlug]/ai-brief/brief-client";

export default async function AiBriefPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <BriefClient restaurantSlug={restaurantSlug} />;
}
