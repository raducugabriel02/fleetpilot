import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { App } from './App';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/features/auth/auth-context';
import { ApiError } from '@/lib/api';
import 'leaflet/dist/leaflet.css';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // erorile 4xx sunt definitive (validare, drepturi); reîncercăm doar 5xx/rețea
      retry: (failureCount, error) =>
        error instanceof ApiError && error.status < 500 ? false : failureCount < 2,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Elementul #root lipsește din index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
        <Toaster position="top-right" richColors />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
