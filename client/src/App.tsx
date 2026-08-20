import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { NotFoundPage } from '@/components/not-found';
import { LoginPage, RegisterPage } from '@/features/auth/auth-pages';
import { LandingPage } from '@/features/landing/landing-page';

// public (landing/login/register/404) rămân eager — sunt primul lucru încărcat oricum.
// paginile din /app sunt chunk-uri separate (code-splitting): un dispecer care doar
// verifică dashboard-ul nu descarcă și harta Leaflet sau formularele de flotă degeaba.
const AgentChatPage = lazy(() =>
  import('@/features/agent/agent-chat-page').then((m) => ({ default: m.AgentChatPage })),
);
const ClientsPage = lazy(() =>
  import('@/features/clients/clients-page').then((m) => ({ default: m.ClientsPage })),
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })),
);
const DriversPage = lazy(() =>
  import('@/features/drivers/drivers-page').then((m) => ({ default: m.DriversPage })),
);
const ReportsPage = lazy(() =>
  import('@/features/reports/reports-page').then((m) => ({ default: m.ReportsPage })),
);
const TripsPage = lazy(() =>
  import('@/features/trips/trips-page').then((m) => ({ default: m.TripsPage })),
);
const VehiclesPage = lazy(() =>
  import('@/features/vehicles/vehicles-page').then((m) => ({ default: m.VehiclesPage })),
);

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* aplicația: AppLayout cere sesiune validă și redirecționează spre /login altfel */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="agent" element={<AgentChatPage />} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="vehicles" element={<VehiclesPage />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          {/* sub /app userul e deja logat — îl ducem la dashboard, nu pe 404 public */}
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
