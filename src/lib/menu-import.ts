export interface ParsedMenuItem {
  category: string;
  dish: string;
  price: number;
}

const ITEM_LINE = /^(.+?)\s*-\s*(\d+(?:\.\d+)?)$/;

/**
 * Parses the "Bulk Paste Menu" format:
 *   Starters
 *   Garlic Bread - 28
 *   Caesar Salad - 48
 *
 *   Mains
 *   Steak Frites - 115
 *
 * A line matching "Name - Price" belongs to the most recent category header;
 * any other non-blank line starts a new category.
 */
export function parseBulkMenuText(text: string): ParsedMenuItem[] {
  const items: ParsedMenuItem[] = [];
  let currentCategory: string | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(ITEM_LINE);
    if (match && currentCategory) {
      const [, dish, priceText] = match;
      const price = Number(priceText);
      if (dish.trim() && Number.isFinite(price)) {
        items.push({ category: currentCategory, dish: dish.trim(), price });
        continue;
      }
    }

    currentCategory = line;
  }

  return items;
}
