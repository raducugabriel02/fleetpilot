import { useEffect, useState } from 'react';

type ApiStatus = 'loading' | 'ok' | 'error';

export function App() {
  const [status, setStatus] = useState<ApiStatus>('loading');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => setStatus(res.ok ? 'ok' : 'error'))
      .catch(() => setStatus('error'));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-8 text-center shadow-lg">
        <h1 className="text-3xl font-bold">FleetPilot</h1>
        <p className="mt-2 text-slate-400">Dispecerat AI pentru transport marfă</p>
        <p className="mt-6 text-sm">
          API:{' '}
          {status === 'loading' && <span className="text-amber-400">se verifică…</span>}
          {status === 'ok' && <span className="text-emerald-400">conectat ✓</span>}
          {status === 'error' && <span className="text-red-400">indisponibil ✗</span>}
        </p>
      </div>
    </main>
  );
}
