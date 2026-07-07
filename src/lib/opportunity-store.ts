import type { OpportunityStatus } from "@/lib/types";

const STATUS_PREFIX = "serva_opportunity_status";

type StatusMap = Record<string, OpportunityStatus>;

export function loadOpportunityStatuses(restaurantSlug: string): StatusMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(`${STATUS_PREFIX}_${restaurantSlug}`);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as StatusMap) : {};
  } catch {
    return {};
  }
}

export function setOpportunityStatus(restaurantSlug: string, id: string, status: OpportunityStatus) {
  if (typeof window === "undefined") return;
  const statuses = loadOpportunityStatuses(restaurantSlug);
  statuses[id] = status;
  window.localStorage.setItem(`${STATUS_PREFIX}_${restaurantSlug}`, JSON.stringify(statuses));
}

export function clearOpportunityStatuses(restaurantSlug: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${STATUS_PREFIX}_${restaurantSlug}`);
}
