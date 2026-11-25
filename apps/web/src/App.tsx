import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { AdminRoute, ProtectedRoute } from "./components/ProtectedRoute.js";
import { LandingPage } from "./pages/LandingPage.js";
import { AuthPage } from "./pages/AuthPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { PoolsPage } from "./pages/PoolsPage.js";
import { ApplicationsPage } from "./pages/ApplicationsPage.js";
import { AgentsPage } from "./pages/AgentsPage.js";
import { SecurityPage } from "./pages/SecurityPage.js";
import { TransactionsPage } from "./pages/TransactionsPage.js";
import { AuditPage } from "./pages/AuditPage.js";
import { AssistantPage } from "./pages/AssistantPage.js";
import { WalletProvider } from "./context/WalletContext.js";
import { AuthProvider } from "./context/AuthContext.js";

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <WalletProvider>
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
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/applications" element={<ApplicationsPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route element={<AdminRoute />}>
                  <Route path="/agents" element={<AgentsPage />} />
                  <Route path="/security" element={<SecurityPage />} />
                  <Route path="/audit" element={<AuditPage />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </AuthProvider>
  );
};
