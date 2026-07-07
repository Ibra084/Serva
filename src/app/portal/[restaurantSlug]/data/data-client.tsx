"use client";

import { useMemo, useState } from "react";
import { Database } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { PortalEmptyState } from "@/components/portal/empty-state";
import { UploadHistoryTable } from "@/components/portal/upload-history-table";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { useRestaurantData, useUploadBatches } from "@/lib/use-restaurant-data";
import { extractThemes, NEGATIVE_KEYWORDS, POSITIVE_KEYWORDS, timeToMinutes } from "@/lib/insights";
import { removeUploadBatchAndRecombine } from "@/lib/data-store";

function useUniqueValues<T>(items: T[], selector: (item: T) => string | undefined) {
  return useMemo(() => {
    const values = new Set<string>();
    for (const item of items) {
      const value = selector(item);
      if (value) values.add(value);
    }
    return Array.from(values).sort();
  }, [items, selector]);
}

function OrdersTab({ data }: { data: NonNullable<ReturnType<typeof useRestaurantData>["data"]> }) {
  const rows = useMemo(
    () =>
      data.orders.flatMap((order) =>
        order.items.map((item, index) => {
          const menuItem = data.menu.find((m) => m.dish === item.dish);
          const cost = menuItem?.cost ?? item.price * 0.35;
          const revenue = item.price * item.quantity;
          const marginValue = revenue - cost * item.quantity;
          return {
            key: `${order.orderId}-${index}`,
            date: order.date,
            time: order.time,
            dish: item.dish,
            category: item.category,
            quantity: item.quantity,
            price: item.price,
            revenue,
            cost: cost * item.quantity,
            margin: marginValue,
            table: order.tableId ?? "—",
            customer: order.customerId ?? "—",
          };
        })
      ),
    [data]
  );

  const [dateFilter, setDateFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dishFilter, setDishFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");

  const dates = useUniqueValues(rows, (row) => row.date);
  const categories = useUniqueValues(rows, (row) => row.category);
  const dishes = useUniqueValues(rows, (row) => row.dish);
  const tables = useUniqueValues(rows, (row) => row.table);
  const customers = useUniqueValues(rows, (row) => row.customer);

  const filtered = rows.filter(
    (row) =>
      (dateFilter === "all" || row.date === dateFilter) &&
      (categoryFilter === "all" || row.category === categoryFilter) &&
      (dishFilter === "all" || row.dish === dishFilter) &&
      (tableFilter === "all" || row.table === tableFilter) &&
      (customerFilter === "all" || row.customer === customerFilter)
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2.5">
        <Select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-auto">
          <option value="all">All dates</option>
          {dates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-auto">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={dishFilter} onChange={(e) => setDishFilter(e.target.value)} className="w-auto">
          <option value="all">All dishes</option>
          {dishes.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} className="w-auto">
          <option value="all">All tables</option>
          {tables.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="w-auto">
          <option value="all">All customers</option>
          {customers.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Dish</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Unit Price</TableHead>
            <TableHead>Revenue</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Margin</TableHead>
            <TableHead>Table</TableHead>
            <TableHead>Customer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row) => (
            <TableRow key={row.key}>
              <TableCell>{row.date}</TableCell>
              <TableCell>{row.time}</TableCell>
              <TableCell className="font-medium">{row.dish}</TableCell>
              <TableCell className="text-muted-foreground">{row.category}</TableCell>
              <TableCell>{row.quantity}</TableCell>
              <TableCell>AED {row.price.toLocaleString()}</TableCell>
              <TableCell>AED {Math.round(row.revenue).toLocaleString()}</TableCell>
              <TableCell>AED {Math.round(row.cost).toLocaleString()}</TableCell>
              <TableCell>AED {Math.round(row.margin).toLocaleString()}</TableCell>
              <TableCell className="text-muted-foreground">{row.table}</TableCell>
              <TableCell className="text-muted-foreground">{row.customer}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MenuTab({ data }: { data: NonNullable<ReturnType<typeof useRestaurantData>["data"]> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dish</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Cost</TableHead>
          <TableHead>Margin %</TableHead>
          <TableHead>Prep Time</TableHead>
          <TableHead>Active</TableHead>
          <TableHead>Signature</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.menu.map((item) => {
          const margin = item.price > 0 ? Math.round(((item.price - item.cost) / item.price) * 100) : 0;
          return (
            <TableRow key={item.dish}>
              <TableCell className="font-medium">{item.dish}</TableCell>
              <TableCell className="text-muted-foreground">{item.category}</TableCell>
              <TableCell>AED {item.price.toLocaleString()}</TableCell>
              <TableCell>AED {item.cost.toLocaleString()}</TableCell>
              <TableCell>{margin}%</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ReviewsTab({ data }: { data: NonNullable<ReturnType<typeof useRestaurantData>["data"]> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Rating</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Review</TableHead>
          <TableHead>Sentiment</TableHead>
          <TableHead>Themes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.reviews.map((review) => {
          const sentiment = review.rating >= 4 ? "Positive" : review.rating === 3 ? "Neutral" : "Negative";
          const themes = [
            ...extractThemes([review], POSITIVE_KEYWORDS),
            ...extractThemes([review], NEGATIVE_KEYWORDS),
          ];
          const title = review.text.split(" ").slice(0, 6).join(" ") + (review.text.split(" ").length > 6 ? "…" : "");
          return (
            <TableRow key={review.reviewId}>
              <TableCell>{review.date}</TableCell>
              <TableCell>{review.rating}★</TableCell>
              <TableCell className="font-medium">{title || "—"}</TableCell>
              <TableCell className="max-w-xs truncate text-muted-foreground">{review.text}</TableCell>
              <TableCell>{sentiment}</TableCell>
              <TableCell className="text-muted-foreground">{themes.join(", ") || "—"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function TablesTab({ data }: { data: NonNullable<ReturnType<typeof useRestaurantData>["data"]> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Table</TableHead>
          <TableHead>Seats</TableHead>
          <TableHead>Party Size</TableHead>
          <TableHead>Start</TableHead>
          <TableHead>End</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Waiter</TableHead>
          <TableHead>Revenue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.tables.map((table, index) => {
          const start = timeToMinutes(table.seatedTime);
          const end = timeToMinutes(table.clearedTime);
          const duration = start !== null && end !== null ? `${end - start} min` : "—";
          const revenue = data.orders
            .filter((order) => order.tableId === table.tableId && order.date === table.date)
            .reduce((sum, order) => sum + order.total, 0);
          return (
            <TableRow key={`${table.tableId}-${table.date}-${index}`}>
              <TableCell className="font-medium">{table.tableId}</TableCell>
              <TableCell>{table.guests}</TableCell>
              <TableCell>{table.guests}</TableCell>
              <TableCell>{table.seatedTime}</TableCell>
              <TableCell>{table.clearedTime}</TableCell>
              <TableCell>{duration}</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell>{revenue > 0 ? `AED ${Math.round(revenue).toLocaleString()}` : "—"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function DataExplorerClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { data, loading, hasData } = useRestaurantData(restaurantSlug);
  const { batches, refresh } = useUploadBatches(restaurantSlug);

  function handleDeleteBatch(id: string) {
    removeUploadBatchAndRecombine(restaurantSlug, id);
    refresh();
  }

  if (loading) {
    return (
      <>
        <PortalTopbar restaurantSlug={restaurantSlug} />
        <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
          <div className="h-64 w-full animate-pulse rounded-2xl bg-secondary" />
        </main>
      </>
    );
  }

  return (
    <>
      <PortalTopbar restaurantSlug={restaurantSlug} />
      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">Imported Data Explorer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inspect exactly what Serva imported — every row, column, and upload.
        </p>

        {!hasData || !data ? (
          <PortalEmptyState
            restaurantSlug={restaurantSlug}
            icon={Database}
            title="Nothing imported yet"
            description="Upload orders, menu, review, or table data to explore it here."
          />
        ) : (
          <div className="mt-5">
            <Tabs defaultValue="orders">
              <TabsList>
                <TabsTab value="orders">Orders</TabsTab>
                <TabsTab value="menu">Menu</TabsTab>
                <TabsTab value="reviews">Reviews</TabsTab>
                <TabsTab value="tables">Tables</TabsTab>
                <TabsTab value="uploads">Uploads</TabsTab>
              </TabsList>
              <TabsPanel value="orders">
                <OrdersTab data={data} />
              </TabsPanel>
              <TabsPanel value="menu">
                <MenuTab data={data} />
              </TabsPanel>
              <TabsPanel value="reviews">
                <ReviewsTab data={data} />
              </TabsPanel>
              <TabsPanel value="tables">
                <TablesTab data={data} />
              </TabsPanel>
              <TabsPanel value="uploads">
                <UploadHistoryTable batches={batches} onDelete={handleDeleteBatch} />
              </TabsPanel>
            </Tabs>
          </div>
        )}
      </main>
    </>
  );
}
