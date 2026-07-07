"use client";

import { Info } from "lucide-react";
import { SheetContent } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOrdersForTrace } from "@/lib/source-trace";
import type { RestaurantData, TracedInsight } from "@/lib/types";

export function ExplainInsightPanel({
  insight,
  data,
}: {
  insight: TracedInsight;
  data: RestaurantData;
}) {
  const relatedOrders = getOrdersForTrace(data, insight.trace.relatedOrderIds).slice(0, 10);

  return (
    <SheetContent title="Explain this insight" description={insight.title}>
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Plain-English explanation</p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">{insight.explanation}</p>
        </div>

        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Source data used</p>
          <p className="mt-1.5 text-sm text-foreground">{insight.trace.description}</p>
        </div>

        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Calculation</p>
          <p className="mt-1.5 rounded-lg bg-secondary/60 px-3 py-2 font-mono text-sm text-foreground">
            {insight.trace.calculation}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Confidence score</p>
            <p className="mt-1.5 font-serif text-xl font-medium text-foreground">{insight.trace.confidence}%</p>
          </div>
          {insight.estimatedMonthlyGain !== undefined && insight.estimatedMonthlyGain > 0 && (
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Estimated gain</p>
              <p className="mt-1.5 font-serif text-xl font-medium text-primary">
                +AED {insight.estimatedMonthlyGain.toLocaleString()}/mo
              </p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Suggested next action</p>
          <p className="mt-1.5 text-sm text-foreground">{insight.title}</p>
        </div>

        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Source rows ({insight.trace.relatedOrderIds.length} related order{insight.trace.relatedOrderIds.length === 1 ? "" : "s"})
          </p>
          {relatedOrders.length > 0 ? (
            <div className="mt-1.5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatedOrders.map((order) => (
                    <TableRow key={order.orderId}>
                      <TableCell className="font-medium">{order.orderId}</TableCell>
                      <TableCell className="text-muted-foreground">{order.date}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.items.map((item) => item.dish).join(", ")}
                      </TableCell>
                      <TableCell>AED {order.total.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Info className="size-3.5" />
              This insight is derived from aggregate data rather than individual orders.
            </p>
          )}
        </div>
      </div>
    </SheetContent>
  );
}
