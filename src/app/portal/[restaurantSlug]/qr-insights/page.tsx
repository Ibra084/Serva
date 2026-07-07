import { QrInsightsClient } from "@/app/portal/[restaurantSlug]/qr-insights/qr-insights-client";

export default async function QrInsightsPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <QrInsightsClient restaurantSlug={restaurantSlug} />;
}
