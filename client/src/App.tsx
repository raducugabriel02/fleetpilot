import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { LoginPage, RegisterPage } from '@/features/auth/auth-pages';
import { ClientsPage } from '@/features/clients/clients-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { DriversPage } from '@/features/drivers/drivers-page';
import { VehiclesPage } from '@/features/vehicles/vehicles-page';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* AppLayout cere sesiune validă și redirecționează spre /login altfel */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/drivers" element={<DriversPage />} />
          <Route path="/clients" element={<ClientsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
