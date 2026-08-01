import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";
import CurrencyInput from "../components/ui/CurrencyInput";

const DEBT_TYPES = [
  { value: "credit_card", label: "💳 Tarjeta de crédito" },
  { value: "bank_loan_personal", label: "🏦 Préstamo personal" },
  { value: "bank_loan_vehicle", label: "🚗 Préstamo vehículo" },
  { value: "bank_loan_mortgage", label: "🏠 Hipoteca" },
  { value: "informal", label: "🤝 Deuda informal" },
];

export default function AddDebt() {
  const { token } = useAuth();
  const { fetchDebts, fetchDashboard, latestRate } = useApp();
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    debt_type: "bank_loan_personal",
    name: "",
    institution_name: "",
    account_number: "",
    interest_rate: "",
    credit_limit: "",
    creditor_name: "",
    creditor_address: "",
    creditor_phone: "",
    start_date: today,
    notes: "",
  });
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("DOP");
  const [exchangeRate, setExRate] = useState(latestRate.toFixed(2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isInformal = form.debt_type === "informal";
  const isCreditCard = form.debt_type === "credit_card";
  const isFormal = !isInformal;

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        debt_type: form.debt_type,
        name: form.name,
        start_date: form.start_date,
        original_amount: parseFloat(amount),
        currency,
        exchange_rate: currency === "USD" ? parseFloat(exchangeRate) : 1.0,
        notes: form.notes || null,
      };

      if (isFormal) {
        payload.institution_name = form.institution_name || null;
        payload.account_number = form.account_number || null;
        payload.interest_rate = form.interest_rate
          ? parseFloat(form.interest_rate)
          : null;
        if (isCreditCard) {
          payload.credit_limit = form.credit_limit
            ? parseFloat(form.credit_limit)
            : null;
        }
      }

      if (isInformal) {
        payload.creditor_name = form.creditor_name || null;
        payload.creditor_address = form.creditor_address || null;
        payload.creditor_phone = form.creditor_phone || null;
      }

      await api.post("/debts", payload, token);
      fetchDebts();
      fetchDashboard();
      navigate("/debts");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Nueva deuda</h2>

      <form onSubmit={handle} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Debt type selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-600 mb-2">
            Tipo de deuda
          </p>
          <div className="space-y-2">
            {DEBT_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, debt_type: value }))}
                className={`w-full py-3 px-4 rounded-xl text-sm font-medium border-2 text-left transition-colors
                  ${
                    form.debt_type === value
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 text-gray-600"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Name & date */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la deuda
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set("name")}
              placeholder={
                isCreditCard
                  ? "Ej. VISA BHD León"
                  : isInformal
                    ? "Ej. Préstamo Juan García"
                    : "Ej. Préstamo personal BHD"
              }
              className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de inicio
            </label>
            <input
              type="date"
              value={form.start_date}
              onChange={set("start_date")}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500"
              required
            />
          </div>
        </div>

        <CurrencyInput
          amount={amount}
          setAmount={setAmount}
          currency={currency}
          setCurrency={setCurrency}
          exchangeRate={exchangeRate}
          setExchangeRate={setExRate}
          label={
            isCreditCard
              ? "Balance actual de la tarjeta"
              : "Monto total de la deuda"
          }
        />

        {/* Formal fields */}
        {isFormal && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-600">
              Datos de la institución
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Institución
              </label>
              <input
                type="text"
                value={form.institution_name}
                onChange={set("institution_name")}
                placeholder="Ej. BHD León, Popular, Scotiabank"
                className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  No. cuenta / ref.
                </label>
                <input
                  type="text"
                  value={form.account_number}
                  onChange={set("account_number")}
                  placeholder="Últimos 4 dígitos"
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tasa anual (%)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.interest_rate}
                  onChange={set("interest_rate")}
                  placeholder="28.5"
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500"
                />
              </div>
            </div>
            {isCreditCard && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Límite de crédito
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.credit_limit}
                  onChange={set("credit_limit")}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Informal fields */}
        {isInformal && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-600">
              Datos del acreedor
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del acreedor
              </label>
              <input
                type="text"
                value={form.creditor_name}
                onChange={set("creditor_name")}
                placeholder="Nombre completo"
                className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={form.creditor_phone}
                onChange={set("creditor_phone")}
                placeholder="(809) 000-0000"
                className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <textarea
                rows={2}
                value={form.creditor_address}
                onChange={set("creditor_address")}
                placeholder="Dirección del acreedor"
                className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas <span className="text-gray-400">(opcional)</span>
          </label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={set("notes")}
            placeholder="Condiciones, acuerdos pactados…"
            className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !amount || !form.name}
          className="w-full bg-green-500 disabled:opacity-40 text-white font-bold py-4 rounded-xl text-lg active:bg-green-600"
        >
          {loading ? "Guardando…" : "Registrar deuda"}
        </button>
      </form>
    </div>
  );
}
