import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";
import CurrencyInput from "../components/ui/CurrencyInput";

export default function EditIncome() {
  const { id } = useParams();
  const { token } = useAuth();
  const { incomeCategories, fetchDashboard, latestRate } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("DOP");
  const [exchangeRate, setExRate] = useState("60");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await api.get("/income", token);
      const item = (res.data ?? []).find((i) => String(i.id) === String(id));
      if (item) {
        setForm({
          category_id: String(item.category_id),
          description: item.description ?? "",
          income_date: item.income_date,
        });
        setAmount(String(item.original_amount));
        setCurrency(item.currency);
        setExRate(String(item.exchange_rate));
      }
    })();
  }, [id, token]);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(
        `/income/${id}`,
        {
          category_id: parseInt(form.category_id),
          description: form.description,
          income_date: form.income_date,
          original_amount: parseFloat(amount),
          currency,
          exchange_rate: currency === "USD" ? parseFloat(exchangeRate) : 1.0,
        },
        token,
      );
      fetchDashboard();
      navigate("/historial?tab=income");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!form) {
    return <div className="text-center py-20 text-gray-400">Cargando…</div>;
  }

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Editar ingreso</h2>
      <form onSubmit={handle} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">
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
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <select
            value={form.category_id}
            onChange={set("category_id")}
            className="w-full border rounded-xl px-3 py-3"
            required
          >
            {incomeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.income_date}
            onChange={set("income_date")}
            className="w-full border rounded-xl px-3 py-3"
            required
          />
          <input
            type="text"
            value={form.description}
            onChange={set("description")}
            placeholder="Descripción"
            className="w-full border rounded-xl px-3 py-3"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-500 text-white font-bold py-4 rounded-xl"
        >
          {loading ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
