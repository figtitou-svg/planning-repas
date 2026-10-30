// Catégories de recettes : une couleur chacune (variables --cat-1 à --cat-8 de globals.css),
// pour reconnaître d'un coup d'œil un dessert d'un plat de viande dans la liste.

export const RECIPE_CATEGORIES = [
  "Apéro",
  "Entrée",
  "Viande",
  "Poisson",
  "Légumes",
  "Féculents",
  "Dessert",
  "Autre",
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

// Couleurs des options créées dans Notion (même teinte que dans l'app).
export const NOTION_OPTION_COLORS: Record<RecipeCategory, string> = {
  Apéro: "purple",
  Entrée: "blue",
  Viande: "red",
  Poisson: "default",
  Légumes: "green",
  Féculents: "yellow",
  Dessert: "pink",
  Autre: "gray",
};

const COLOR_SLOT: Record<RecipeCategory, number> = {
  Légumes: 1,
  Viande: 2,
  Poisson: 3,
  Entrée: 4,
  Féculents: 5,
  Apéro: 6,
  Dessert: 7,
  Autre: 8,
};

export function isRecipeCategory(value: unknown): value is RecipeCategory {
  return typeof value === "string" && (RECIPE_CATEGORIES as readonly string[]).includes(value);
}

/** Catégorie lue dans Notion : une valeur inconnue (option renommée, supprimée) donne « aucune ». */
export function parseRecipeCategory(value: unknown): RecipeCategory | "" {
  return isRecipeCategory(value) ? value : "";
}

/** Couleur CSS d'une catégorie ; sans catégorie, le gris neutre. */
export function recipeCategoryColor(category: string | undefined): string {
  return `var(--cat-${isRecipeCategory(category) ? COLOR_SLOT[category] : COLOR_SLOT.Autre})`;
}

/** `category` d'une requête : absent = pas de changement, "" = effacer, sinon une catégorie connue. */
export function invalidCategory(category: unknown): boolean {
  return category !== undefined && category !== "" && !isRecipeCategory(category);
}
