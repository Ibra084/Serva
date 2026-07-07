import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MenuItem, Order } from "@/lib/types";

export const revalidate = 30;

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId: slug } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant) {
    return NextResponse.json({ menu: [], orders: [] }, { status: 404 });
  }

  const [menuRes, ordersRes] = await Promise.all([
    supabase.from("menu_items").select("*").eq("restaurant_id", restaurant.id),
    supabase.from("orders").select("*, order_items(*)").eq("restaurant_id", restaurant.id),
  ]);

  const menu: MenuItem[] = (menuRes.data ?? []).map((row) => ({
    dish: row.dish,
    category: row.category,
    price: num(row.price),
    cost: num(row.cost),
  }));

  const orders: Order[] = (ordersRes.data ?? []).map((row) => ({
    orderId: row.order_id,
    date: row.date ?? "",
    time: row.time ?? "",
    customerId: row.customer_id ?? undefined,
    tableId: row.table_id ?? undefined,
    total: num(row.total),
    items: ((row.order_items ?? []) as Record<string, unknown>[]).map((item) => ({
      dish: item.dish as string,
      category: item.category as string,
      quantity: num(item.quantity),
      price: num(item.price),
      total: num(item.total),
      revenue: num(item.revenue),
      cost: num(item.cost),
    })),
  }));

  return NextResponse.json({ menu, orders });
}
