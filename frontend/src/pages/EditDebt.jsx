import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";

const DEBT_TYPES = [
  { value: "credit_card", label: "💳 Tarjeta de crédito" },
  { value: "bank_loan_personal", label: "🏦 Préstamo personal" },
  { value: "bank_loan_vehicle", label: "🚗 Préstamo vehículo" },
  { value: "bank_loan_mortgage", label: "🏠 Hipoteca" },
  { value: "informal", label: "🤝 Deuda informal" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Activa" },
  { value: "paid_off", label: "Saldada" },
  { value: "closed", label: "Cerrada" },
];

export default function EditDebt() {
  const { id } = useParams();
  const { token } = useAuth();
  const { debts, fetchDebts, fetchDashboard } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Pre-fill form from already-loaded debts (no extra fetch needed)
  useEffect(() => {
    const debt = debts.find((d) => String(d.id) === String(id));
    if (debt) {
      setForm({
        name: debt.name ?? "",
        status: debt.status ?? "active",
        institution_name: debt.institution_name ?? "",
        account_number: debt.account_number ?? "",
        interest_rate: debt.interest_rate ?? "",
        credit_limit: debt.credit_limit ?? "",
        creditor_name: debt.creditor_name ?? "",
        creditor_address: debt.creditor_address ?? "",
        creditor_phone: debt.creditor_phone ?? "",
        notes: debt.notes ?? "",
        debt_type: debt.debt_type,
      });
    }
  }, [debts, id]);

  if (!form) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Cargando…
      </div>
    );
  }

  const isInformal = form.debt_type === "informal";
  const isCreditCard = form.debt_type === "credit_card";
  const isFormal = !isInformal;

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.put(`/debts/${id}`, form, token);
      await Promise.all([fetchDebts(), fetchDashboard()]);
      navigate("/debts");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/debts/${id}`, token);
      await Promise.all([fetchDebts(), fetchDashboard()]);
      navigate("/debts");
    } catch (err) {
      setError(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate("/debts")}
          className="text-gray-400 text-2xl leading-none active:text-gray-600"
        >
          ←
        </button>
        <h2 className="text-xl font-bold text-gray-900">Editar deuda</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Nombre y estado */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la deuda
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set("name")}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, status: value }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors
                    ${
                      form.status === value
                        ? value === "active"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-400 bg-gray-100 text-gray-700"
                        : "border-gray-200 text-gray-500"
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Datos formales */}
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
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Datos informales */}
        {isInformal && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-600">
              Datos del acreedor
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={form.creditor_name}
                onChange={set("creditor_name")}
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
                className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* Notas */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas
          </label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={set("notes")}
            className="w-full border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-green-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-500 disabled:opacity-40 text-white font-bold py-4 rounded-xl text-lg active:bg-green-600"
        >
          {loading ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>

      {/* Delete section */}
      <div className="mt-6 border-t border-gray-200 pt-6">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full border-2 border-red-300 text-red-500 font-semibold py-4 rounded-xl text-sm active:bg-red-50"
          >
            🗑 Eliminar esta deuda
          </button>
        ) : (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-red-700 text-center">
              ¿Seguro que quieres eliminar esta deuda?
            </p>
            <p className="text-xs text-red-500 text-center">
              Se eliminarán también los pagos asociados. Esta acción no se puede
              deshacer.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 border-2 border-gray-300 text-gray-600 font-semibold py-3 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm active:bg-red-600"
              >
                {deleting ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
