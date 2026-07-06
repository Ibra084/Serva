import {
  Sparkles,
  QrCode,
  Download,
  BarChart3,
  UserPlus,
  SlidersHorizontal,
  LineChart,
  Table2,
  Users,
  LayoutGrid,
  Receipt,
  ChefHat,
  Timer,
  Star,
  IceCream2,
  TrendingUp,
  TrendingDown,
  Clock,
  UserCheck,
  Smile,
  ArrowUpRight,
} from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { PortalRevenueChart } from "@/components/portal/revenue-chart";
import { AIBriefTrigger } from "@/components/portal/ai-brief-trigger";
import { getPortalDisplayName } from "@/lib/portal-user";

const quickActions = [
  { label: "View Live Menu", icon: QrCode },
  { label: "Download Report", icon: Download },
  { label: "Export Analytics", icon: BarChart3 },
  { label: "Invite Manager", icon: UserPlus },
];

const miniStats = [
  { label: "Revenue", value: "AED 18,240" },
  { label: "Orders", value: "142" },
  { label: "Average Bill", value: "AED 112" },
  { label: "Guests Today", value: "184" },
];

const periods = ["Yesterday", "Today", "Last Week"];

const snapshot = [
  { name: "Guests Today", value: "184", icon: Users },
  { name: "Active Tables", value: "14 / 18", icon: LayoutGrid },
  { name: "Average Bill", value: "AED 112", icon: Receipt },
  { name: "Best Seller", value: "Steak Frites", icon: ChefHat },
  { name: "Table Turnover", value: "46 min", icon: Timer },
  { name: "Customer Rating", value: "4.8", icon: Star },
];

const opportunities = [
  {
    title: "Increase dessert sales",
    detail: "37 guests skipped dessert last night.",
    metric: "+AED 3,800 / mo",
    icon: IceCream2,
  },
  {
    title: "Raise Truffle Pasta",
    detail: "Current margin allows a AED 2 increase.",
    metric: "92% confidence",
    icon: TrendingUp,
  },
  {
    title: "Peak Hour",
    detail: "Dinner traffic starts 18 minutes earlier on Fridays.",
    metric: "+1 server",
    icon: Clock,
  },
];

const menuRows = [
  { dish: "Steak Frites", orders: 128, revenue: "6,820", margin: "71%", trend: "up", recommendation: "Raise price AED 2" },
  { dish: "Truffle Pasta", orders: 96, revenue: "4,320", margin: "68%", trend: "up", recommendation: "Raise price AED 2" },
  { dish: "Grilled Salmon", orders: 74, revenue: "3,700", margin: "54%", trend: "down", recommendation: "Review supplier cost" },
  { dish: "Caesar Salad", orders: 112, revenue: "2,240", margin: "62%", trend: "up", recommendation: "Bundle with mains" },
  { dish: "Chocolate Fondant", orders: 58, revenue: "1,160", margin: "44%", trend: "down", recommendation: "Promote as upsell" },
];

const guestInsights = [
  { label: "Returning Guests", value: "64%", icon: UserCheck },
  { label: "Average Visit", value: "71 mins", icon: Clock },
  { label: "Dessert Attach Rate", value: "9%", icon: IceCream2 },
  { label: "Customer Satisfaction", value: "4.8★", icon: Smile },
];

export default async function PortalPage() {
  const name = await getPortalDisplayName();

  return (
    <>
      <PortalTopbar name={name} />

      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Good morning, {name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Tuesday · 7:02 AM</p>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-foreground">
          <ArrowUpRight className="size-4 text-primary" />
          Today&rsquo;s service is projected to be{" "}
          <span className="font-medium text-primary">11% busier</span> than last Tuesday.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <AIBriefTrigger
            restaurantName={name}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Sparkles className="size-3.5" />
            Generate AI Brief
          </AIBriefTrigger>
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <action.icon className="size-3.5" />
              {action.label}
            </button>
          ))}
          <button className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <SlidersHorizontal className="size-3.5" />
            Customize
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-primary/15 bg-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">AI Daily Brief</p>
              <p className="text-xs text-muted-foreground">Today, 7:02 AM</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 text-[0.95rem] leading-relaxed text-muted-foreground">
            <p className="text-foreground">Good morning.</p>
            <p>
              Yesterday revenue increased by{" "}
              <span className="font-medium text-primary">12%</span>. Steak Frites generated{" "}
              <span className="font-medium text-foreground">AED 3,240</span>, but 37 customers
              skipped dessert after their main course.
            </p>

            <div className="rounded-2xl bg-accent/50 p-4">
              <p className="text-sm font-medium text-foreground">Recommendation</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Offer dessert within 3 minutes of clearing mains &mdash; estimated at AED 3,800
                in additional revenue this month.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">Predicted monthly gain</p>
            <p className="font-serif text-lg font-medium text-primary">+AED 3,800</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Today&rsquo;s Revenue</p>
              <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                <span className="flex size-7 items-center justify-center rounded-md bg-secondary text-foreground">
                  <LineChart className="size-3.5" />
                </span>
                <span className="flex size-7 items-center justify-center rounded-md text-muted-foreground">
                  <Table2 className="size-3.5" />
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2.5">
              <p className="font-serif text-3xl font-medium tracking-tight text-foreground">
                AED 18,240
              </p>
              <span className="flex items-center gap-0.5 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                <ArrowUpRight className="size-3" />
                +12%
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {miniStats.map((stat) => (
                <div key={stat.label} className="rounded-xl bg-secondary/60 p-3">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 h-40 w-full">
              <PortalRevenueChart />
            </div>

            <div className="mt-4 flex items-center gap-1 rounded-lg bg-secondary/60 p-1 text-sm">
              {periods.map((period) => (
                <button
                  key={period}
                  className={
                    period === "Today"
                      ? "flex-1 rounded-md bg-card px-3 py-1.5 font-medium text-foreground shadow-sm"
                      : "flex-1 rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
                  }
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-medium text-foreground">Today&rsquo;s Snapshot</p>

            <div className="mt-1 flex flex-col divide-y divide-border">
              {snapshot.map((item) => (
                <div key={item.name} className="flex items-center gap-3 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <item.icon className="size-4" />
                  </span>
                  <span className="flex-1 truncate text-sm text-foreground">{item.name}</span>
                  <span className="shrink-0 text-sm font-medium text-foreground">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-foreground">AI Opportunities</h2>

          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            {opportunities.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <item.icon className="size-4" />
                </span>
                <p className="mt-3 text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.detail}
                </p>
                <span className="mt-3 inline-block rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                  {item.metric}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-foreground">Menu Intelligence</h2>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Dish</th>
                  <th className="px-5 py-3 font-medium">Orders</th>
                  <th className="px-5 py-3 font-medium">Revenue</th>
                  <th className="px-5 py-3 font-medium">Margin</th>
                  <th className="px-5 py-3 font-medium">Trend</th>
                  <th className="px-5 py-3 font-medium">AI Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {menuRows.map((row) => (
                  <tr key={row.dish}>
                    <td className="px-5 py-3 font-medium text-foreground">{row.dish}</td>
                    <td className="px-5 py-3 text-foreground">{row.orders}</td>
                    <td className="px-5 py-3 text-foreground">AED {row.revenue}</td>
                    <td className="px-5 py-3 text-foreground">{row.margin}</td>
                    <td className="px-5 py-3">
                      {row.trend === "up" ? (
                        <TrendingUp className="size-4 text-primary" />
                      ) : (
                        <TrendingDown className="size-4 text-destructive" />
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{row.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-foreground">Guest Insights</h2>

          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {guestInsights.map((item) => (
              <div key={item.label} className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <item.icon className="size-4" />
                </span>
                <p className="mt-3 text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 font-serif text-xl font-medium tracking-tight text-foreground">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
