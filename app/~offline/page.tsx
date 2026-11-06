export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Sei offline</h1>
        <p className="mt-2 text-sm text-gray-600">
          Drop-In ha bisogno della rete per aggiornare i dati. I campi già visitati restano disponibili.
        </p>
      </div>
    </main>
  );
}