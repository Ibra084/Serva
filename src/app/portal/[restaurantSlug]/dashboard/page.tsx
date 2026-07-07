import { DashboardClient } from "@/app/portal/[restaurantSlug]/dashboard/dashboard-client";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <DashboardClient restaurantSlug={restaurantSlug} />;
}
