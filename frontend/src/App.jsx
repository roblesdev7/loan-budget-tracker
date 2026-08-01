import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppProvider } from "./context/AppContext";
import Header from "./components/layout/Header";
import BottomNav from "./components/layout/BottomNav";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AddIncome from "./pages/AddIncome";
import AddExpense from "./pages/AddExpense";
import Debts from "./pages/Debts";
import AddDebt from "./pages/AddDebt";
import EditDebt from "./pages/EditDebt";
import DebtDetail from "./pages/DebtDetail";
import Historial from "./pages/Historial";
import EditIncome from "./pages/EditIncome";
import EditExpense from "./pages/EditExpense";
import Settings from "./pages/Settings";

const Analytics = lazy(() => import("./pages/Analytics"));

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function AppLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto bg-gray-50">
      <Header />
      <main className="flex-1 px-4 pt-4 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}

function PageLoader() {
  return (
    <div className="text-center py-20 text-gray-400 text-sm">Cargando…</div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/income/add"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AddIncome />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/income/:id/edit"
        element={
          <ProtectedRoute>
            <AppLayout>
              <EditIncome />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses/add"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AddExpense />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses/:id/edit"
        element={
          <ProtectedRoute>
            <AppLayout>
              <EditExpense />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/debts"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Debts />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/debts/add"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AddDebt />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/debts/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DebtDetail />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/debts/:id/edit"
        element={
          <ProtectedRoute>
            <AppLayout>
              <EditDebt />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/historial"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Historial />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <Analytics />
              </Suspense>
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Settings />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter basename="/finance">
          <AppRoutes />
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
