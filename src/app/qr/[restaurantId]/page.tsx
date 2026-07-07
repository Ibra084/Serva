import { QRCustomerClient } from "@/app/qr/[restaurantId]/qr-customer-client";

export default async function CustomerQrPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const { restaurantId } = await params;
  const { table } = await searchParams;

  return <QRCustomerClient restaurantId={restaurantId} tableId={table ?? null} />;
}
