"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Notifications } from "@/lib/notifications";
import { formatAmount } from "@/lib/formatQuantity";
import { expiryStatus, formatDay, missingText } from "@/lib/notificationsView";
import { localTodayString } from "@/lib/week";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: Notifications };

export default function NotificationsPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        // fresh=1 : cette page doit refléter Notion, pas la copie gardée par le serveur.
        const res = await fetch(`/api/notifications?today=${localTodayString()}&fresh=1`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error("bad status");
        const data: Notifications = await res.json();
        if (!Array.isArray(data.expiring) || !Array.isArray(data.incomplete)) {
          throw new Error("bad payload");
        }
        if (!controller.signal.aborted) setState({ status: "ready", data });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    }
    load();
    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  return (
    <main>
      <h1>Notifications</h1>

      {state.status === "loading" && (
        <p className="empty-state" role="status">
          Chargement…
        </p>
      )}

      {state.status === "error" && (
        <div className="empty-state error-state" role="alert">
          <p>Impossible de charger les notifications.</p>
          <button type="button" onClick={retry}>
            Réessayer
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <section className="block" aria-labelledby="notif-expiring">
            <div className="block-head">
              <h2 id="notif-expiring">Bientôt périmé</h2>
              <Link href="/stock">Ouvrir le stock</Link>
            </div>
            {state.data.expiring.length === 0 ? (
              <p className="block-note">Rien ne périme bientôt.</p>
            ) : (
              <ul className="panel">
                {state.data.expiring.map((item) => (
                  <li key={item.pantryId} className="row">
                    <div className="row-main">
                      <p className="row-title">{item.name}</p>
                      <p className="card-meta">
                        {formatAmount(item.quantity, item.unit)} · péremption estimée le{" "}
                        {formatDay(item.expiryDay) || "—"}
                      </p>
                    </div>
                    <span className={item.daysLeft < 0 ? "chip chip-danger" : "chip chip-warn"}>
                      {expiryStatus(item.daysLeft)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="block" aria-labelledby="notif-incomplete">
            <div className="block-head">
              <h2 id="notif-incomplete">À compléter dans Notion</h2>
            </div>
            <p className="block-note">
              Sans taille de paquet, un ingrédient est ignoré dans la liste de courses.
            </p>
            {state.data.incomplete.length === 0 ? (
              <p className="block-note">Rien à compléter.</p>
            ) : (
              <ul className="panel">
                {state.data.incomplete.map((item) => (
                  <li key={item.ingredientId} className="row">
                    <div className="row-main">
                      <p className="row-title">{item.name}</p>
                      <p className="card-meta">{missingText(item.missing)}</p>
                    </div>
                    <a
                      className="btn-link"
                      href={item.notionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ouvrir dans Notion
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
