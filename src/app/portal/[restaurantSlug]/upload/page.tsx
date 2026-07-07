import { UploadClient } from "@/app/portal/[restaurantSlug]/upload/upload-client";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <UploadClient restaurantSlug={restaurantSlug} />;
}
