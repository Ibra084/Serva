"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ShoppingBag, SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import { WelcomeScreen, type WelcomeChoice } from "@/components/qr/welcome-screen";
import { AiAssistantPanel, type ChatMessage } from "@/components/qr/ai-assistant-panel";
import { MenuBrowser } from "@/components/qr/menu-browser";
import { BookletCover } from "@/components/qr/booklet-cover";
import { BookletMenu } from "@/components/qr/booklet-menu";
import { GuestPreferencesSheet } from "@/components/qr/guest-preferences-sheet";
import { BasketBar, BasketSheet } from "@/components/qr/basket-sheet";
import { OrderStatusPanel } from "@/components/qr/order-status-panel";
import { BillView } from "@/components/qr/bill-view";
import { PaymentModal } from "@/components/qr/payment-modal";
import { ReviewFlow, type ReviewInput } from "@/components/qr/review-flow";
import { useQRMenu } from "@/lib/use-restaurant-data";
import {
  buildItemReason,
  buildWaiterReply,
  detectConsumerIntent,
  getGuestPreferences,
  recommendForGuest,
  saveGuestPreferences,
} from "@/lib/consumer-ai";
import { syncGuestPreferences } from "@/lib/guest-preferences-store";
import { markQRInteractionAccepted, saveQRInteraction, saveQRReview, subscribeToSessionOrders } from "@/lib/qr-store";
import { subscribeToSession, updateSessionPaymentStatus } from "@/lib/live-store";
import { processDemoPayment, computeBill } from "@/lib/payment-store";
import {
  addCartItem,
  cancelSubmittedOrder,
  clearCart,
  editSubmittedOrder,
  getOrCreateActiveSession,
  markPaid,
  refreshSession,
  requestBill as requestBillAction,
  saveSession,
  submitCartAsOrder,
  subscribeToTableSession,
  updateCartItem,
  type TableSessionState,
} from "@/lib/table-session-store";
import { unslugify } from "@/lib/utils";
import { DEFAULT_GUEST_PREFERENCES, type GuestPreferences } from "@/lib/menu-types";
import type { MenuItem, QRBasketItem, SplitType } from "@/lib/types";

type View = "welcome" | "assistant" | "menu" | "status" | "bill" | "review" | "thanks";

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const STARTER_QUESTION: Record<"allergies", string> = {
  allergies: "I have a nut allergy",
};

export function QRCustomerClient({
  restaurantId,
  tableId,
}: {
  restaurantId: string;
  tableId: string | null;
}) {
  const { menu, orders, appearance, totalItemCount, loading, hasData } = useQRMenu(restaurantId);
  const restaurantName = unslugify(restaurantId) || "Serva Restaurant";
  const isBooklet = appearance.layout === "booklet";

  const [view, setView] = useState<View>("welcome");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "intro",
      role: "assistant",
      text: "Hi! Ask me about spice level, dietary needs, budget, or what pairs well with a dish.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [basketOpen, setBasketOpen] = useState(false);
  const [specialRequests, setSpecialRequests] = useState("");
  const [preferences, setPreferences] = useState<GuestPreferences>(DEFAULT_GUEST_PREFERENCES);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  // Table-session-backed cart/order state, persisted to localStorage + Supabase and restored on reload.
  const [tableSession, setTableSession] = useState<TableSessionState | null>(null);
  const [sessionLoading, setSessionLoading] = useState(Boolean(tableId));
  const [initialViewApplied, setInitialViewApplied] = useState(false);

  // Fallback, non-persistent cart for the rare case of no `table` query param (nothing to scope a session by).
  const [fallbackBasket, setFallbackBasket] = useState<QRBasketItem[]>([]);

  const basket = tableId ? (tableSession?.cartItems ?? []) : fallbackBasket;
  const subtotal = basket.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = basket.reduce((sum, item) => sum + item.quantity, 0);
  const hasSubmittedOrders = Boolean(
    tableSession?.submittedOrders.some((order) => order.status !== "cancelled")
  );

  useEffect(() => {
    setPreferences(getGuestPreferences(restaurantId));
  }, [restaurantId]);

  useEffect(() => {
    if (!tableId) {
      setSessionLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const state = await getOrCreateActiveSession(restaurantId, tableId);
      if (cancelled) return;
      setTableSession(state);
      setSessionLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, tableId]);

  // Choose the customer's landing state once, on load/reload — never overrides a manual navigation afterward.
  useEffect(() => {
    if (!tableId || sessionLoading || initialViewApplied || !tableSession) return;
    setInitialViewApplied(true);
    if (tableSession.paymentStatus === "paid" || hasSubmittedOrders) {
      setView("status");
    }
  }, [tableId, sessionLoading, initialViewApplied, tableSession, hasSubmittedOrders]);

  // Reflects staff-driven changes (marking preparing/served/paid, requesting bill) onto this device.
  useEffect(() => {
    if (!tableSession?.dbSessionId) return;
    const dbSessionId = tableSession.dbSessionId;
    const sessionId = tableSession.sessionId;
    async function refresh() {
      setTableSession(await refreshSession(sessionId));
    }
    const unsubscribeOrders = subscribeToSessionOrders(dbSessionId, refresh);
    const unsubscribeSession = subscribeToSession(dbSessionId, refresh);
    return () => {
      unsubscribeOrders();
      unsubscribeSession();
    };
  }, [tableSession?.dbSessionId, tableSession?.sessionId]);

  // Cross-tab local demo sync — a second tab/device open at the same table sees cart/order edits.
  useEffect(() => {
    if (!tableSession) return;
    const sessionId = tableSession.sessionId;
    return subscribeToTableSession(sessionId, async () => {
      setTableSession(await refreshSession(sessionId));
    });
  }, [tableSession?.sessionId]);

  useEffect(() => {
    saveQRInteraction(restaurantId, {
      id: newId(),
      timestamp: new Date().toISOString(),
      restaurantId,
      tableId,
      question: "",
      intent: "page_view",
      recommendedItems: [],
      acceptedRecommendation: false,
    });
    // Logs one QR "scan" per page load — intentionally omits restaurantId/tableId
    // from deps since re-running on their change would double-count the same visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function savePreferences(prefs: GuestPreferences) {
    setPreferences(prefs);
    saveGuestPreferences(restaurantId, prefs);
    syncGuestPreferences(restaurantId, prefs);
  }

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || asking) return;
    const intent = detectConsumerIntent(trimmed);
    const recommended = recommendForGuest(menu, intent, trimmed, preferences, orders);
    const interactionId = newId();

    saveQRInteraction(restaurantId, {
      id: interactionId,
      timestamp: new Date().toISOString(),
      restaurantId,
      tableId,
      question: trimmed,
      intent,
      recommendedItems: recommended.map((item) => item.dish),
      acceptedRecommendation: false,
    });

    setMessages((prev) => [...prev, { id: newId(), role: "user", text: trimmed }]);
    setChatInput("");
    setView("assistant");
    setAsking(true);

    let text = buildWaiterReply(intent, recommended, preferences);
    try {
      const response = await fetch("/api/ai/consumer-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          menu,
          orders,
          guestPreferences: preferences,
          restaurantName,
        }),
      });
      if (response.ok) {
        const result = (await response.json()) as { answer?: string };
        if (result.answer) text = result.answer;
      }
    } catch {
      // fall back to the locally generated reply below
    } finally {
      setAsking(false);
    }

    const reasons = Object.fromEntries(recommended.map((item) => [item.dish, buildItemReason(item, intent, preferences)]));

    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "assistant", text, recommendedItems: recommended, reasons, interactionId },
    ]);
  }

  function addToBasket(item: MenuItem, quantity = 1) {
    const basketItem: QRBasketItem = { dish: item.dish, category: item.category, price: item.price, quantity };
    if (tableId && tableSession) {
      setTableSession(addCartItem(tableSession.sessionId, basketItem));
      return;
    }
    setFallbackBasket((prev) => {
      const existing = prev.find((entry) => entry.dish === item.dish);
      if (existing) {
        return prev.map((entry) =>
          entry.dish === item.dish ? { ...entry, quantity: entry.quantity + quantity } : entry
        );
      }
      return [...prev, basketItem];
    });
  }

  function addRecommendedToBasket(item: MenuItem, interactionId?: string) {
    addToBasket(item);
    if (!interactionId) return;
    markQRInteractionAccepted(restaurantId, interactionId);
  }

  function changeQuantity(dish: string, quantity: number) {
    if (tableId && tableSession) {
      setTableSession(updateCartItem(tableSession.sessionId, dish, quantity));
      return;
    }
    setFallbackBasket((prev) => {
      if (quantity <= 0) return prev.filter((entry) => entry.dish !== dish);
      return prev.map((entry) => (entry.dish === dish ? { ...entry, quantity } : entry));
    });
  }

  function clearBasket() {
    if (tableId && tableSession) {
      setTableSession(clearCart(tableSession.sessionId));
      return;
    }
    setFallbackBasket([]);
  }

  async function submitOrder() {
    if (basket.length === 0) return;
    const recommendedDishSet = new Set(
      messages.flatMap((message) => message.recommendedItems?.map((item) => item.dish) ?? [])
    );
    const aiRecommendedItems = basket.map((item) => item.dish).filter((dish) => recommendedDishSet.has(dish));

    if (tableId && tableSession) {
      const next = await submitCartAsOrder(tableSession.sessionId, {
        specialRequests,
        aiRecommendedItems,
      });
      setTableSession(next);
    }

    setSpecialRequests("");
    setBasketOpen(false);
    setView("status");
  }

  function editOrderItem(orderId: string, dish: string, quantity: number) {
    if (!tableSession) return;
    const order = tableSession.submittedOrders.find((entry) => entry.orderId === orderId);
    if (!order) return;
    const updatedItems =
      quantity <= 0
        ? order.items.filter((entry) => entry.dish !== dish)
        : order.items.map((entry) => (entry.dish === dish ? { ...entry, quantity } : entry));
    void editSubmittedOrder(tableSession.sessionId, orderId, updatedItems).then(setTableSession);
  }

  function cancelOrder(orderId: string) {
    if (!tableSession) return;
    void cancelSubmittedOrder(tableSession.sessionId, orderId).then(setTableSession);
  }

  async function requestBill() {
    if (!tableSession) return;
    setTableSession(await requestBillAction(tableSession.sessionId));
  }

  async function payBill(input: {
    splitType: SplitType;
    splitCount?: number;
    selectedItemIndexes?: number[];
    tipPct?: number;
    tipAmount?: number;
  }) {
    if (!tableSession) return;
    const activeItems = tableSession.submittedOrders
      .filter((order) => order.status !== "cancelled")
      .flatMap((order) => order.items);
    if (activeItems.length === 0) return;
    setPaying(true);
    const bill = computeBill({
      items: activeItems,
      splitType: input.splitType,
      splitCount: input.splitCount,
      selectedItemIndexes: input.selectedItemIndexes,
      tipPct: input.tipPct,
      tipAmount: input.tipAmount,
    });

    const payment = await processDemoPayment({
      restaurantSlug: restaurantId,
      tableId: tableSession.tableRowId,
      sessionId: tableSession.dbSessionId,
      orderId: tableSession.submittedOrders[0]?.id ?? null,
      bill,
      splitType: input.splitType,
    });

    if (payment) {
      if (input.splitType === "full") {
        setTableSession(await markPaid(tableSession.sessionId));
      } else if (tableSession.dbSessionId) {
        await updateSessionPaymentStatus(restaurantId, tableSession.dbSessionId, "partial");
        setTableSession(saveSession({ ...tableSession, paymentStatus: "partial" }));
      }
    }
    setPaying(false);
    setPaymentOpen(false);
  }

  async function submitReview(input: ReviewInput) {
    await saveQRReview(restaurantId, {
      id: newId(),
      restaurantId,
      tableId,
      orderId: tableSession?.submittedOrders[0]?.orderId ?? null,
      timestamp: new Date().toISOString(),
      foodRating: input.foodRating,
      serviceRating: input.serviceRating,
      atmosphereRating: input.atmosphereRating,
      overallRating: input.overallRating,
      comment: input.comment.trim(),
      aiRecommendationHelpful: input.aiRecommendationHelpful,
    });
    setView("thanks");
  }

  function handleWelcomeChoice(choice: WelcomeChoice) {
    if (choice === "browse") {
      setView("menu");
      return;
    }
    if (choice === "choose") {
      setView("assistant");
      return;
    }
    if (choice === "bill") {
      setView("status");
      return;
    }
    ask(STARTER_QUESTION[choice]);
  }

  if (loading || sessionLoading) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (totalItemCount === 0) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <UtensilsCrossed className="size-6" />
        </span>
        <p className="font-serif text-lg font-medium tracking-tight text-foreground">Menu coming soon</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          {restaurantName} hasn&rsquo;t uploaded a menu yet. If you&rsquo;re the owner, upload your menu data in the
          Serva portal to activate this QR experience.
        </p>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <UtensilsCrossed className="size-6" />
        </span>
        <p className="font-serif text-lg font-medium tracking-tight text-foreground">Menu is not available yet</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          {restaurantName}&rsquo;s menu is being updated. Please check with your server for today&rsquo;s offerings.
        </p>
      </div>
    );
  }

  const showChrome = view !== "welcome";
  const showBasketBar = (view === "assistant" || view === "menu" || view === "welcome") && itemCount > 0;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col bg-background">
      {showChrome && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <button
            onClick={() => setView("welcome")}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            {restaurantName}
          </button>
          {tableId && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Table {tableId}
            </span>
          )}
          <button
            onClick={() => setBasketOpen(true)}
            className="relative flex size-8 items-center justify-center rounded-full text-foreground hover:bg-secondary"
            aria-label="Open basket"
          >
            <ShoppingBag className="size-4" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-medium text-primary-foreground">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      )}

      {view === "welcome" &&
        (isBooklet ? (
          <BookletCover
            restaurantName={restaurantName}
            tableId={tableId}
            appearance={appearance}
            onViewMenu={() => setView("menu")}
            onAskAi={() => setView("assistant")}
          />
        ) : (
          <WelcomeScreen
            restaurantName={restaurantName}
            tableId={tableId}
            hasActiveSession={hasSubmittedOrders}
            onChoose={handleWelcomeChoice}
          />
        ))}

      {view === "assistant" && appearance.showAiBox && (
        <AiAssistantPanel
          messages={messages}
          input={chatInput}
          onInputChange={setChatInput}
          onSend={ask}
          onAddToBasket={addRecommendedToBasket}
          sending={asking}
          onOpenPreferences={() => setPreferencesOpen(true)}
        />
      )}

      {view === "menu" &&
        (isBooklet ? (
          <BookletMenu menu={menu} basket={basket} onAdd={addToBasket} onChangeQuantity={changeQuantity} appearance={appearance} />
        ) : (
          <MenuBrowser
            menu={menu}
            basket={basket}
            onAdd={addToBasket}
            onChangeQuantity={changeQuantity}
            appearance={appearance}
            dense={appearance.layout === "compact"}
          />
        ))}

      {view === "status" && tableSession && (
        <OrderStatusPanel
          tableSession={tableSession}
          onAddMore={() => setView("menu")}
          onViewBill={() => setView("bill")}
          onRequestBill={requestBill}
          onPayBill={() => setPaymentOpen(true)}
          onLeaveReview={() => setView("review")}
          onEditOrderItem={editOrderItem}
          onCancelOrder={cancelOrder}
        />
      )}

      {view === "bill" && tableSession && (
        <BillView tableSession={tableSession} onBack={() => setView("status")} onPay={() => setPaymentOpen(true)} />
      )}

      {view === "review" && <ReviewFlow onSubmit={submitReview} />}

      {view === "thanks" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <ShoppingBag className="size-7" />
          </span>
          <h2 className="font-serif text-xl font-medium tracking-tight text-foreground">Thank you!</h2>
          <p className="text-sm text-muted-foreground">Your feedback helps {restaurantName} improve.</p>
          <button
            onClick={() => setView("welcome")}
            className="mt-3 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            Done
          </button>
        </div>
      )}

      {showBasketBar && <BasketBar itemCount={itemCount} subtotal={subtotal} onOpen={() => setBasketOpen(true)} />}

      {view === "welcome" && !showChrome && (
        <button
          onClick={() => setPreferencesOpen(true)}
          className="fixed right-4 bottom-6 z-10 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-secondary"
        >
          <SlidersHorizontal className="size-3.5" />
          Preferences
        </button>
      )}

      <BasketSheet
        open={basketOpen}
        onOpenChange={setBasketOpen}
        basket={basket}
        subtotal={subtotal}
        specialRequests={specialRequests}
        onSpecialRequestsChange={setSpecialRequests}
        onChangeQuantity={changeQuantity}
        onClearBasket={clearBasket}
        onSubmit={submitOrder}
      />

      <GuestPreferencesSheet
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        preferences={preferences}
        onSave={savePreferences}
      />

      <PaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        items={tableSession?.submittedOrders.filter((order) => order.status !== "cancelled").flatMap((order) => order.items) ?? []}
        guestCount={1}
        onPay={payBill}
        paying={paying}
      />
    </div>
  );
}
