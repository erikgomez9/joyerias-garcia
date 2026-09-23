import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { ReportLayout } from "./layout/ReportLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { PosPage } from "./pages/PosPage";
import { CatalogPage } from "./pages/CatalogPage";
import { ClientsPage } from "./pages/ClientsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { SalesPage } from "./pages/SalesPage";
import { SalesReportPage } from "./pages/SalesReportPage";
import { SettingsPage } from "./pages/SettingsPage";
import { DamagesPage } from "./pages/DamagesPage";
import { WarrantyPage } from "./pages/WarrantyPage";

export default function App() {
  return (
    <Routes>
      <Route path="/reportes" element={<ReportLayout />}>
        <Route index element={<SalesReportPage />} />
      </Route>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="pos" element={<PosPage />} />
        <Route path="catalogo" element={<CatalogPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="ventas" element={<SalesPage />} />
        <Route path="danos" element={<DamagesPage />} />
        <Route path="garantias" element={<WarrantyPage />} />
        <Route path="ajustes" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
