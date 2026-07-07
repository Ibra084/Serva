"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { WelcomeScreen, type WelcomeChoice } from "@/components/qr/welcome-screen";
import { AiAssistantPanel, type ChatMessage } from "@/components/qr/ai-assistant-panel";
import { MenuBrowser } from "@/components/qr/menu-browser";
import { BasketBar, BasketSheet } from "@/components/qr/basket-sheet";
import { ReviewFlow, type ReviewInput } from "@/components/qr/review-flow";
import { useQRMenu } from "@/lib/use-restaurant-data";
import { detectCustomerIntent, recommendMenuItems } from "@/lib/qr-insights";
import { markQRInteractionAccepted, saveQRInteraction, saveQROrder, saveQRReview } from "@/lib/qr-store";
import { unslugify } from "@/lib/utils";
import type { MenuItem, QRBasketItem, QROrder } from "@/lib/types";

type View = "welcome" | "assistant" | "menu" | "confirmation" | "review" | "thanks";

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const STARTER_QUESTION: Record<"recommend" | "allergies", string> = {
  recommend: "What is popular?",
  allergies: "I have a nut allergy",
};

export function QRCustomerClient({
  restaurantId,
  tableId,
}: {
  restaurantId: string;
  tableId: string | null;
}) {
  const { menu, orders, loading, hasData } = useQRMenu(restaurantId);
  const restaurantName = unslugify(restaurantId) || "Serva Restaurant";

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

  const subtotal = basket.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = basket.reduce((sum, item) => sum + item.quantity, 0);

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

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || asking) return;
    const intent = detectCustomerIntent(trimmed);
    const recommended = recommendMenuItems(menu, intent, trimmed, orders);
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

    let text = buildReplyText(intent, recommended);
    try {
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          data: { menu, orders, reviews: [], tables: [], importedAt: new Date().toISOString() },
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

    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "assistant", text, recommendedItems: recommended, interactionId },
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

    const order: QROrder = {
      orderId: newId(),
      restaurantId,
      tableId,
      timestamp: new Date().toISOString(),
      items: basket,
      subtotal,
      source: "qr",
      aiRecommendedItems,
      specialRequests: specialRequests.trim(),
      status: "new",
    };

    await saveQROrder(restaurantId, order);
    setLastOrder(order);
    setBasket([]);
    setSpecialRequests("");
    setBasketOpen(false);
    setView("confirmation");
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
    if (choice === "specific") {
      setView("assistant");
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

  if (!hasData) {
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

      {view === "welcome" && (
        <WelcomeScreen restaurantName={restaurantName} tableId={tableId} onChoose={handleWelcomeChoice} />
      )}

      {view === "assistant" && (
        <AiAssistantPanel
          messages={messages}
          input={chatInput}
          onInputChange={setChatInput}
          onSend={ask}
          onAddToBasket={addRecommendedToBasket}
          sending={asking}
        />
      )}

      {view === "menu" && (
        <MenuBrowser menu={menu} basket={basket} onAdd={addToBasket} onChangeQuantity={changeQuantity} />
      )}

      {view === "confirmation" && lastOrder && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <CheckCircle2 className="size-7" />
          </span>
          <h2 className="font-serif text-xl font-medium tracking-tight text-foreground">Order received.</h2>
          <p className="text-sm text-muted-foreground">
            {lastOrder.items.length} item{lastOrder.items.length === 1 ? "" : "s"} · AED{" "}
            {lastOrder.subtotal.toLocaleString()}
          </p>
          <button
            onClick={() => setView("review")}
            className="mt-3 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            Leave a review
          </button>
          <button
            onClick={() => setView("welcome")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Order again
          </button>
        </div>
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
    </div>
  );
}

function buildReplyText(intent: ReturnType<typeof detectCustomerIntent>, items: MenuItem[]): string {
  const names = items.map((item) => item.dish).join(" or ");

  switch (intent) {
    case "spicy":
      return items.length
        ? `Here's something with a kick: ${names}.`
        : "Nothing's tagged spicy right now, but ask your server to turn up the heat on any dish.";
    case "vegetarian":
      return items.length
        ? `Great vegetarian picks: ${names}.`
        : "We don't have a dedicated vegetarian dish listed — ask your server for a customized option.";
    case "popular":
      return items.length ? `Guest favorites right now: ${names}.` : "We don't have enough order history yet to say what's popular.";
    case "cheapest_main":
      return items.length ? `Your best value main is ${names} at AED ${items[0].price}.` : "We couldn't find a main course to compare.";
    case "high_protein":
      return items.length ? `These pack the most protein: ${names}.` : "Ask your server about our high-protein options.";
    case "signature":
      return items.length ? `Our signature dish is ${names}.` : "Ask your server about tonight's chef special.";
    case "allergy":
      return items.length
        ? `Based on the menu, these don't mention nuts: ${names}. Please double-check with your server, since we can't guarantee full allergen accuracy.`
        : "Please check with your server directly for nut-free options.";
    case "budget":
      return items.length ? `Within that budget, I'd recommend: ${names}.` : "We couldn't find anything in that price range.";
    case "pairing":
      return items.length ? `A lot of guests pair that with ${names}.` : "That pairs well with almost anything on our menu.";
    default:
      return items.length ? `Here's what other guests are loving: ${names}.` : "Tell me more about what you're in the mood for.";
  }
}
