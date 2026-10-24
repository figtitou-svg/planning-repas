"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Ingredient, Recipe } from "@/lib/types";
import { formatAmount, formatQuantity } from "@/lib/formatQuantity";
import { formatPrice } from "@/lib/formatPrice";
import { recipeCost } from "@/lib/recipeCost";
import {
  buildDraft,
  type ImportResponse,
  type NewIngredientDraft,
  type RecipeDraft,
} from "@/lib/importDraft";
import { filterRecipes } from "@/lib/recipeFilter";
import { localCalendarDateAsUtc, nextWeekStart } from "@/lib/week";
import { Icon } from "../Icon";
import { SwipeReveal } from "../SwipeReveal";
import { ImportPanel } from "./ImportPanel";
import { RecipeForm, type RecipeFormValues } from "./RecipeForm";
import { SchedulePopup } from "./SchedulePopup";

function formatWeek(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

const SUMMARY_NAMES = 3;
// Au-delà, la recherche et le filtre « favorites » deviennent utiles.
const TOOLS_MIN_RECIPES = 4;
const FAVORITES_FILTER_KEY = "planning-repas:recipes-favorites-only";

function RecipeRow({
  recipe,
  catalog,
  onSchedule,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  recipe: Recipe;
  catalog: Ingredient[];
  onSchedule: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  // Suppression en deux temps : le premier appui demande confirmation, puis se referme seul.
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const names = recipe.ingredients.map(
    (ri) => catalog.find((c) => c.id === ri.ingredientId)?.name ?? "(ingrédient supprimé)"
  );
  const cost = recipeCost(recipe, catalog);
  const extra = names.length - SUMMARY_NAMES;
  const summary =
    names.length === 0
      ? "Aucun ingrédient"
      : `${names.slice(0, SUMMARY_NAMES).join(", ")}${extra > 0 ? ` +${extra}` : ""}`;

  return (
    <SwipeReveal
      variant="schedule"
      onAction={onSchedule}
      className="swipe-reveal-row"
      foregroundClassName="row"
    >
      <div className="row-main">
        <div className="row-head">
          <div className="row-head-text">
            <p className="row-title">{recipe.name}</p>
            <p className="card-meta">
              {recipe.portions} portion{recipe.portions > 1 ? "s" : ""} · {names.length} ingrédient
              {names.length > 1 ? "s" : ""}
              {cost && (
                <span
                  className="recipe-cost"
                  title={cost.complete ? undefined : "Certains ingrédients n'ont pas de prix"}
                >
                  {" "}
                  · {cost.complete ? "≈" : "~"} {formatPrice(cost.perPortion)} / portion
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            className={recipe.favorite ? "icon-btn heart-btn is-favorite" : "icon-btn heart-btn"}
            aria-pressed={recipe.favorite}
            aria-label={
              recipe.favorite
                ? `Retirer ${recipe.name} des favorites`
                : `Ajouter ${recipe.name} aux favorites`
            }
            onClick={onToggleFavorite}
          >
            <Icon name="heart" filled={recipe.favorite} />
          </button>
        </div>
        <details className="row-details">
          <summary>{summary}</summary>
          <ul className="card-ingredients">
            {recipe.ingredients.map((ri, i) => {
              const ingredient = catalog.find((c) => c.id === ri.ingredientId);
              return (
                <li key={i}>
                  <span>{names[i]}</span>
                  <span>
                    {ingredient ? formatAmount(ri.quantity, ingredient.unit) : formatQuantity(ri.quantity)}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
        <div className="row-actions">
          <button className="btn-sm btn-primary" type="button" onClick={onSchedule}>
            <Icon name="calendar" />
            Programmer
          </button>
          <button className="btn-sm" type="button" onClick={onEdit}>
            <Icon name="edit" />
            Modifier
          </button>
          <button
            className={confirming ? "btn-sm btn-danger" : "btn-sm icon-btn btn-danger-ghost"}
            type="button"
            aria-label={confirming ? "Confirmer la suppression" : `Supprimer ${recipe.name}`}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              setConfirming(false);
              onDelete();
            }}
          >
            <Icon name="trash" />
            {confirming && "Confirmer"}
          </button>
        </div>
      </div>
    </SwipeReveal>
  );
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [catalog, setCatalog] = useState<Ingredient[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | undefined>(undefined);
  const [importCount, setImportCount] = useState(0);
  const [scheduling, setScheduling] = useState<Recipe | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Le dernier filtre choisi est retrouvé à la prochaine visite (par appareil).
  useEffect(() => {
    try {
      setFavoritesOnly(localStorage.getItem(FAVORITES_FILTER_KEY) === "1");
    } catch {}
  }, []);

  function chooseFavoritesOnly(value: boolean) {
    setFavoritesOnly(value);
    try {
      localStorage.setItem(FAVORITES_FILTER_KEY, value ? "1" : "0");
    } catch {}
  }

  async function refresh() {
    const [recipesRes, ingredientsRes] = await Promise.all([
      fetch("/api/recipes"),
      fetch("/api/ingredients"),
    ]);
    if (!recipesRes.ok || !ingredientsRes.ok) throw new Error("bad status");
    setRecipes(await recipesRes.json());
    setCatalog(await ingredientsRes.json());
  }

  async function load() {
    setStatus("loading");
    try {
      await refresh();
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function closeForm() {
    setCreating(false);
    setEditingId(null);
    setDraft(undefined);
  }

  async function handleImported(result: ImportResponse) {
    let fresh = catalog;
    try {
      const response = await fetch("/api/ingredients");
      if (response.ok) {
        fresh = await response.json();
        setCatalog(fresh);
      }
    } catch {}
    setDraft(buildDraft(result, fresh));
    setImportCount((count) => count + 1);
    setCreating(true);
  }

  async function createIngredient(item: NewIngredientDraft): Promise<Ingredient> {
    const response = await fetch("/api/ingredients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: item.name.trim(),
        unit: item.unit,
        packageSize: 0,
        packagePrice: 0,
        shelfLifeDays: 0,
        category: "Autre",
      }),
    });
    if (!response.ok) throw new Error("Création de l'ingrédient impossible");
    const created: Ingredient = await response.json();
    setCatalog((current) => [...current, created]);
    return created;
  }

  async function handleCreate(values: RecipeFormValues) {
    const response = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) throw new Error("Création de la recette impossible");
    const created: Recipe = await response.json();
    setRecipes((current) => [...current, created]);
    closeForm();
    setNotice({ text: `${created.name} ajoutée`, error: false });
  }

  async function handleUpdate(id: string, values: RecipeFormValues) {
    const response = await fetch(`/api/recipes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) throw new Error("Modification de la recette impossible");
    setRecipes((current) => current.map((r) => (r.id === id ? { ...r, ...values } : r)));
    closeForm();
    setNotice({ text: `${values.name} mise à jour`, error: false });
  }

  async function handleDelete(id: string) {
    let ok = false;
    try {
      const response = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
      ok = response.ok;
    } catch {
      ok = false;
    }
    if (ok) {
      setRecipes((current) => current.filter((r) => r.id !== id));
    } else {
      setNotice({ text: "Impossible de supprimer cette recette.", error: true });
    }
  }

  // Mise à jour immédiate ; si Notion refuse, on revient en arrière et on le dit.
  async function toggleFavorite(recipe: Recipe) {
    const favorite = !recipe.favorite;
    const apply = (value: boolean) =>
      setRecipes((current) => current.map((r) => (r.id === recipe.id ? { ...r, favorite: value } : r)));
    apply(favorite);
    let ok = false;
    try {
      const response = await fetch(`/api/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite }),
      });
      ok = response.ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      apply(!favorite);
      setNotice({ text: "Impossible de modifier les favorites.", error: true });
    }
  }

  async function handleSchedule(recipe: Recipe, portions: number) {
    const weekStart = nextWeekStart(localCalendarDateAsUtc(new Date()));
    let ok = false;
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, recipeId: recipe.id, portions }),
      });
      ok = response.ok;
    } catch {
      ok = false;
    }
    setScheduling(null);
    setNotice(
      ok
        ? { text: `Programmé pour la semaine du ${formatWeek(weekStart)}`, error: false }
        : { text: "Impossible de programmer cette recette.", error: true }
    );
  }

  const closePopup = useCallback(() => setScheduling(null), []);

  const editing = recipes.find((r) => r.id === editingId);
  const favoriteCount = recipes.filter((r) => r.favorite).length;
  const showTools = recipes.length >= TOOLS_MIN_RECIPES || favoriteCount > 0;
  const visible = useMemo(
    () =>
      filterRecipes(recipes, catalog, {
        query: showTools ? query : "",
        onlyFavorites: showTools && favoritesOnly,
      }),
    [recipes, catalog, query, favoritesOnly, showTools]
  );
  const showForm = creating || editing !== undefined || draft !== undefined;

  return (
    <main>
      <div className="page-head">
        <h1>Recettes</h1>
        {!showForm && (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" />
            Nouvelle recette
          </button>
        )}
      </div>
      <Link className="chip-link" href="/ingredients">
        <Icon name="list" />
        Catalogue d'ingrédients
      </Link>

      {status === "loading" ? (
        <p className="empty-state" role="status">
          Chargement…
        </p>
      ) : status === "error" ? (
        <div className="empty-state error-state" role="alert">
          <p>Impossible de charger les recettes.</p>
          <button type="button" onClick={load}>
            Réessayer
          </button>
        </div>
      ) : (
        <>
          {showForm && (
            <section className="sheet-panel" aria-label={editing ? "Modifier la recette" : "Nouvelle recette"}>
              <h2>{editing ? "Modifier la recette" : "Nouvelle recette"}</h2>
              {!editing && <ImportPanel onImported={handleImported} />}
              {catalog.length === 0 && !draft ? (
                <p className="empty-state">
                  Ajoutez d'abord des ingrédients dans le catalogue.
                  <br />
                  <Link href="/ingredients">Aller au catalogue d'ingrédients</Link>
                </p>
              ) : (
                <RecipeForm
                  key={editing?.id ?? `new-${importCount}`}
                  catalog={catalog}
                  initial={editing}
                  draft={editing ? undefined : draft}
                  createIngredient={createIngredient}
                  onSubmit={(values) =>
                    editing ? handleUpdate(editing.id, values) : handleCreate(values)
                  }
                  onCancel={closeForm}
                />
              )}
            </section>
          )}

          {recipes.length === 0 ? (
            <div className="empty-state">
              <p>Aucune recette pour l'instant.</p>
              {!showForm && (
                <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                  Ajouter une recette
                </button>
              )}
            </div>
          ) : (
            <>
              {showTools && (
                <div className="recipe-tools">
                  <div className="segmented" role="group" aria-label="Afficher">
                    <button
                      type="button"
                      aria-pressed={!favoritesOnly}
                      onClick={() => chooseFavoritesOnly(false)}
                    >
                      Toutes <span className="segmented-count">{recipes.length}</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={favoritesOnly}
                      onClick={() => chooseFavoritesOnly(true)}
                    >
                      <Icon name="heart" filled={favoritesOnly} />
                      Favorites <span className="segmented-count">{favoriteCount}</span>
                    </button>
                  </div>
                  <input
                    type="search"
                    className="recipe-search"
                    placeholder="Rechercher une recette ou un ingrédient…"
                    aria-label="Rechercher une recette ou un ingrédient"
                    autoComplete="off"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              )}
              {visible.length === 0 ? (
                <div className="empty-state">
                  {query.trim() !== "" ? (
                    <p>Aucune recette ne correspond à « {query.trim()} ».</p>
                  ) : (
                    <p>
                      Aucune favorite pour l'instant. Touchez le cœur d'une recette pour la garder ici.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      chooseFavoritesOnly(false);
                    }}
                  >
                    Voir toutes les recettes
                  </button>
                </div>
              ) : (
            <ul className="panel">
              {visible.map((recipe) => (
                <RecipeRow
                  key={recipe.id}
                  recipe={recipe}
                  catalog={catalog}
                  onToggleFavorite={() => toggleFavorite(recipe)}
                  onSchedule={() => setScheduling(recipe)}
                  onEdit={() => {
                    setCreating(false);
                    setDraft(undefined);
                    setEditingId(recipe.id);
                    window.scrollTo({ top: 0 });
                  }}
                  onDelete={() => handleDelete(recipe.id)}
                />
              ))}
            </ul>
              )}
            </>
          )}
        </>
      )}

      <div className="toast-region" role="status">
        {notice && (
          <p className={notice.error ? "notice notice-error" : "notice"}>{notice.text}</p>
        )}
      </div>
      {scheduling && (
        <SchedulePopup
          recipe={scheduling}
          catalog={catalog}
          onConfirm={(portions) => handleSchedule(scheduling, portions)}
          onCancel={closePopup}
        />
      )}
    </main>
  );
}
