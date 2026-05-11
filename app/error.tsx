"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
        Qualcosa è andato storto
      </h1>
      <p className="text-[var(--text-secondary)] mb-6 text-center">
        {error.message || "Si è verificato un errore inaspettato."}
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 bg-[var(--accent)] text-white rounded-xl font-medium hover:opacity-90 transition"
      >
        Riprova
      </button>
    </div>
  );
}