import { QrClient } from "@/app/portal/[restaurantSlug]/qr/qr-client";

export default async function QrPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <QrClient restaurantSlug={restaurantSlug} />;
}
