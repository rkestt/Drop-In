import Link from "next/link";

export default function LobbyNotFound() {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 p-6">
      <div className="py-8 text-center">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Lobby non trovata
        </h1>
        <p className="mx-auto mt-1 max-w-60 text-sm text-[var(--text-secondary)]">
          Potrebbe essere stata eliminata o il link non è corretto.
        </p>
        <Link
          href="/lobbies"
          className="mx-auto mt-3 flex min-h-11 w-full max-w-60 items-center justify-center rounded-control bg-[var(--accent)] px-4 font-semibold text-[var(--accent-foreground)]"
        >
          Torna alle lobby
        </Link>
      </div>
    </main>
  );
}
