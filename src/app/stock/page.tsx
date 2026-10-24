"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { Ingredient, PantryItem } from "@/lib/types";
import { categoryColorVar } from "@/lib/categoryColor";
import { daysBetween, EXPIRY_ALERT_DAYS, expiryDay, toDay } from "@/lib/expiry";
import { formatAmount } from "@/lib/formatQuantity";
import { expiryStatus, formatDay } from "@/lib/notificationsView";
import { localTodayString } from "@/lib/week";
import { Icon } from "../Icon";
import { IngredientCombobox } from "../IngredientCombobox";

interface StockRow {
  item: PantryItem;
  ingredient: Ingredient;
  expiry: string | null;
  daysLeft: number | null;
}

export default function StockPage() {
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [catalog, setCatalog] = useState<Ingredient[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [formOpen, setFormOpen] = useState(false);
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setStatus("loading");
    try {
      const [pantryRes, ingredientsRes] = await Promise.all([
        fetch("/api/pantry"),
        fetch("/api/ingredients"),
      ]);
      if (!pantryRes.ok || !ingredientsRes.ok) throw new Error("bad status");
      const catalogData: Ingredient[] = await ingredientsRes.json();
      setPantry(await pantryRes.json());
      setCatalog(catalogData);
      setIngredientId((current) => current || catalogData[0]?.id || "");
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    setPurchaseDate((current) => current || localTodayString());
    load();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (adding) return;
    setAdding(true);
    setActionError(null);
    try {
      const response = await fetch("/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientId,
          quantity: Number(quantity),
          purchaseDate: purchaseDate || localTodayString(),
        }),
      });
      if (!response.ok) throw new Error("bad status");
      const created: PantryItem = await response.json();
      setPantry((current) => [...current, created]);
      setQuantity("");
      setPurchaseDate(localTodayString());
      setFormOpen(false);
      setNotice("Ajouté au stock");
    } catch {
      setActionError("Impossible d'ajouter cet achat au stock.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    setActionError(null);
    let ok = false;
    try {
      const response = await fetch(`/api/pantry/${id}`, { method: "DELETE" });
      ok = response.ok;
    } catch {
      ok = false;
    }
    if (ok) setPantry((current) => current.filter((item) => item.id !== id));
    else setActionError("Impossible de retirer cet élément du stock.");
  }

  const today = localTodayString();
  const rows: StockRow[] = pantry.flatMap((item) => {
    const ingredient = catalog.find((i) => i.id === item.ingredientId);
    if (!ingredient) return [];
    const purchaseDay = toDay(item.purchaseDate);
    const expiry =
      purchaseDay && ingredient.shelfLifeDays > 0
        ? expiryDay(purchaseDay, ingredient.shelfLifeDays)
        : null;
    return [{ item, ingredient, expiry, daysLeft: expiry ? daysBetween(today, expiry) : null }];
  });
  // Ce qui périme en premier est en haut ; sans date de péremption, en bas.
  rows.sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));

  return (
    <main>
      <h1>Stock</h1>
      {status === "loading" ? (
        <p className="empty-state" role="status">
          Chargement…
        </p>
      ) : status === "error" ? (
        <div className="empty-state error-state" role="alert">
          <p>Impossible de charger le stock.</p>
          <button type="button" onClick={load}>
            Réessayer
          </button>
        </div>
      ) : (
        <>
          <details
            className="fold"
            open={formOpen}
            onToggle={(e) => setFormOpen(e.currentTarget.open)}
          >
            <summary>
              <Icon name="plus" />
              Ajouter un achat
            </summary>
            <form onSubmit={handleAdd} className="pantry-form">
              <div className="field">
                <label htmlFor="pantry-ingredient">Ingrédient</label>
                <IngredientCombobox
                  id="pantry-ingredient"
                  catalog={catalog}
                  value={ingredientId}
                  onChange={setIngredientId}
                />
              </div>
              <div className="form-row form-row-2">
                <div className="field">
                  <label htmlFor="pantry-quantity">Quantité</label>
                  <input
                    id="pantry-quantity"
                    required
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0.01"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="pantry-date">Date d'achat</label>
                  <input
                    id="pantry-date"
                    required
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" disabled={adding}>
                  Ajouter au stock
                </button>
              </div>
            </form>
          </details>

          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}

          {rows.length === 0 ? (
            <p className="empty-state">Le stock est vide pour l'instant.</p>
          ) : (
            <ul className="panel">
              {rows.map(({ item, ingredient, expiry, daysLeft }) => {
                const alert = daysLeft !== null && daysLeft <= EXPIRY_ALERT_DAYS;
                return (
                  <li
                    key={item.id}
                    className="row"
                    style={{ "--cat": categoryColorVar(ingredient.category) } as CSSProperties}
                  >
                    <span className="cat-dot" aria-hidden="true" />
                    <div className="row-main">
                      <p className="row-title">{ingredient.name}</p>
                      <p className="card-meta">
                        {formatAmount(item.quantity, ingredient.unit)}
                        {expiry && !alert ? ` · jusqu'au ${formatDay(expiry)}` : ""}
                      </p>
                      {alert && daysLeft !== null && (
                        <span className={daysLeft < 0 ? "chip chip-danger" : "chip chip-warn"}>
                          {expiryStatus(daysLeft)}
                        </span>
                      )}
                    </div>
                    <button className="btn-sm" type="button" onClick={() => handleRemove(item.id)}>
                      J'ai fini ça
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <div className="toast-region" role="status">
        {notice && <p className="notice">{notice}</p>}
      </div>
    </main>
  );
}
