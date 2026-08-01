import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";
import CurrencyInput from "../components/ui/CurrencyInput";
import QuickAction from "../components/ui/QuickAction";

const FLOW_MODES = [
  { value: "normal", label: "📅 Gasto normal", desc: "Diario o suscripción fija" },
  { value: "debt", label: "💳 Pago a deuda", desc: "Cuota, tarjeta o préstamo" },
];

const PAYMENT_KINDS = [
  { value: "installment", label: "📅 Cuota mensual", desc: "Pago regular programado" },
  { value: "principal", label: "⬇️ Abono a capital", desc: "Pago extra al principal" },
];

const fmt = (n) =>
  parseFloat(n).toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function catByName(categories, name) {
  const c = categories.find((x) => x.name === name);
  return c ? String(c.id) : "";
}

function resolveExpenseType(debt, paymentKind) {
  if (paymentKind === "principal") return "principal_reduction";
  if (!debt) return "debt_payment";
  return debt.debt_type === "credit_card" ? "credit_card_payment" : "debt_payment";
}

function resolveCategoryId(categories, debt, paymentKind) {
  if (paymentKind === "principal") return catByName(categories, "Abono capital");
  if (debt?.debt_type === "credit_card") return catByName(categories, "Pago tarjeta");
  return catByName(categories, "Cuota préstamo");
}

function categoryLabel(categories, id) {
  return categories.find((c) => String(c.id) === String(id))?.name ?? "";
}

function requiresNewBalance(debt) {
  if (!debt) return false;
  return debt.debt_type !== "credit_card";
}

export default function AddExpense() {
  const { token } = useAuth();
  const {
    expenseCategories,
    debts,
    fetchDashboard,
    fetchDebts,
    latestRate,
    fetchLatestRate,
  } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const preBill = location.state?.bill ?? null;
  const preDebtId =
    location.state?.debt_id?.toString() ??
    preBill?.debt_id?.toString() ??
    "";
  const initialMode = preDebtId || preBill?.debt_id ? "debt" : "normal";

  const today = new Date().toISOString().split("T")[0];
  const [flowMode, setFlowMode] = useState(initialMode);
  const [paymentKind, setPaymentKind] = useState(
    preBill?.payment_kind ?? "installment",
  );
  const [form, setForm] = useState({
    category_id: preBill?.category_id?.toString() ?? "",
    debt_id: preDebtId,
    description: preBill?.description ?? "",
    expense_date: today,
  });
  const [amount, setAmount] = useState(preBill?.amount?.toString() ?? "");
  const [newBalance, setNewBalance] = useState("");
  const [currency, setCurrency] = useState(preBill?.currency ?? "DOP");
  const [exchangeRate, setExRate] = useState(latestRate.toFixed(2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isDebtPayment = flowMode === "debt";
  const activeDebts = debts.filter((d) => d.status === "active");
  const selectedDebt = activeDebts.find(
    (d) => String(d.id) === String(form.debt_id),
  );
  const needsNewBalance = isDebtPayment && requiresNewBalance(selectedDebt);
  const newBalanceOptional =
    isDebtPayment && selectedDebt?.debt_type === "credit_card";

  const filteredCats = expenseCategories.filter((c) => {
    if (isDebtPayment) return c.category_type === "debt_related";
    return c.category_type === "daily" || c.category_type === "recurring";
  });

  const paymentAmount = parseFloat(amount) || 0;
  const newBalNum = parseFloat(newBalance);
  const impliedInterest =
    selectedDebt && paymentAmount > 0 && !Number.isNaN(newBalNum)
      ? Math.max(
          0,
          parseFloat(selectedDebt.current_balance) - paymentAmount - newBalNum,
        )
      : null;

  // Auto-set category when debt or payment kind changes
  useEffect(() => {
    if (!isDebtPayment || !selectedDebt) return;
    const catId = resolveCategoryId(expenseCategories, selectedDebt, paymentKind);
    if (catId) setForm((p) => ({ ...p, category_id: catId }));
  }, [form.debt_id, paymentKind, isDebtPayment, selectedDebt, expenseCategories]);

  useEffect(() => {
    setForm((p) => ({
      ...p,
      category_id: "",
      debt_id: preDebtId && isDebtPayment ? preDebtId : "",
    }));
    setPaymentKind("installment");
    setNewBalance("");
  }, [flowMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setNewBalance("");
    if (!preDebtId) setPaymentKind("installment");
  }, [form.debt_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const expenseType = isDebtPayment
        ? resolveExpenseType(selectedDebt, paymentKind)
        : "daily";

      const payload = {
        category_id: parseInt(form.category_id),
        expense_type: expenseType,
        description: form.description,
        expense_date: form.expense_date,
        original_amount: parseFloat(amount),
        currency,
        exchange_rate: currency === "USD" ? parseFloat(exchangeRate) : 1.0,
      };

      if (isDebtPayment) payload.debt_id = parseInt(form.debt_id);
      if (isDebtPayment && newBalance !== "") {
        payload.new_balance = parseFloat(newBalance);
      }

      await api.post("/expenses", payload, token);

      if (currency === "USD") fetchLatestRate();
      fetchDashboard();
      if (isDebtPayment) fetchDebts();
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
      <h2 className="text-xl font-bold text-gray-900 mb-4">Registrar gasto</h2>

      <form onSubmit={handle} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-600 mb-2">
            ¿Qué estás registrando?
          </p>
          <div className="grid grid-cols-1 gap-2">
            {FLOW_MODES.map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFlowMode(value)}
                className={`py-3 px-4 rounded-xl text-left border-2 transition-colors
                  ${
                    flowMode === value
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200"
                  }`}
              >
                <span className="text-sm font-bold text-gray-900 block">
                  {label}
                </span>
                <span className="text-xs text-gray-500">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {isDebtPayment && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-600 mb-2">
              Tipo de pago
            </p>
            <div className="grid grid-cols-1 gap-2">
              {PAYMENT_KINDS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentKind(value)}
                  className={`py-3 px-4 rounded-xl text-left border-2 transition-colors
                    ${
                      paymentKind === value
                        ? "border-orange-500 bg-orange-50"
                        : "border-gray-200"
                    }`}
                >
                  <span className="text-sm font-bold text-gray-900 block">
                    {label}
                  </span>
                  <span className="text-xs text-gray-500">{desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <CurrencyInput
          amount={amount}
          setAmount={setAmount}
          currency={currency}
          setCurrency={setCurrency}
          exchangeRate={exchangeRate}
          setExchangeRate={setExRate}
          label={isDebtPayment ? "Monto pagado" : "Monto del gasto"}
        />

        {!isDebtPayment && (
          <QuickAction
            categories={expenseCategories}
            selected={form.category_id}
            onSelect={(id) => setForm((p) => ({ ...p, category_id: id }))}
          />
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          {isDebtPayment ? (
            <div className="bg-gray-50 rounded-xl px-3 py-2.5">
              <p className="text-xs text-gray-500">Categoría</p>
              <p className="text-sm font-semibold text-gray-800">
                {categoryLabel(expenseCategories, form.category_id) || "—"}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría
              </label>
              <select
                value={form.category_id}
                onChange={set("category_id")}
                className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-red-400"
                required
              >
                <option value="">Seleccionar…</option>
                {filteredCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_type === "recurring" ? "🔄 " : ""}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isDebtPayment && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deuda a abonar
              </label>
              <select
                value={form.debt_id}
                onChange={set("debt_id")}
                className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-red-400"
                required
              >
                <option value="">Seleccionar deuda…</option>
                {activeDebts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.currency} {fmt(d.current_balance)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isDebtPayment && selectedDebt && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3">
              <label className="block text-sm font-semibold text-amber-700 mb-1">
                Saldo después del pago ({selectedDebt.currency})
                {newBalanceOptional && (
                  <span className="font-normal text-amber-600">
                    {" "}
                    — opcional en tarjetas
                  </span>
                )}
              </label>
              <p className="text-xs text-amber-600 mb-2">
                Escribe el saldo que muestra el prestamista. Actual:{" "}
                {selectedDebt.currency} {fmt(selectedDebt.current_balance)}
              </p>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                className="w-full text-xl font-bold p-3 rounded-xl border-2 border-amber-300 bg-white text-amber-800 outline-none focus:border-amber-500"
                required={needsNewBalance}
              />
              {impliedInterest !== null && impliedInterest > 0 && (
                <p className="text-xs text-amber-700 mt-2 font-medium">
                  Interés/cargos del período: {selectedDebt.currency}{" "}
                  {fmt(impliedInterest)}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={form.expense_date}
              onChange={set("expense_date")}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-red-400"
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
              placeholder={
                isDebtPayment
                  ? paymentKind === "principal"
                    ? "Ej. Abono extra enero"
                    : "Ej. Cuota enero"
                  : "Ej. Netflix, luz, comida"
              }
              className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-red-400"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={
            loading ||
            !amount ||
            !form.category_id ||
            (isDebtPayment && !form.debt_id) ||
            (needsNewBalance && newBalance === "")
          }
          className="w-full bg-red-500 disabled:opacity-40 text-white font-bold py-4 rounded-xl text-lg active:bg-red-600"
        >
          {loading ? "Guardando…" : "Guardar gasto"}
        </button>
      </form>
    </div>
  );
}
