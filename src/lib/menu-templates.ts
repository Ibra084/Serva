import type { ParsedMenuItem } from "@/lib/menu-import";

export type MenuTemplateId = "blank" | "italian" | "cafe" | "fast-casual";

export interface MenuTemplateOption {
  id: MenuTemplateId;
  label: string;
  description: string;
}

export const MENU_TEMPLATE_OPTIONS: MenuTemplateOption[] = [
  { id: "blank", label: "Start from blank", description: "No preset items — build from scratch." },
  { id: "italian", label: "Italian restaurant", description: "Antipasti, pasta, mains, dolci." },
  { id: "cafe", label: "Cafe", description: "Coffee, pastries, light bites." },
  { id: "fast-casual", label: "Fast casual", description: "Bowls, sandwiches, sides, drinks." },
];

export const MENU_TEMPLATES: Record<Exclude<MenuTemplateId, "blank">, ParsedMenuItem[]> = {
  italian: [
    { category: "Antipasti", dish: "Bruschetta al Pomodoro", price: 32 },
    { category: "Antipasti", dish: "Burrata e Prosciutto", price: 58 },
    { category: "Pasta", dish: "Spaghetti alle Vongole", price: 78 },
    { category: "Pasta", dish: "Tagliatelle al Tartufo", price: 92 },
    { category: "Mains", dish: "Osso Buco alla Milanese", price: 135 },
    { category: "Mains", dish: "Branzino al Sale", price: 145 },
    { category: "Dolci", dish: "Tiramisu", price: 38 },
    { category: "Dolci", dish: "Panna Cotta", price: 34 },
  ],
  cafe: [
    { category: "Coffee", dish: "Espresso", price: 14 },
    { category: "Coffee", dish: "Flat White", price: 20 },
    { category: "Coffee", dish: "Iced Latte", price: 22 },
    { category: "Pastries", dish: "Butter Croissant", price: 16 },
    { category: "Pastries", dish: "Almond Croissant", price: 20 },
    { category: "Light Bites", dish: "Avocado Toast", price: 36 },
    { category: "Light Bites", dish: "Smoked Salmon Bagel", price: 42 },
  ],
  "fast-casual": [
    { category: "Bowls", dish: "Chicken Teriyaki Bowl", price: 45 },
    { category: "Bowls", dish: "Falafel Grain Bowl", price: 40 },
    { category: "Sandwiches", dish: "Grilled Chicken Wrap", price: 38 },
    { category: "Sandwiches", dish: "Steak Sandwich", price: 48 },
    { category: "Sides", dish: "Sweet Potato Fries", price: 22 },
    { category: "Sides", dish: "House Salad", price: 20 },
    { category: "Drinks", dish: "Fresh Lemonade", price: 18 },
    { category: "Drinks", dish: "Iced Tea", price: 16 },
  ],
};
