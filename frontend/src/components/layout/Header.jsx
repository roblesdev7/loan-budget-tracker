import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { api } from "../../api/client";

export default function Header() {
  const { user, logout, token } = useAuth();
  const { latestRate, setLatestRate } = useApp();
  const [showRate, setShowRate] = useState(false);
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openRate = () => {
    setNewRate(latestRate.toFixed(2));
    setError("");
    setShowRate(true);
  };

  const saveRate = async () => {
    setSaving(true);
    setError("");
    try {
      const rate = parseFloat(newRate);
      if (!rate || rate <= 0) throw new Error("Tasa inválida");
      await api.post("/exchange-rates", { rate, notes: "Manual" }, token);
      setLatestRate(rate);
      setShowRate(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <Link to="/" className="block">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              Loan &amp; Budget
            </h1>
          </Link>
          <p className="text-xs text-gray-400">
            Hola, {user?.name?.split(" ")[0] ?? "—"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openRate}
            className="text-right active:opacity-70"
          >
            <p className="text-xs text-gray-400">USD/DOP ↗</p>
            <p className="text-sm font-bold text-blue-600">
              {latestRate.toFixed(2)}
            </p>
          </button>
          <Link
            to="/settings"
            className="text-xs text-gray-400 active:text-green-600 px-1"
          >
            ⚙️
          </Link>
          <button
            onClick={logout}
            className="text-xs text-gray-400 active:text-red-500"
          >
            Salir
          </button>
        </div>
      </header>

      {showRate && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="font-bold text-gray-900 mb-1">Actualizar tasa USD/DOP</h3>
            <p className="text-xs text-gray-500 mb-4">
              Se usará en nuevas transacciones en dólares.
            </p>
            {error && (
              <p className="text-sm text-red-600 mb-3">{error}</p>
            )}
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              className="w-full text-2xl font-bold p-3 rounded-xl border-2 border-blue-200 text-blue-800 outline-none focus:border-blue-500 mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowRate(false)}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveRate}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold disabled:opacity-40"
              >
                {saving ? "…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
