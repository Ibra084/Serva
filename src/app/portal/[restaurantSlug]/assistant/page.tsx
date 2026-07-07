import { AssistantClient } from "@/app/portal/[restaurantSlug]/assistant/assistant-client";

export default async function AssistantPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <AssistantClient restaurantSlug={restaurantSlug} />;
}
