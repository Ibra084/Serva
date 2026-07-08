/**
 * Named selectors over RestaurantData, re-exported under the names the portal-performance work asked
 * for. These wrap the existing, already-memoized-at-call-site engines rather than rewriting them —
 * `insights.ts`'s `generateOpportunities` and `opportunity-feed.ts`'s `generateOpportunityFeed` are two
 * independently-maintained opportunity engines with different output shapes; consolidating them is a
 * real behavior change to numbers owners already see, so it's intentionally not done here.
 */
export { calculateDashboardMetrics, calculateMenuPerformance } from "@/lib/insights";
export { generateOpportunityFeed as calculateOpportunities } from "@/lib/opportunity-feed";
export { calculateQRMetrics as calculateQRInsights } from "@/lib/qr-insights";
