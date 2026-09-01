"use client";

import { useState } from "react";

type Lobby = {
  id: string;
  start_time: string;
  status: string;
  courts?: { name: string } | null;
};

const TABS = [
  { id: "mine", label: "Le tue lobby" },
  { id: "nearby", label: "Aperte vicine" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function LobbyTabs({ mine, nearby }: { mine: Lobby[]; nearby: Lobby[] }) {
  const [tab, setTab] = useState<TabId>("mine");
  const active = TABS.find((t) => t.id === tab)!;
  const list = tab === "mine" ? mine : nearby;

  return (
    <>
      <h1 className="text-3xl font-bold font-[family-name:var(--font-syne)] mb-6">
        {active.label}
      </h1>
      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {list.length > 0 ? (
        <ul className="space-y-3">
          {list.map((lobby) => (
            <li
              key={lobby.id}
              className="bg-[var(--bg-surface)] rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  {lobby.courts?.name}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {new Date(lobby.start_time).toLocaleString("it-IT")}
                </p>
              </div>
              <span className="text-xs uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-medium">
                {lobby.status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--text-muted)]">
          {tab === "mine"
            ? "Non sei ancora iscritto a nessuna lobby."
            : "Nessuna lobby aperta vicino a te."}
        </p>
      )}
    </>
  );
}