import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";

const CATEGORY_ICONS = {
  Salario: "💼",
  Freelance: "💻",
  Negocio: "🏪",
  Inversión: "📈",
  Otro: "💰",
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

function groupByDate(items) {
  const groups = {};
  for (const item of items) {
    if (!groups[item.income_date]) groups[item.income_date] = [];
    groups[item.income_date].push(item);
  }
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

export default function IncomeList() {
  const { token } = useAuth();
  const { fetchDashboard } = useApp();
  const today = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(today);
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchIncome = useCallback(async () => {
    setLoading(true);
    try {
      const [y, m] = period.split("-");
      const start = `${y}-${m}-01`;
      const end = new Date(parseInt(y), parseInt(m), 0)
        .toISOString()
        .slice(0, 10);
      const res = await api.get(`/income?start=${start}&end=${end}`, token);
      setIncome(res.data ?? []);
    } catch {
      setIncome([]);
    } finally {
      setLoading(false);
    }
  }, [period, token]);

  useEffect(() => {
    fetchIncome();
  }, [fetchIncome]);

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await api.delete(`/income/${id}`, token);
      setConfirmDeleteId(null);
      await fetchIncome();
      fetchDashboard();
    } catch {
      // keep confirm open on error
    } finally {
      setDeleting(false);
    }
  };

  const grouped = groupByDate(income);
  const totalMonth = income.reduce(
    (s, i) => s + parseFloat(i.base_amount_dop),
    0,
  );
  const isCurrentMonth = period === today;

  return (
    <div>
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
            <p className="text-sm text-green-600 font-semibold">
              + DOP {fmt(totalMonth)}
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
        to="/income/add"
        className="flex items-center justify-center gap-2 w-full bg-green-500 text-white font-bold py-3 rounded-xl text-sm active:bg-green-600 mb-4"
      >
        + Registrar ingreso
      </Link>

      {loading && (
        <div className="text-center py-16 text-gray-400">Cargando…</div>
      )}

      {!loading && income.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">Sin ingresos este mes</p>
        </div>
      )}

      {!loading &&
        grouped.map(([date, items]) => {
          const dayTotal = items.reduce(
            (s, i) => s + parseFloat(i.base_amount_dop),
            0,
          );
          return (
            <div key={date} className="mb-4">
              <div className="flex justify-between items-center px-1 mb-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide capitalize">
                  {formatDateHeader(date)}
                </p>
                <p className="text-xs font-semibold text-gray-500">
                  DOP {fmt(dayTotal)}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`${idx < items.length - 1 ? "border-b border-gray-50" : ""}`}
                  >
                    {confirmDeleteId === item.id ? (
                      <div className="px-4 py-3 bg-red-50 space-y-2">
                        <p className="text-sm font-semibold text-red-700 text-center">
                          ¿Eliminar este ingreso?
                        </p>
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
                            onClick={() => handleDelete(item.id)}
                            disabled={deleting}
                            className="flex-1 bg-red-500 disabled:opacity-40 text-white font-bold py-2 rounded-lg text-sm"
                          >
                            {deleting ? "…" : "Eliminar"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-xl flex-shrink-0">
                          {CATEGORY_ICONS[item.category_name] ?? "💰"}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            {item.description || item.category_name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.category_name}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-green-600 text-sm">
                            {item.currency === "USD"
                              ? `$${fmt(item.original_amount)}`
                              : `DOP ${fmt(item.original_amount)}`}
                          </p>
                          {item.currency === "USD" && (
                            <p className="text-xs text-gray-400">
                              ≈ DOP {fmt(item.base_amount_dop)}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="text-gray-300 active:text-red-500 text-lg flex-shrink-0 px-1"
                          aria-label="Eliminar ingreso"
                        >
                          🗑
                        </button>
                        <Link
                          to={`/income/${item.id}/edit`}
                          className="text-gray-300 active:text-blue-500 text-lg flex-shrink-0 px-1"
                          aria-label="Editar ingreso"
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
