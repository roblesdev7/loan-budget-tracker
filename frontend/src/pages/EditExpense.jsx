import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";
import CurrencyInput from "../components/ui/CurrencyInput";

export default function EditExpense() {
  const { id } = useParams();
  const { token } = useAuth();
  const { expenseCategories, fetchDashboard, fetchDebts } = useApp();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [form, setForm] = useState(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("DOP");
  const [exchangeRate, setExRate] = useState("60");
  const [newBalance, setNewBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await api.get("/expenses", token);
      const e = (res.data ?? []).find((x) => String(x.id) === String(id));
      if (e) {
        setItem(e);
        setForm({
          category_id: String(e.category_id),
          expense_type: e.expense_type,
          debt_id: e.debt_id ? String(e.debt_id) : "",
          description: e.description ?? "",
          expense_date: e.expense_date,
        });
        setAmount(String(e.original_amount));
        setCurrency(e.currency);
        setExRate(String(e.exchange_rate));
      }
    })();
  }, [id, token]);

  const isDebt = form?.expense_type !== "daily";

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        category_id: parseInt(form.category_id),
        expense_type: form.expense_type,
        description: form.description,
        expense_date: form.expense_date,
        original_amount: parseFloat(amount),
        currency,
        exchange_rate: currency === "USD" ? parseFloat(exchangeRate) : 1.0,
      };
      if (isDebt) payload.debt_id = parseInt(form.debt_id);
      if (isDebt && newBalance !== "")
        payload.new_balance = parseFloat(newBalance);

      await api.put(`/expenses/${id}`, payload, token);
      fetchDashboard();
      fetchDebts();
      navigate("/historial");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!form) {
    return <div className="text-center py-20 text-gray-400">Cargando…</div>;
  }

  const cats = expenseCategories.filter((c) =>
    isDebt ? c.category_type === "debt_related" : c.category_type !== "debt_related",
  );

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Editar gasto</h2>
      {isDebt && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-4">
          Editar un pago a deuda recalcula el saldo. Si cambias el monto, ingresa
          el nuevo saldo del prestamista abajo.
        </p>
      )}
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
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {isDebt && (
            <input
              type="number"
              placeholder="Nuevo saldo (opcional)"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              className="w-full border-2 border-amber-200 rounded-xl px-3 py-3"
            />
          )}
          <input
            type="date"
            value={form.expense_date}
            onChange={set("expense_date")}
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
          className="w-full bg-red-500 text-white font-bold py-4 rounded-xl"
        >
          {loading ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
