"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ShoppingBag, SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import { WelcomeScreen, type WelcomeChoice } from "@/components/qr/welcome-screen";
import { AiAssistantPanel, type ChatMessage } from "@/components/qr/ai-assistant-panel";
import { MenuBrowser } from "@/components/qr/menu-browser";
import { BookletCover } from "@/components/qr/booklet-cover";
import { BookletMenu } from "@/components/qr/booklet-menu";
import { GuestPreferencesSheet } from "@/components/qr/guest-preferences-sheet";
import { BasketBar, BasketSheet } from "@/components/qr/basket-sheet";
import { OrderStatusPanel } from "@/components/qr/order-status-panel";
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
import { markQRInteractionAccepted, saveQRInteraction, saveQROrder, saveQRReview, subscribeToSessionOrders, loadSessionOrders } from "@/lib/qr-store";
import {
  findActiveSessionForTable,
  findTableByNumber,
  getOrCreateActiveSession,
  loadSessionById,
  subscribeToSession,
  updateSessionPaymentStatus,
  updateSessionStatus,
  updateSessionTotal,
} from "@/lib/live-store";
import { processDemoPayment, computeBill } from "@/lib/payment-store";
import { unslugify } from "@/lib/utils";
import { DEFAULT_GUEST_PREFERENCES, type GuestPreferences } from "@/lib/menu-types";
import type { LiveTableSession, MenuItem, QRBasketItem, QROrder, SplitType } from "@/lib/types";

type View = "welcome" | "assistant" | "menu" | "status" | "review" | "thanks";

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
  const [basket, setBasket] = useState<QRBasketItem[]>([]);
  const [basketOpen, setBasketOpen] = useState(false);
  const [specialRequests, setSpecialRequests] = useState("");
  const [lastOrder, setLastOrder] = useState<QROrder | null>(null);
  const [preferences, setPreferences] = useState<GuestPreferences>(DEFAULT_GUEST_PREFERENCES);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [tableRowId, setTableRowId] = useState<string | null>(null);
  const [session, setSession] = useState<LiveTableSession | null>(null);
  const [sessionOrders, setSessionOrders] = useState<QROrder[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  const subtotal = basket.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = basket.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    setPreferences(getGuestPreferences(restaurantId));
  }, [restaurantId]);

  useEffect(() => {
    if (!tableId) return;
    let cancelled = false;
    (async () => {
      const table = await findTableByNumber(restaurantId, tableId);
      if (cancelled || !table) return;
      setTableRowId(table.id);
      const activeSession = await findActiveSessionForTable(restaurantId, table.id);
      if (cancelled) return;
      setSession(activeSession);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, tableId]);

  async function refreshSessionOrders() {
    if (!session) return;
    setSessionOrders(await loadSessionOrders(restaurantId, session.id));
  }

  useEffect(() => {
    if (!session) return;
    refreshSessionOrders();
    const unsubscribeOrders = subscribeToSessionOrders(session.id, refreshSessionOrders);
    const unsubscribeSession = subscribeToSession(session.id, async () => {
      const fresh = await loadSessionById(session.id);
      if (fresh) setSession({ ...fresh, restaurantId });
    });
    return () => {
      unsubscribeOrders();
      unsubscribeSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

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
    setBasket((prev) => {
      const existing = prev.find((entry) => entry.dish === item.dish);
      if (existing) {
        return prev.map((entry) =>
          entry.dish === item.dish ? { ...entry, quantity: entry.quantity + quantity } : entry
        );
      }
      return [...prev, { dish: item.dish, category: item.category, price: item.price, quantity }];
    });
  }

  function addRecommendedToBasket(item: MenuItem, interactionId?: string) {
    addToBasket(item);
    if (!interactionId) return;
    markQRInteractionAccepted(restaurantId, interactionId);
  }

  function changeQuantity(dish: string, quantity: number) {
    setBasket((prev) => {
      if (quantity <= 0) return prev.filter((entry) => entry.dish !== dish);
      return prev.map((entry) => (entry.dish === dish ? { ...entry, quantity } : entry));
    });
  }

  async function submitOrder() {
    if (basket.length === 0) return;
    const recommendedDishSet = new Set(
      messages.flatMap((message) => message.recommendedItems?.map((item) => item.dish) ?? [])
    );
    const aiRecommendedItems = basket
      .map((item) => item.dish)
      .filter((dish) => recommendedDishSet.has(dish));

    let activeSession = session;
    if (tableRowId && !activeSession) {
      activeSession = await getOrCreateActiveSession(restaurantId, tableRowId);
      if (activeSession) setSession(activeSession);
    }

    const order: QROrder = {
      orderId: newId(),
      restaurantId,
      tableId,
      sessionId: activeSession?.id ?? null,
      timestamp: new Date().toISOString(),
      items: basket,
      subtotal,
      source: "qr",
      aiRecommendedItems,
      specialRequests: specialRequests.trim(),
      status: "new",
    };

    const orderRowId = await saveQROrder(restaurantId, order);
    if (activeSession) {
      await updateSessionStatus(restaurantId, activeSession.id, "order_placed");
      await updateSessionTotal(restaurantId, activeSession.id, activeSession.currentTotal + subtotal);
    }
    setLastOrder({ ...order, id: orderRowId ?? undefined });
    setBasket([]);
    setSpecialRequests("");
    setBasketOpen(false);
    setView("status");
  }

  async function requestBill() {
    if (!session) return;
    await updateSessionStatus(restaurantId, session.id, "ready_to_pay");
    setSession({ ...session, status: "ready_to_pay" });
  }

  async function payBill(input: {
    splitType: SplitType;
    splitCount?: number;
    selectedItemIndexes?: number[];
    tipPct?: number;
    tipAmount?: number;
  }) {
    const activeItems = sessionOrders.filter((order) => order.status !== "cancelled").flatMap((order) => order.items);
    if (!session || activeItems.length === 0) return;
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
      tableId: tableRowId,
      sessionId: session.id,
      orderId: lastOrder?.id ?? null,
      bill,
      splitType: input.splitType,
    });

    if (payment) {
      if (input.splitType === "full") {
        await updateSessionStatus(restaurantId, session.id, "paid");
        setSession({ ...session, status: "paid", paymentStatus: "paid" });
      } else {
        await updateSessionPaymentStatus(restaurantId, session.id, "partial");
        setSession({ ...session, paymentStatus: "partial" });
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
      orderId: lastOrder?.orderId ?? null,
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

  if (loading) {
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
            hasActiveSession={Boolean(session)}
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

      {view === "status" && (
        <OrderStatusPanel
          session={session}
          orders={sessionOrders}
          onAddMore={() => setView("menu")}
          onRequestBill={requestBill}
          onPayBill={() => setPaymentOpen(true)}
          onLeaveReview={() => setView("review")}
        />
      )}

      {view === "review" && <ReviewFlow onSubmit={submitReview} />}

      {view === "thanks" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <CheckCircle2 className="size-7" />
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

      {(view === "assistant" || view === "menu") && (
        <BasketBar itemCount={itemCount} subtotal={subtotal} onOpen={() => setBasketOpen(true)} />
      )}

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
        items={sessionOrders.filter((order) => order.status !== "cancelled").flatMap((order) => order.items)}
        guestCount={session?.guestCount ?? 1}
        onPay={payBill}
        paying={paying}
      />
    </div>
  );
}
