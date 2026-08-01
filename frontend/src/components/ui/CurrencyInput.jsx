import { useEffect } from "react";
import { useApp } from "../../context/AppContext";

/**
 * Reusable dual-currency amount input.
 *
 * Props:
 *   amount         string  — controlled value
 *   setAmount      fn
 *   currency       'DOP'|'USD'
 *   setCurrency    fn
 *   exchangeRate   string  — controlled value (shown only for USD)
 *   setExchangeRate fn
 *   label          string  — field label
 */
export default function CurrencyInput({
  amount,
  setAmount,
  currency,
  setCurrency,
  exchangeRate,
  setExchangeRate,
  label = "Monto",
}) {
  const { latestRate } = useApp();
  const isUSD = currency === "USD";

  // Auto-populate exchange rate with the sticky value when switching to USD
  useEffect(() => {
    if (isUSD && (!exchangeRate || exchangeRate === "")) {
      setExchangeRate(latestRate.toFixed(2));
    }
  }, [isUSD]); // eslint-disable-line react-hooks/exhaustive-deps

  const dopDerivedAmount =
    isUSD && amount && exchangeRate
      ? (parseFloat(amount) * parseFloat(exchangeRate)).toLocaleString(
          "es-DO",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )
      : null;

  return (
    <div
      className={`rounded-xl border-2 p-4 transition-colors ${isUSD ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"}`}
    >
      <label className="block text-sm font-semibold text-gray-600 mb-3">
        {label}
      </label>

      {/* Currency toggle */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setCurrency("DOP")}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors
            ${!isUSD ? "bg-green-500 text-white shadow-sm" : "bg-gray-100 text-gray-500"}`}
        >
          🇩🇴 DOP
        </button>
        <button
          type="button"
          onClick={() => setCurrency("USD")}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors
            ${isUSD ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 text-gray-500"}`}
        >
          🇺🇸 USD
        </button>
      </div>

      {/* Amount */}
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className={`w-full text-3xl font-bold p-3 rounded-xl border-2 outline-none transition-colors
          ${
            isUSD
              ? "border-blue-300 bg-white text-blue-700 focus:border-blue-500"
              : "border-gray-200 bg-white text-gray-900 focus:border-green-500"
          }`}
      />

      {/* Exchange rate (USD only) */}
      {isUSD && (
        <div className="mt-3 space-y-1">
          <label className="block text-xs font-medium text-blue-600">
            Tasa de cambio — DOP por cada 1 USD
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            placeholder={latestRate.toFixed(2)}
            value={exchangeRate}
            onChange={(e) => setExchangeRate(e.target.value)}
            className="w-full p-2.5 text-sm rounded-lg border-2 border-blue-200 bg-white text-blue-700 focus:border-blue-500 outline-none"
          />
          {dopDerivedAmount && (
            <p className="text-xs text-blue-500">≈ DOP {dopDerivedAmount}</p>
          )}
        </div>
      )}
    </div>
  );
}
