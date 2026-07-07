import { Suspense } from "react";
import { SimulatorClient } from "@/app/portal/[restaurantSlug]/simulator/simulator-client";

export default async function SimulatorPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return (
    <Suspense>
      <SimulatorClient restaurantSlug={restaurantSlug} />
    </Suspense>
  );
}
