import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";

const CATEGORY_ICONS = {
  Vivienda: "🏠",
  Vehículo: "🚗",
  Electricidad: "⚡",
  Médico: "🏥",
  Dependientes: "👨‍👩‍👧",
  Alimentación: "🍽️",
  "Otro gasto": "📌",
  "Cuota préstamo": "🏦",
  "Abono capital": "⬇️",
  "Pago tarjeta": "💳",
  Suscripciones: "📺",
  Internet: "🌐",
  Teléfono: "📱",
  Seguros: "🛡️",
  "Servicios fijos": "🔄",
};

const fmt = (n) =>
  new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

function monthLabel(yearMonth) {
  const [y, m] = yearMonth.split("-");
  const names = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return `${names[parseInt(m) - 1]} ${y}`;
}

function prevMonth(ym) {
  const d = new Date(`${ym}-01`);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function nextMonth(ym) {
  const d = new Date(`${ym}-01`);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 7);
}

function groupByDate(expenses) {
  const groups = {};
  for (const e of expenses) {
    if (!groups[e.expense_date]) groups[e.expense_date] = [];
    groups[e.expense_date].push(e);
  }
  // Sort dates descending
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

function formatDateHeader(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("es-DO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function ExpensesList() {
  const { token } = useAuth();
  const { fetchDashboard, fetchDebts } = useApp();
  const today = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(today);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const [y, m] = period.split("-");
      const start = `${y}-${m}-01`;
      const end = new Date(parseInt(y), parseInt(m), 0)
        .toISOString()
        .slice(0, 10);
      const res = await api.get(`/expenses?start=${start}&end=${end}`, token);
      setExpenses(res.data ?? []);
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [period, token]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await api.delete(`/expenses/${id}`, token);
      setConfirmDeleteId(null);
      await fetchExpenses();
      fetchDashboard();
      fetchDebts();
    } catch {
      // keep confirm open on error
    } finally {
      setDeleting(false);
    }
  };

  const grouped = groupByDate(expenses);
  const totalMonth = expenses.reduce(
    (s, e) => s + parseFloat(e.base_amount_dop),
    0,
  );
  const isCurrentMonth = period === today;

  return (
    <div>
      {/* Month selector */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setPeriod(prevMonth(period))}
          className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 active:bg-gray-100 text-xl"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="font-bold text-gray-900">{monthLabel(period)}</p>
          {!loading && (
            <p className="text-sm text-red-500 font-semibold">
              − DOP {fmt(totalMonth)}
            </p>
          )}
        </div>
        <button
          onClick={() => setPeriod(nextMonth(period))}
          disabled={isCurrentMonth}
          className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 active:bg-gray-100 disabled:opacity-30 text-xl"
        >
          ›
        </button>
      </div>

      <Link
        to="/expenses/add"
        className="flex items-center justify-center gap-2 w-full bg-red-500 text-white font-bold py-3 rounded-xl text-sm active:bg-red-600 mb-4"
      >
        + Registrar gasto
      </Link>

      {loading && (
        <div className="text-center py-16 text-gray-400">Cargando…</div>
      )}

      {!loading && expenses.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">Sin gastos este mes</p>
        </div>
      )}

      {!loading &&
        grouped.map(([date, items]) => {
          const dayTotal = items.reduce(
            (s, e) => s + parseFloat(e.base_amount_dop),
            0,
          );
          return (
            <div key={date} className="mb-4">
              {/* Date header */}
              <div className="flex justify-between items-center px-1 mb-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide capitalize">
                  {formatDateHeader(date)}
                </p>
                <p className="text-xs font-semibold text-gray-500">
                  DOP {fmt(dayTotal)}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {items.map((e, idx) => (
                  <div
                    key={e.id}
                    className={`${idx < items.length - 1 ? "border-b border-gray-50" : ""}`}
                  >
                    {confirmDeleteId === e.id ? (
                      <div className="px-4 py-3 bg-red-50 space-y-2">
                        <p className="text-sm font-semibold text-red-700 text-center">
                          ¿Eliminar este gasto?
                        </p>
                        {e.debt_name && (
                          <p className="text-xs text-red-500 text-center">
                            El saldo de «{e.debt_name}» se restaurará.
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2 rounded-lg text-sm"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(e.id)}
                            disabled={deleting}
                            className="flex-1 bg-red-500 disabled:opacity-40 text-white font-bold py-2 rounded-lg text-sm"
                          >
                            {deleting ? "…" : "Eliminar"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl flex-shrink-0">
                          {CATEGORY_ICONS[e.category_name] ?? "💸"}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            {e.description || e.category_name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">
                              {e.category_name}
                            </span>
                            {e.debt_name && (
                              <span className="text-xs text-blue-500 truncate">
                                · {e.debt_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-red-600 text-sm">
                            {e.currency === "USD"
                              ? `$${fmt(e.original_amount)}`
                              : `DOP ${fmt(e.original_amount)}`}
                          </p>
                          {e.currency === "USD" && (
                            <p className="text-xs text-gray-400">
                              ≈ DOP {fmt(e.base_amount_dop)}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(e.id)}
                          className="text-gray-300 active:text-red-500 text-lg flex-shrink-0 px-1"
                          aria-label="Eliminar gasto"
                        >
                          🗑
                        </button>
                        <Link
                          to={`/expenses/${e.id}/edit`}
                          className="text-gray-300 active:text-blue-500 text-lg flex-shrink-0 px-1"
                          aria-label="Editar gasto"
                        >
                          ✏️
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
