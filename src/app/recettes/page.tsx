"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Ingredient, Recipe } from "@/lib/types";
import { formatPrice } from "@/lib/formatPrice";
import { recipeCost } from "@/lib/recipeCost";
import {
  buildDraft,
  type ImportResponse,
  type NewIngredientDraft,
  type RecipeDraft,
} from "@/lib/importDraft";
import { filterRecipes } from "@/lib/recipeFilter";
import { groupByCategory, recipeCategoryColor } from "@/lib/recipeCategories";
import { Icon } from "../Icon";
import { ImportPanel } from "./ImportPanel";
import { RecipeForm, type RecipeFormValues } from "./RecipeForm";

const SUMMARY_NAMES = 3;
// Au-delà, la recherche et le filtre « favorites » deviennent utiles.
const TOOLS_MIN_RECIPES = 4;
const FAVORITES_FILTER_KEY = "planning-repas:recipes-favorites-only";

// Toute la ligne est un lien vers la fiche de la recette (ingrédients, instructions, actions).
function RecipeRow({ recipe, catalog }: { recipe: Recipe; catalog: Ingredient[] }) {
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
    <Link
      href={`/recettes/${recipe.id}`}
      className="recipe-link"
      style={{ "--cat": recipeCategoryColor(recipe.category) } as React.CSSProperties}
    >
      <div className="row-main">
        <p className="row-title">{recipe.name}</p>
        <p className="card-meta">
          {recipe.category && <span className="recipe-category">{recipe.category} · </span>}
          {recipe.portions} portion{recipe.portions > 1 ? "s" : ""} · {summary}
          {cost && (
            <span title={cost.complete ? undefined : "Certains ingrédients n'ont pas de prix"}>
              {" "}
              · {cost.complete ? "≈" : "~"} {formatPrice(cost.perPortion)} / portion
            </span>
          )}
        </p>
      </div>
      {recipe.favorite && (
        <span className="recipe-fav" role="img" aria-label="Favorite">
          <Icon name="heart" filled />
        </span>
      )}
    </Link>
  );
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [catalog, setCatalog] = useState<Ingredient[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<RecipeDraft | undefined>(undefined);
  const [importCount, setImportCount] = useState(0);
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
  const showForm = creating || draft !== undefined;

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
            <section className="sheet-panel" aria-label="Nouvelle recette">
              <h2>Nouvelle recette</h2>
              <ImportPanel onImported={handleImported} />
              {catalog.length === 0 && !draft ? (
                <p className="empty-state">
                  Ajoutez d'abord des ingrédients dans le catalogue.
                  <br />
                  <Link href="/ingredients">Aller au catalogue d'ingrédients</Link>
                </p>
              ) : (
                <RecipeForm
                  key={`new-${importCount}`}
                  catalog={catalog}
                  draft={draft}
                  createIngredient={createIngredient}
                  onSubmit={handleCreate}
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
            groupByCategory(visible).map((group) => (
              <section
                key={group.category || "none"}
                className="recipe-group"
                style={{ "--cat": recipeCategoryColor(group.category) } as React.CSSProperties}
              >
                <h2 className="recipe-group-title">
                  {group.category || "Sans catégorie"}{" "}
                  <span className="recipe-group-count">{group.recipes.length}</span>
                </h2>
                <ul className="panel recipe-list">
                  {group.recipes.map((recipe) => (
                    <li key={recipe.id}>
                      <RecipeRow recipe={recipe} catalog={catalog} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
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
    </main>
  );
}
