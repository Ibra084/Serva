export interface MenuCategory {
  name: string;
  displayOrder: number;
}

export type MenuLayout = "modern" | "compact" | "booklet";
export type CategoryDisplay = "tabs" | "sections" | "booklet";

export interface MenuAppearanceSettings {
  layout: MenuLayout;
  brandColor: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  introText: string | null;
  showPhotos: boolean;
  showAllergens: boolean;
  showPopularity: boolean;
  showAiBox: boolean;
  showPrices: boolean;
  showCalories: boolean;
  categoryDisplay: CategoryDisplay;
}

export const DEFAULT_MENU_APPEARANCE: MenuAppearanceSettings = {
  layout: "modern",
  brandColor: null,
  logoUrl: null,
  coverImageUrl: null,
  introText: null,
  showPhotos: true,
  showAllergens: true,
  showPopularity: true,
  showAiBox: true,
  showPrices: true,
  showCalories: false,
  categoryDisplay: "tabs",
};

export type GuestDietaryPreference = "none" | "vegetarian" | "vegan" | "halal" | "gluten-free";

export type GuestMood = "light" | "very_hungry" | "date_night" | "family" | "healthy" | "comfort" | null;

export interface GuestPreferences {
  dietary: GuestDietaryPreference;
  allergies: string[];
  /** 0 (mild) to 3 (very spicy), or null if the guest hasn't said. */
  spicePreference: number | null;
  budget: number | null;
  mood: GuestMood;
}

export const DEFAULT_GUEST_PREFERENCES: GuestPreferences = {
  dietary: "none",
  allergies: [],
  spicePreference: null,
  budget: null,
  mood: null,
};
