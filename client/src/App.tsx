import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { NotFoundPage } from '@/components/not-found';
import { AgentChatPage } from '@/features/agent/agent-chat-page';
import { LoginPage, RegisterPage } from '@/features/auth/auth-pages';
import { ClientsPage } from '@/features/clients/clients-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { DriversPage } from '@/features/drivers/drivers-page';
import { LandingPage } from '@/features/landing/landing-page';
import { TripsPage } from '@/features/trips/trips-page';
import { VehiclesPage } from '@/features/vehicles/vehicles-page';

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
          {/* sub /app userul e deja logat — îl ducem la dashboard, nu pe 404 public */}
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
