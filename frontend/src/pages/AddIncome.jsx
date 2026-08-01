import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";
import CurrencyInput from "../components/ui/CurrencyInput";

export default function AddIncome() {
  const { token } = useAuth();
  const { incomeCategories, fetchDashboard, latestRate, fetchLatestRate } =
    useApp();
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    category_id: "",
    description: "",
    income_date: today,
  });
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("DOP");
  const [exchangeRate, setExRate] = useState(latestRate.toFixed(2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post(
        "/income",
        {
          ...form,
          original_amount: parseFloat(amount),
          currency,
          exchange_rate: currency === "USD" ? parseFloat(exchangeRate) : 1.0,
        },
        token,
      );

      if (currency === "USD") fetchLatestRate();
      fetchDashboard();
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Registrar ingreso
      </h2>

      <form onSubmit={handle} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <CurrencyInput
          amount={amount}
          setAmount={setAmount}
          currency={currency}
          setCurrency={setCurrency}
          exchangeRate={exchangeRate}
          setExchangeRate={setExRate}
        />

        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              value={form.category_id}
              onChange={set("category_id")}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500"
              required
            >
              <option value="">Seleccionar…</option>
              {incomeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={form.income_date}
              onChange={set("income_date")}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={form.description}
              onChange={set("description")}
              placeholder="Ej. Salario quincenal"
              className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !amount || !form.category_id}
          className="w-full bg-green-500 disabled:opacity-40 text-white font-bold py-4 rounded-xl text-lg active:bg-green-600"
        >
          {loading ? "Guardando…" : "Guardar ingreso"}
        </button>
      </form>
    </div>
  );
}
