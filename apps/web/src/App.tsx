import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { AdminRoute, ProtectedRoute } from "./components/ProtectedRoute.js";
import { LandingPage } from "./pages/LandingPage.js";
import { AuthPage } from "./pages/AuthPage.js";
import { EcosystemPage } from "./pages/EcosystemPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { PoolsPage } from "./pages/PoolsPage.js";
import { ApplicationsPage } from "./pages/ApplicationsPage.js";
import { AgentsPage } from "./pages/AgentsPage.js";
import { TransactionsPage } from "./pages/TransactionsPage.js";
import { AuditPage } from "./pages/AuditPage.js";
import { AssistantPage } from "./pages/AssistantPage.js";
import { WalletProvider } from "./context/WalletContext.js";
import { AuthProvider } from "./context/AuthContext.js";

const SecurityPage = React.lazy(() => import("./pages/SecurityPage.js").then(({ SecurityPage }) => ({ default: SecurityPage })));

const AppRoutes: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<Navigate to="/register/student" replace />} />
        <Route path="/register/student" element={<AuthPage />} />
        <Route path="/register/admin" element={<AuthPage />} />
        <Route path="/pools" element={<PoolsPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/ecosystem" element={<EcosystemPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route element={<AdminRoute />}>
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/security" element={<Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading security tools...</div>}><SecurityPage /></Suspense>} />
            <Route path="/audit" element={<AuditPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  </BrowserRouter>
);

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <WalletProvider>
        <AppRoutes />
      </WalletProvider>
    </AuthProvider>
  );
};
