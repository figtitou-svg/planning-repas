"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Notifications } from "@/lib/notifications";
import { expiryStatus } from "@/lib/notificationsView";
import { formatPrice } from "@/lib/formatPrice";
import type { PlannedMeal, Recipe, ShoppingList } from "@/lib/types";
import { localCalendarDateAsUtc, localTodayString, mondayOf, nextWeekStart } from "@/lib/week";
import { formatWeekRange, relativeWeekLabel } from "@/lib/weekLabel";
import { useFetchJson, type FetchState } from "./useFetchJson";

function Block({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="block">
      <div className="block-head">
        <h2>{title}</h2>
        <Link href={href}>{linkLabel}</Link>
      </div>
      {children}
    </section>
  );
}

/** Message commun tant qu'une donnée n'est pas prête. Renvoie null quand tout est chargé. */
function pending(states: FetchState<unknown>[], reload: () => void, what: string) {
  if (states.some((s) => s.status === "error")) {
    return (
      <p className="block-note" role="alert">
        Impossible de charger {what}.{" "}
        <button type="button" className="btn-sm" onClick={reload}>
          Réessayer
        </button>
      </p>
    );
  }
  if (states.some((s) => s.status === "loading")) {
    return (
      <p className="block-note" role="status">
        Chargement…
      </p>
    );
  }
  return null;
}

export function HomeDashboard() {
  // Vide au rendu serveur : la semaine dépend de la date locale du navigateur.
  const [week, setWeek] = useState("");
  useEffect(() => {
    setWeek(nextWeekStart(localCalendarDateAsUtc(new Date())));
  }, []);

  const plan = useFetchJson<PlannedMeal[]>(week ? `/api/plan?week=${week}` : null);
  const recipes = useFetchJson<Recipe[]>(week ? "/api/recipes" : null);
  const list = useFetchJson<ShoppingList>(week ? `/api/shopping-list?week=${week}` : null);
  const checks = useFetchJson<Record<string, boolean>>(week ? `/api/shopping-checks?week=${week}` : null);
  const alerts = useFetchJson<Notifications>(
    week ? `/api/notifications?today=${localTodayString()}` : null
  );

  const currentWeek = mondayOf(localCalendarDateAsUtc(new Date()));

  const menuPending = pending(
    [plan.state, recipes.state],
    () => {
      plan.reload();
      recipes.reload();
    },
    "le menu"
  );
  const listPending = pending(
    [list.state, checks.state],
    () => {
      list.reload();
      checks.reload();
    },
    "la liste de courses"
  );
  const alertsPending = pending([alerts.state], alerts.reload, "les alertes");

  return (
    <main>
      <h1>{week ? relativeWeekLabel(week, currentWeek) : "Cette semaine"}</h1>
      <p className="page-sub">{week ? formatWeekRange(week) : " "}</p>

      <Block title="Au menu" href="/planning" linkLabel="Planning">
        {menuPending ??
          (plan.state.status === "ready" && recipes.state.status === "ready" ? (
            plan.state.data.length === 0 ? (
              <div className="block-empty">
                <p>Rien de programmé pour cette semaine.</p>
                <Link className="btn-link" href="/recettes">
                  Choisir des recettes
                </Link>
              </div>
            ) : (
              <ul className="panel">
                {plan.state.data.map((meal) => {
                  const recipe = (recipes.state.status === "ready" ? recipes.state.data : []).find(
                    (r) => r.id === meal.recipeId
                  );
                  const portions = meal.portions > 0 ? meal.portions : recipe?.portions ?? 1;
                  return (
                    <li key={meal.id} className="row">
                      <div className="row-main">
                        <p className="row-title">{recipe?.name ?? "(recette supprimée)"}</p>
                        <p className="card-meta">
                          {portions} portion{portions > 1 ? "s" : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null)}
      </Block>

      <Block title="À acheter" href="/courses" linkLabel="Ouvrir la liste">
        {listPending ??
          (list.state.status === "ready" && checks.state.status === "ready" ? (
            (() => {
              const lines = list.state.data.groups.flatMap((g) => g.lines);
              if (lines.length === 0) {
                return <p className="block-note">Rien à acheter cette semaine.</p>;
              }
              const done = checks.state.data;
              const remaining = lines.filter((l) => !done[l.ingredientId]);
              const inBasket = lines.length - remaining.length;
              const remainingCost = remaining.reduce((sum, l) => sum + l.lineCost, 0);
              return (
                <div className="panel panel-pad">
                  <p className="basket-summary-main">
                    <strong>
                      {remaining.length === 0
                        ? "Tout est dans le panier"
                        : `${remaining.length} article${remaining.length > 1 ? "s" : ""} à prendre`}
                    </strong>
                    {remaining.length > 0 && <span className="price">{formatPrice(remainingCost)}</span>}
                  </p>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label="Articles dans le panier"
                    aria-valuemin={0}
                    aria-valuemax={lines.length}
                    aria-valuenow={inBasket}
                  >
                    <span style={{ width: `${(inBasket / lines.length) * 100}%` }} />
                  </div>
                  <p className="card-meta">
                    {inBasket} sur {lines.length} dans le panier
                  </p>
                </div>
              );
            })()
          ) : null)}
      </Block>

      <Block title="À surveiller" href="/notifications" linkLabel="Tout voir">
        {alertsPending ??
          (alerts.state.status === "ready" ? (
            alerts.state.data.expiring.length === 0 && alerts.state.data.incomplete.length === 0 ? (
              <p className="block-note">Rien à signaler : le stock est bon.</p>
            ) : (
              <ul className="panel">
                {alerts.state.data.expiring.slice(0, 3).map((item) => (
                  <li key={item.pantryId} className="row">
                    <div className="row-main">
                      <p className="row-title">{item.name}</p>
                    </div>
                    <span className={item.daysLeft < 0 ? "chip chip-danger" : "chip chip-warn"}>
                      {expiryStatus(item.daysLeft)}
                    </span>
                  </li>
                ))}
                {alerts.state.data.incomplete.length > 0 && (
                  <li className="row">
                    <div className="row-main">
                      <p className="row-title">
                        {alerts.state.data.incomplete.length} ingrédient
                        {alerts.state.data.incomplete.length > 1 ? "s" : ""} à compléter
                      </p>
                      <p className="card-meta">Sans taille de paquet, ils sont absents de la liste.</p>
                    </div>
                  </li>
                )}
              </ul>
            )
          ) : null)}
      </Block>
    </main>
  );
}
