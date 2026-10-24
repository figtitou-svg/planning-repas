// Chaque rayon a sa couleur (variables --cat-1 à --cat-8 dans globals.css) : la liste de
// courses, le stock et le catalogue se lisent d'un coup d'œil, sans étiquette.

const SLOT_COUNT = 8;
const NEUTRAL_SLOT = 8;

// Les catégories créées dans Notion (voir IngredientForm) ; les mots-clés couvrent aussi
// des variantes de nom si vous les renommez.
const KEYWORDS: Array<[RegExp, number]> = [
  [/fruit|legume/, 1],
  [/boucher|poisson|viande/, 2],
  [/lait|laitier|cremerie|fromage|frais/, 3],
  [/surgel/, 4],
  [/epicerie/, 5],
  [/boisson/, 6],
  [/hygiene|entretien|maison/, 7],
  [/^autre/, NEUTRAL_SLOT],
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Numéro de couleur (1 à 8) d'une catégorie ; un nom inconnu reçoit toujours la même couleur. */
export function categoryColorSlot(category: string): number {
  const name = normalize(category);
  for (const [pattern, slot] of KEYWORDS) {
    if (pattern.test(name)) return slot;
  }
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % (SLOT_COUNT - 1)) + 1;
}

export function categoryColorVar(category: string): string {
  return `var(--cat-${categoryColorSlot(category)})`;
}
