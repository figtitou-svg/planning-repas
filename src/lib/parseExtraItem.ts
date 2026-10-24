import type { Unit } from "./types";

export interface ParsedExtraItem {
  name: string;
  /** Dans l'unité du catalogue (g, mL ou pièce) ; null si aucun nombre n'a été tapé. */
  quantity: number | null;
  unit: Unit | null;
}

// Facteur vers l'unité du catalogue. Un nombre sans unité compte des pièces.
const UNITS: Record<string, { unit: Unit; factor: number }> = {
  kg: { unit: "g", factor: 1000 },
  g: { unit: "g", factor: 1 },
  mg: { unit: "g", factor: 0.001 },
  l: { unit: "mL", factor: 1000 },
  litre: { unit: "mL", factor: 1000 },
  litres: { unit: "mL", factor: 1000 },
  dl: { unit: "mL", factor: 100 },
  cl: { unit: "mL", factor: 10 },
  ml: { unit: "mL", factor: 1 },
  x: { unit: "pièce", factor: 1 },
  pièce: { unit: "pièce", factor: 1 },
  pièces: { unit: "pièce", factor: 1 },
  piece: { unit: "pièce", factor: 1 },
  pieces: { unit: "pièce", factor: 1 },
};

// Un nombre en début de texte, collé à une unité (« 500g ») ou suivi d'une espace (« 6 œufs ») :
// « 7up » reste un nom. L'unité ne doit pas être le début d'un mot (« 2 grosses tomates »).
const QUANTITY = /^(\d+(?:[.,]\d+)?)(?:\s*(kg|mg|g|ml|cl|dl|litres?|l|pièces?|pieces?|x)(?!\p{L})|\s+)(.*)$/iu;
const ARTICLE = /^(?:de\s+la\s+|de\s+l['’]|de\s+|du\s+|des\s+|d['’])/i;

/** « 2 kg de riz » → { name: "riz", quantity: 2000, unit: "g" }. Sans nombre, le texte est le nom. */
export function parseExtraItem(text: string): ParsedExtraItem {
  const clean = text.replace(/\s+/g, " ").trim();
  const match = QUANTITY.exec(clean);
  if (!match) return { name: clean, quantity: null, unit: null };

  const [, rawNumber, rawUnit, rest] = match;
  const name = rest.trim().replace(ARTICLE, "").trim();
  const number = Number(rawNumber.replace(",", "."));
  if (!(number > 0)) return { name, quantity: null, unit: null };

  const { unit, factor } = rawUnit ? UNITS[rawUnit.toLowerCase()] : { unit: "pièce" as const, factor: 1 };
  // Arrondi : 1,1 × 1000 ne doit pas donner 1100.0000000000002.
  return { name, quantity: Math.round(number * factor * 1000) / 1000, unit };
}
