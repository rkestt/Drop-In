"use client";

import { useState } from "react";

export default function DevButton() {
  if (process.env.NODE_ENV !== "development") return null;

  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await fetch("/api/dev-login");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="fixed bottom-4 left-4 z-[9999] rounded-full bg-purple-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg transition-all duration-200 hover:bg-purple-700 active:scale-95 disabled:opacity-70"
    >
      {loading ? (
        <span className="inline-block animate-pulse">...</span>
      ) : (
        "Dev Login"
      )}
    </button>
  );
}
