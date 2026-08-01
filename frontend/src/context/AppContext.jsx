import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { token } = useAuth();
  const [latestRate, setLatestRate] = useState(60.0);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [debts, setDebts] = useState([]);
  const [dashboard, setDashboard] = useState(null);

  const fetchLatestRate = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get("/exchange-rates/latest", token);
      if (res.data?.rate) setLatestRate(parseFloat(res.data.rate));
    } catch {}
  }, [token]);

  const fetchCategories = useCallback(async () => {
    if (!token) return;
    try {
      const [inc, exp] = await Promise.all([
        api.get("/categories/income", token),
        api.get("/categories/expense", token),
      ]);
      setIncomeCategories(inc.data ?? []);
      setExpenseCategories(exp.data ?? []);
    } catch {}
  }, [token]);

  const fetchDebts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get("/debts", token);
      setDebts(res.data ?? []);
    } catch {}
  }, [token]);

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get("/dashboard", token);
      setDashboard(res.data);
      if (res.data?.latest_exchange_rate) {
        setLatestRate(parseFloat(res.data.latest_exchange_rate));
      }
    } catch {}
  }, [token]);

  // Bootstrap data on login
  useEffect(() => {
    if (token) {
      fetchDashboard();
      fetchCategories();
      fetchDebts();
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider
      value={{
        latestRate,
        setLatestRate,
        incomeCategories,
        expenseCategories,
        debts,
        fetchDebts,
        dashboard,
        fetchDashboard,
        fetchLatestRate,
        fetchCategories,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
