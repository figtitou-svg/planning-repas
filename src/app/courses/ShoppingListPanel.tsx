"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ShoppingList, ShoppingListLine } from "@/lib/types";
import { overlayChecks, type PendingCheck } from "@/lib/checkQueue";
import { categoryColorVar } from "@/lib/categoryColor";
import { formatPrice } from "@/lib/formatPrice";
import { formatAmount } from "@/lib/formatQuantity";
import { localCalendarDateAsUtc, localTodayString, nextWeekStart } from "@/lib/week";
import { formatWeekRange } from "@/lib/weekLabel";
import { normalizeName } from "@/lib/matchIngredients";
import { WeekStepper } from "../WeekStepper";
import { AddItemForm, type AddNotice, type AddTarget } from "./AddItemForm";
import { EditLineRow } from "./EditLineRow";
import { putCheck, useCheckQueue } from "./useCheckQueue";

// La liste se recharge seule tant que l'app est visible : on voit ce que l'autre personne coche.
const POLL_MS = 20_000;

export function ShoppingListPanel() {
  // Vide au rendu serveur / à l'hydratation : la semaine dépend de la date locale du navigateur.
  const [week, setWeek] = useState("");
  const [list, setList] = useState<ShoppingList | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Lignes dont l'ajout au stock est en cours : évite le double ajout au double-tap.
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  // Mode « Modifier » : les articles ajoutés à la main deviennent éditables (quantité, suppression).
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // Articles ajoutés à la main dont la modification ou le retrait est en cours.
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  // Semaine actuellement affichée : sert à ignorer les réponses d'une semaine abandonnée.
  const currentWeek = useRef(week);
  // Coches faites sans réseau : gardées et envoyées dès que la connexion revient.
  const queue = useCheckQueue();
  // Coches envoyées mais pas encore confirmées : le rechargement automatique ne doit pas les écraser.
  const inFlight = useRef(0);
  // Compte les coches faites ici ; si l'une survient pendant un rechargement, ce dernier est écarté.
  const localChanges = useRef(0);
  const syncing = useRef(false);
  // Dernier contenu affiché : un rechargement identique ne redessine rien.
  const lastFingerprint = useRef("");

  async function refresh(requestedWeek: string = week) {
    if (!requestedWeek) return;
    setLoading(true);
    try {
      const [listRes, checksRes] = await Promise.all([
        fetch(`/api/shopping-list?week=${requestedWeek}`),
        fetch(`/api/shopping-checks?week=${requestedWeek}`),
      ]);
      if (!listRes.ok || !checksRes.ok) throw new Error("bad status");
      const nextList: ShoppingList = await listRes.json();
      const nextChecks: Record<string, boolean> = await checksRes.json();
      if (currentWeek.current !== requestedWeek) return;
      const merged = overlayChecks(requestedWeek, nextChecks, queue.read());
      lastFingerprint.current = JSON.stringify([nextList, merged]);
      setList(nextList);
      setChecks(merged);
      setError(null);
    } catch (err) {
      console.error("Failed to load shopping list", requestedWeek, err);
      if (currentWeek.current !== requestedWeek) return;
      setError("Impossible de charger la liste de courses.");
    } finally {
      if (currentWeek.current === requestedWeek) setLoading(false);
    }
  }

  useEffect(() => {
    setWeek(nextWeekStart(localCalendarDateAsUtc(new Date())));
  }, []);

  useEffect(() => {
    if (!week) return;
    currentWeek.current = week;
    refresh(week);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week]);

  // Rechargement discret : pas de « Chargement… », pas de message en cas d'échec (les données
  // affichées restent), et rien n'est redessiné si rien n'a changé.
  async function refreshQuietly() {
    const requestedWeek = currentWeek.current;
    if (!requestedWeek || syncing.current || inFlight.current > 0) return;
    const version = localChanges.current;
    syncing.current = true;
    try {
      // Les coches en attente partent d'abord, pour que le serveur les ait avant qu'on le relise.
      await queue.flush();
      const [listRes, checksRes] = await Promise.all([
        fetch(`/api/shopping-list?week=${requestedWeek}`),
        fetch(`/api/shopping-checks?week=${requestedWeek}`),
      ]);
      if (!listRes.ok || !checksRes.ok) return;
      const nextList: ShoppingList = await listRes.json();
      const nextChecks: Record<string, boolean> = await checksRes.json();
      // Semaine changée ou coche faite entre-temps : cette réponse est déjà périmée.
      if (currentWeek.current !== requestedWeek) return;
      if (localChanges.current !== version || inFlight.current > 0) return;
      const merged = overlayChecks(requestedWeek, nextChecks, queue.read());
      const fingerprint = JSON.stringify([nextList, merged]);
      if (fingerprint === lastFingerprint.current) return;
      lastFingerprint.current = fingerprint;
      setList(nextList);
      setChecks(merged);
    } catch {
      // Hors-ligne ou serveur indisponible : on garde ce qui est affiché.
    } finally {
      syncing.current = false;
    }
  }

  // Toujours la dernière version, sans relancer le minuteur à chaque rendu.
  const quietRefresh = useRef(refreshQuietly);
  quietRefresh.current = refreshQuietly;

  useEffect(() => {
    if (!week) return;
    const tick = () => {
      if (document.visibilityState === "visible") quietRefresh.current();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    // Coches restées en attente d'une session précédente : on tente de les envoyer tout de suite.
    queue.flush();
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
    };
  }, [week, queue.flush]);

  async function toggleCheck(line: ShoppingListLine) {
    const checked = !checks[line.ingredientId];
    const requestedWeek = week;
    const entry: PendingCheck = { weekStart: requestedWeek, ingredientId: line.ingredientId, checked };
    localChanges.current += 1;
    inFlight.current += 1;
    setChecks((current) => ({ ...current, [line.ingredientId]: checked }));
    const result = await putCheck(entry);
    inFlight.current -= 1;
    if (result === "saved") {
      // Le serveur a la valeur la plus récente : une coche plus ancienne en attente n'a plus lieu d'être.
      queue.forget(entry);
    } else if (result === "offline") {
      // Pas de réseau : la coche reste affichée et sera envoyée au retour de la connexion.
      queue.record(entry);
    } else {
      console.error("Failed to save check", line.ingredientId, result);
      if (currentWeek.current === requestedWeek) {
        setChecks((current) => ({ ...current, [line.ingredientId]: !checked }));
      }
    }
  }

  async function addToStock(line: ShoppingListLine) {
    if (addingIds.has(line.ingredientId)) return;
    setAddingIds((current) => new Set(current).add(line.ingredientId));
    try {
      const response = await fetch("/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientId: line.ingredientId,
          quantity: line.missingQuantity,
          purchaseDate: localTodayString(),
        }),
      });
      if (response.ok) {
        await refresh();
      } else {
        console.error("Failed to add to stock", line.ingredientId, response.status);
      }
    } catch (err) {
      console.error("Failed to add to stock", line.ingredientId, err);
    } finally {
      setAddingIds((current) => {
        const next = new Set(current);
        next.delete(line.ingredientId);
        return next;
      });
    }
  }

  async function addItem(target: AddTarget): Promise<AddNotice> {
    const requestedWeek = week;
    const key = normalizeName(target.name);
    // Avec une quantité, un article déjà listé peut quand même être complété (elle s'ajoute).
    const already =
      target.quantity === undefined &&
      lines.some((line) =>
        target.ingredientId !== undefined
          ? line.ingredientId === target.ingredientId
          : normalizeName(line.ingredientName) === key
      );
    if (already) return { text: `${target.name} est déjà dans la liste`, error: false };

    // Un rechargement en cours ne doit pas écraser la liste avec une version d'avant l'ajout.
    localChanges.current += 1;
    try {
      const response = await fetch("/api/shopping-extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: requestedWeek, ...target }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        console.error("Failed to add item", target, response.status);
        return {
          text: body?.error ?? `Impossible d'ajouter ${target.name}, réessayez.`,
          error: true,
        };
      }
      const added: {
        name: string;
        created: boolean;
        unit: string;
        quantity: number | null;
        quantityIgnored?: "unit" | "setup";
      } = await response.json();
      if (currentWeek.current === requestedWeek) await refresh(requestedWeek);
      const label =
        added.quantity === null ? added.name : `${added.name} (${formatAmount(added.quantity, added.unit)})`;
      const notes = [
        added.created ? "créé dans Notion : renseignez son paquet et son prix" : null,
        added.quantityIgnored === "unit"
          ? `sans quantité, l'unité tapée ne correspond pas à celle de ${added.name} (${added.unit})`
          : null,
        added.quantityIgnored === "setup"
          ? "sans quantité, lancez « npm run setup:extras » pour l'activer"
          : null,
      ].filter(Boolean);
      return {
        text: notes.length > 0 ? `${label} ajouté, ${notes.join(" ; ")}.` : `${label} ajouté`,
        error: false,
      };
    } catch (err) {
      console.error("Failed to add item", target, err);
      return {
        text: `Impossible d'ajouter ${target.name} : vérifiez la connexion et réessayez.`,
        error: true,
      };
    }
  }

  async function removeItem(line: ShoppingListLine) {
    if (removingIds.has(line.ingredientId)) return;
    const requestedWeek = week;
    setRemovingIds((current) => new Set(current).add(line.ingredientId));
    localChanges.current += 1;
    try {
      const response = await fetch("/api/shopping-extras", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: requestedWeek, ingredientId: line.ingredientId }),
      });
      if (response.ok) {
        if (currentWeek.current === requestedWeek) await refresh(requestedWeek);
      } else {
        console.error("Failed to remove item", line.ingredientId, response.status);
      }
    } catch (err) {
      console.error("Failed to remove item", line.ingredientId, err);
    } finally {
      setRemovingIds((current) => {
        const next = new Set(current);
        next.delete(line.ingredientId);
        return next;
      });
    }
  }

  async function saveQuantity(line: ShoppingListLine, quantity: number | null) {
    if (removingIds.has(line.ingredientId)) return;
    const requestedWeek = week;
    setRemovingIds((current) => new Set(current).add(line.ingredientId));
    setEditError(null);
    localChanges.current += 1;
    try {
      const response = await fetch("/api/shopping-extras", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: requestedWeek, ingredientId: line.ingredientId, quantity }),
      });
      if (response.ok) {
        if (currentWeek.current === requestedWeek) await refresh(requestedWeek);
      } else {
        const body = await response.json().catch(() => null);
        console.error("Failed to save quantity", line.ingredientId, response.status);
        setEditError(body?.error ?? `Impossible de modifier ${line.ingredientName}, réessayez.`);
      }
    } catch (err) {
      console.error("Failed to save quantity", line.ingredientId, err);
      setEditError(`Impossible de modifier ${line.ingredientName} : vérifiez la connexion et réessayez.`);
    } finally {
      setRemovingIds((current) => {
        const next = new Set(current);
        next.delete(line.ingredientId);
        return next;
      });
    }
  }

  function changeWeek(nextWeek: string) {
    if (nextWeek === week) return;
    // Les données de l'ancienne semaine ne doivent pas rester affichées sous la nouvelle.
    currentWeek.current = nextWeek;
    lastFingerprint.current = "";
    setEditing(false);
    setEditError(null);
    setList(null);
    setChecks({});
    setError(null);
    setWeek(nextWeek);
  }

  const lines = list ? list.groups.flatMap((group) => group.lines) : [];
  const hasManual = lines.some((line) => line.manual);
  // Plus rien à modifier (dernier article supprimé) : on sort du mode.
  const isEditing = editing && hasManual;
  const inBasket = lines.filter((line) => checks[line.ingredientId]);
  const remaining = lines.filter((line) => !checks[line.ingredientId]);
  const remainingCost = remaining.reduce((sum, line) => sum + line.lineCost, 0);
  const unpriced = lines.filter((line) => line.incomplete).length;

  return (
    <>
      <WeekStepper week={week} onChange={changeWeek} />

      {queue.pendingCount > 0 && (
        <p className="sync-banner" role="status">
          {queue.pendingCount} coche{queue.pendingCount > 1 ? "s" : ""} en attente de réseau — envoyée
          {queue.pendingCount > 1 ? "s" : ""} dès que la connexion revient.
        </p>
      )}

      {error && (
        <div className="empty-state error-state" role="alert">
          <p>{error}</p>
          <button type="button" disabled={loading || !week} onClick={() => refresh()}>
            Réessayer
          </button>
        </div>
      )}

      <div role="status">
        {!list && (loading || !error) && <p className="empty-state">Chargement…</p>}
      </div>

      {list && (
        <>
          {lines.length > 0 && (
            <div className="basket-summary">
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
                aria-valuenow={inBasket.length}
              >
                <span style={{ width: `${(inBasket.length / lines.length) * 100}%` }} />
              </div>
              <p className="card-meta">
                {inBasket.length} sur {lines.length} dans le panier
              </p>
            </div>
          )}

          <div className="ticket-wrap">
            <article className="ticket" aria-label="Liste de courses">
              <header className="ticket-head">
                <p className="ticket-title">Courses</p>
                <p className="ticket-week">{formatWeekRange(week)}</p>
                {hasManual && (
                  <button
                    type="button"
                    className="btn-sm ticket-edit-btn"
                    aria-pressed={isEditing}
                    onClick={() => {
                      setEditing(!isEditing);
                      setEditError(null);
                    }}
                  >
                    {isEditing ? "Terminé" : "Modifier"}
                  </button>
                )}
              </header>

              {isEditing && editError && (
                <p className="ticket-add-notice is-error" role="alert">
                  {editError}
                </p>
              )}

              <AddItemForm onAdd={addItem} />

              {lines.length === 0 && (
                <p className="ticket-empty">
                  Rien à acheter pour cette semaine. Planifiez des recettes, vérifiez votre stock ou
                  ajoutez un article ci-dessus.
                </p>
              )}

              {list.groups.map((group) => (
                <section
                  key={group.category}
                  className="ticket-group"
                  style={{ "--cat": categoryColorVar(group.category) } as CSSProperties}
                >
                  <div className="ticket-group-head">
                    <h2>{group.category}</h2>
                    <span className="price">{formatPrice(group.subtotal)}</span>
                  </div>
                  <ul className="ticket-lines">
                    {/* Ce qui est déjà dans le panier descend en bas du rayon. */}
                    {[...group.lines]
                      .sort(
                        (a, b) =>
                          Number(Boolean(checks[a.ingredientId])) -
                          Number(Boolean(checks[b.ingredientId]))
                      )
                      .map((line) => {
                        const checked = Boolean(checks[line.ingredientId]);
                        if (isEditing && line.manual) {
                          return (
                            <EditLineRow
                              // La clé suit la quantité enregistrée : le champ se remet à jour après un rechargement.
                              key={`${line.ingredientId}:${line.extraQuantity ?? ""}`}
                              line={line}
                              busy={removingIds.has(line.ingredientId)}
                              onSaveQuantity={(quantity) => saveQuantity(line, quantity)}
                              onDelete={() => removeItem(line)}
                            />
                          );
                        }
                        return (
                          <li
                            key={line.ingredientId}
                            className={checked ? "ticket-line is-checked" : "ticket-line"}
                          >
                            <label className="ticket-line-main">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCheck(line)}
                              />
                              <span className="ticket-line-text">
                                <span className="ticket-line-top">
                                  <span className="ticket-line-name">{line.ingredientName}</span>
                                  <span className="ticket-dots" aria-hidden="true" />
                                  {line.incomplete ? (
                                    <span className="price">
                                      <span aria-hidden="true">—</span>
                                      <span className="sr-only">prix inconnu</span>
                                    </span>
                                  ) : (
                                    <span className="price">{formatPrice(line.lineCost)}</span>
                                  )}
                                </span>
                                <span className="ticket-line-meta">
                                  {line.incomplete
                                    ? `Ajouté · ${
                                        line.missingQuantity > 0
                                          ? `${formatAmount(line.missingQuantity, line.unit)} · `
                                          : ""
                                      }paquet et prix à renseigner dans Notion`
                                    : `${line.manual ? "Ajouté · " : ""}${line.packagesToBuy} paquet${
                                        line.packagesToBuy > 1 ? "s" : ""
                                      } · ${formatAmount(line.missingQuantity, line.unit)}`}
                                </span>
                              </span>
                            </label>
                            {checked && line.missingQuantity > 0 && (
                              <div className="ticket-line-actions">
                                <button
                                  className="btn-sm ticket-action-btn"
                                  type="button"
                                  disabled={addingIds.has(line.ingredientId)}
                                  onClick={() => addToStock(line)}
                                >
                                  {addingIds.has(line.ingredientId) ? "Ajout…" : "Ajouter au stock"}
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                </section>
              ))}

              {lines.length > 0 && (
                <footer className="ticket-total">
                  <span>Total estimé</span>
                  <span className="price">{formatPrice(list.totalCost)}</span>
                </footer>
              )}
              {unpriced > 0 && (
                <p className="ticket-note">
                  {unpriced} article{unpriced > 1 ? "s" : ""} sans prix, non compté
                  {unpriced > 1 ? "s" : ""} dans le total.
                </p>
              )}
            </article>
          </div>
        </>
      )}
    </>
  );
}
