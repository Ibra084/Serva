export interface User {
  id: string;
  name: string;
  email: string;
}

export interface RestaurantWorkspace {
  id: string;
  slug: string;
  name: string;
  location: string;
  cuisine: string;
  numTables: number;
  numSeats: number;
  posSystem: string;
  logo: string | null;
  ownerUserId: string;
  /** True only for the single explicit "Use Demo Restaurant" workspace, never auto-created. */
  isDemo?: boolean;
}

export type MembershipRole = "owner" | "manager" | "staff" | "consultant";

export interface Membership {
  userId: string;
  restaurantId: string;
  role: MembershipRole;
}

export interface OrderItem {
  dish: string;
  category: string;
  quantity: number;
  /** Unit price, mapped from a `price` or `unit_price` column. */
  price: number;
  /** Line total, mapped from a `total` column when present, else quantity * price. */
  total: number;
  /** Line revenue, mapped from a `revenue` column when present, else falls back to total. */
  revenue: number;
  /** Line cost, mapped from a `cost` column when present, else 0. */
  cost: number;
}

export interface Order {
  orderId: string;
  date: string;
  time: string;
  customerId?: string;
  tableId?: string;
  items: OrderItem[];
  total: number;
}

export interface MenuItem {
  dish: string;
  category: string;
  price: number;
  cost: number;
  /** Present once the item has been created/edited through the Menu Builder; absent for upload-pipeline-only rows. */
  id?: string;
  description?: string;
  imageUrl?: string;
  allergens?: string[];
  dietaryTags?: string[];
  /** 0 (none) to 3 (very spicy). */
  spiceLevel?: number;
  isSignature?: boolean;
  isRecommended?: boolean;
  isAvailable?: boolean;
  isHidden?: boolean;
  availabilityWindow?: { start: string; end: string } | null;
  prepTimeMinutes?: number;
  displayOrder?: number;
}

export interface Review {
  reviewId: string;
  date: string;
  rating: number;
  text: string;
  guestName?: string;
}

export interface TableSession {
  tableId: string;
  date: string;
  seatedTime: string;
  clearedTime: string;
  guests: number;
}

export interface Insight {
  id: string;
  label: string;
  value: string;
  change?: string;
  direction?: "up" | "down" | "flat";
}

export interface Opportunity {
  title: string;
  explanation: string;
  estimatedMonthlyGain: number;
  confidence: number;
  priority: "high" | "medium" | "low";
}

export interface DailyBrief {
  greeting: string;
  whatHappened: string;
  whyRevenueChanged: string;
  bestDish: string;
  worstDish: string;
  missedOpportunity: string;
  recommendedAction: string;
  estimatedMonthlyGain: number;
}

export interface RestaurantData {
  orders: Order[];
  menu: MenuItem[];
  reviews: Review[];
  tables: TableSession[];
  importedAt: string;
}

export interface MenuPerformanceRow {
  dish: string;
  category: string;
  orders: number;
  revenue: number;
  averagePrice: number;
  estimatedMargin: number;
  trend: "up" | "down" | "flat";
  recommendation: string;
}

export interface GuestInsights {
  returningGuestRate: number | null;
  averageSpend: number;
  averageVisitMinutes: number | null;
  satisfactionScore: number | null;
  commonComplaints: string[];
  commonCompliments: string[];
  peakHours: string[];
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  positiveThemes: string[];
  negativeThemes: string[];
  recentReviews: Review[];
  aiSummary: string;
}

export interface DashboardMetrics {
  todayRevenue: number;
  revenueChangePct: number | null;
  guestsToday: number;
  averageBill: number;
  activeTables: number;
  totalTables: number;
  dessertAttachRate: number;
  customerRating: number | null;
  bestSellingDish: string | null;
  worstPerformingDish: string | null;
  predictedMonthlyGain: number;
}

export type UploadFileKind = "orders" | "menu" | "reviews" | "tables" | "restaurant";

export interface DataQualityReport {
  score: number;
  missingValues: number;
  duplicateRows: number;
  invalidRows: number;
  warnings: string[];
  errors: string[];
}

export interface UploadedFileMeta {
  filename: string;
  kind: UploadFileKind;
  fileType: "csv" | "json";
  rowCount: number;
  detectedColumns: string[];
  preview: Record<string, string>[];
  quality: DataQualityReport;
}

export interface UploadBatch {
  id: string;
  name: string;
  importedAt: string;
  files: UploadedFileMeta[];
  status: "processed" | "needs_review" | "failed";
  quality: DataQualityReport;
  data: {
    orders: Order[];
    menu: MenuItem[];
    reviews: Review[];
    tables: TableSession[];
  };
}

export interface SourceTrace {
  description: string;
  calculation: string;
  confidence: number;
  relatedOrderIds: string[];
}

export interface TracedInsight {
  id: string;
  category: "revenue" | "menu" | "customer" | "operations" | "review";
  title: string;
  explanation: string;
  value?: string;
  trend?: "up" | "down" | "flat";
  estimatedMonthlyGain?: number;
  priority?: "high" | "medium" | "low";
  trace: SourceTrace;
}

export type OpportunityCategory =
  | "Dessert Sales"
  | "Pricing"
  | "Promotion"
  | "Staffing"
  | "Table Turnover"
  | "Dish Quality";

export type OpportunityStatus = "new" | "saved" | "dismissed" | "completed";

export interface FeedOpportunity {
  id: string;
  title: string;
  category: OpportunityCategory;
  explanation: string;
  estimatedMonthlyGain: number;
  confidence: number;
  priority: "high" | "medium" | "low";
  sourceData: string;
  status: OpportunityStatus;
}

export type QRIntent =
  | "spicy"
  | "vegetarian"
  | "popular"
  | "cheapest_main"
  | "high_protein"
  | "signature"
  | "allergy"
  | "budget"
  | "pairing"
  | "light_meal"
  | "very_hungry"
  | "dessert"
  | "surprise_me"
  | "full_meal"
  | "page_view"
  | "unknown";

export interface QRInteraction {
  id: string;
  timestamp: string;
  restaurantId: string;
  tableId: string | null;
  question: string;
  intent: QRIntent;
  recommendedItems: string[];
  acceptedRecommendation: boolean;
}

export interface QRBasketItem {
  dish: string;
  category: string;
  price: number;
  quantity: number;
}

export type QROrderStatus = "new" | "completed" | "cancelled";

export interface QROrder {
  orderId: string;
  restaurantId: string;
  tableId: string | null;
  timestamp: string;
  items: QRBasketItem[];
  subtotal: number;
  source: "qr";
  aiRecommendedItems: string[];
  specialRequests: string;
  status: QROrderStatus;
}

export interface QRReview {
  id: string;
  restaurantId: string;
  tableId: string | null;
  orderId: string | null;
  timestamp: string;
  foodRating: number;
  serviceRating: number;
  atmosphereRating: number;
  overallRating: number;
  comment: string;
  aiRecommendationHelpful: boolean | null;
}

export interface QRMetrics {
  qrScans: number;
  aiQuestionsAsked: number;
  recommendationAcceptanceRate: number | null;
  qrOrdersSubmitted: number;
  qrRevenue: number;
  averageBasketValue: number | null;
  topPreferences: { intent: QRIntent; label: string; count: number }[];
  topQuestions: { question: string; count: number }[];
  topRecommendedItems: { dish: string; count: number }[];
  topOrderedItems: { dish: string; count: number }[];
  mostAcceptedRecommendation: { dish: string; count: number } | null;
  itemsAddedAfterRecommendation: { dish: string; count: number }[];
  averageReviewScore: number | null;
}
