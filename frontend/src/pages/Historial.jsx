import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { downloadCsv } from "../api/client";
import ExpensesList from "./ExpensesList";
import IncomeList from "./IncomeList";

const TABS = [
  { id: "expenses", label: "Gastos" },
  { id: "income", label: "Ingresos" },
];

export default function Historial() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "income" ? "income" : "expenses";

  const setTab = (id) => {
    setSearchParams(id === "expenses" ? {} : { tab: id }, { replace: true });
  };

  const exportMonth = async () => {
    const today = new Date();
    const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);
    const type = tab === "income" ? "income" : "expenses";
    await downloadCsv(
      `/export/csv?type=${type}&start=${start}&end=${end}`,
      token,
    );
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-xl">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors
              ${tab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={exportMonth}
        className="w-full mb-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 active:bg-gray-50"
      >
        ⬇ Exportar mes actual (CSV)
      </button>

      {tab === "expenses" ? <ExpensesList /> : <IncomeList />}
    </div>
  );
}
