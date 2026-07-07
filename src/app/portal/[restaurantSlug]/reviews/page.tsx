import { ReviewsClient } from "@/app/portal/[restaurantSlug]/reviews/reviews-client";

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <ReviewsClient restaurantSlug={restaurantSlug} />;
}
