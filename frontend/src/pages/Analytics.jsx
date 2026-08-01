import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// ── Color palettes ────────────────────────────────────────────────────────
const PIE_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#84cc16",
  "#14b8a6",
];
const DEBT_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
];

const fmt = (n) =>
  new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n ?? 0);

const fmtFull = (n) =>
  new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

function monthLabel(ym) {
  const [y, m] = ym.split("-");
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

// ── Custom pie label ──────────────────────────────────────────────────────
const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight="bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = "text-gray-900" }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color} leading-tight`}>
        DOP {fmtFull(value)}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Section title ─────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
      {children}
    </h3>
  );
}

export default function Analytics() {
  const { token } = useAuth();
  const today = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const isCurrentMonth = period === today;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/analytics?period=${period}`, token);
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, token]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="space-y-6">
      {/* ── Period selector ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPeriod(prevMonth(period))}
          className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 active:bg-gray-100 text-xl"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="font-bold text-gray-900">{monthLabel(period)}</p>
          <p className="text-xs text-gray-400">Análisis mensual</p>
        </div>
        <button
          onClick={() => setPeriod(nextMonth(period))}
          disabled={isCurrentMonth}
          className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 active:bg-gray-100 disabled:opacity-30 text-xl"
        >
          ›
        </button>
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-400">
          Cargando análisis…
        </div>
      )}

      {!loading && !data && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-2">📊</p>
          <p>Sin datos disponibles</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── Monthly summary cards ────────────────────────────── */}
          <div>
            <SectionTitle>Resumen del mes</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Ingresos"
                value={data.monthly_totals.income_dop}
                color="text-green-600"
              />
              <StatCard
                label="Gastos"
                value={data.monthly_totals.expenses_dop}
                color="text-red-500"
              />
            </div>
            <div className="mt-3">
              <StatCard
                label="Balance del mes"
                value={data.monthly_totals.balance_dop}
                color={
                  data.monthly_totals.balance_dop >= 0
                    ? "text-green-600"
                    : "text-red-500"
                }
                sub={
                  data.monthly_totals.balance_dop >= 0 ? "Superávit" : "Déficit"
                }
              />
            </div>
          </div>

          {/* ── Month over month ─────────────────────────────────── */}
          {data.month_over_month && (
            <div>
              <SectionTitle>vs mes anterior</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Ingresos", key: "income_dop", color: "text-green-600" },
                  { label: "Gastos", key: "expenses_dop", color: "text-red-500" },
                  { label: "Variables", key: "daily_dop", color: "text-gray-700" },
                  { label: "Fijos", key: "recurring_dop", color: "text-blue-600" },
                ].map(({ label, key, color }) => {
                  const m = data.month_over_month[key];
                  if (!m) return null;
                  const up = m.change_pct > 0;
                  return (
                    <div
                      key={key}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm p-3"
                    >
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className={`text-sm font-bold ${color}`}>
                        DOP {fmtFull(m.current)}
                      </p>
                      <p
                        className={`text-xs mt-1 ${up ? "text-red-500" : "text-green-600"}`}
                      >
                        {up ? "↑" : "↓"} {Math.abs(m.change_pct)}% vs anterior
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Gastos: variable / fijo / deuda ──────────────────── */}
          {(() => {
            const bd =
              data.spending_breakdown ?? data.daily_vs_debt ?? {};
            const slices = [
              { name: "Variables", value: bd.daily ?? 0, fill: "#22c55e" },
              { name: "Fijos mensuales", value: bd.recurring ?? 0, fill: "#3b82f6" },
              { name: "Pagos a deudas", value: bd.debt_related ?? 0, fill: "#f97316" },
            ].filter((d) => d.value > 0);
            if (!slices.length) return null;
            return (
            <div>
              <SectionTitle>Distribución de gastos</SectionTitle>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={slices}
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      labelLine={false}
                      label={renderCustomLabel}
                      dataKey="value"
                    >
                      {slices.map((s, i) => (
                        <Cell key={i} fill={s.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`DOP ${fmtFull(v)}`, ""]} />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            );
          })()}

          {/* ── Gastos por categoría ─────────────────────────────── */}
          {data.expenses_by_category.length > 0 && (
            <div>
              <SectionTitle>Gastos por categoría</SectionTitle>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.expenses_by_category}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      labelLine={false}
                      label={renderCustomLabel}
                      dataKey="total_dop"
                      nameKey="category"
                    >
                      {data.expenses_by_category.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`DOP ${fmtFull(v)}`, ""]} />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category breakdown list */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm mt-3 overflow-hidden">
                {data.expenses_by_category.map((cat, i) => (
                  <div
                    key={cat.category}
                    className={`flex items-center gap-3 px-4 py-3 ${i < data.expenses_by_category.length - 1 ? "border-b border-gray-50" : ""}`}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="flex-1 text-sm text-gray-700">
                      {cat.category}
                    </span>
                    <span className="text-xs text-gray-400">
                      {cat.percentage}%
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      DOP {fmtFull(cat.total_dop)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Ingresos vs Gastos últimos 6 meses ───────────────── */}
          {data.income_vs_expenses_6m.length > 0 && (
            <div>
              <SectionTitle>Ingresos vs Gastos — últimos 6 meses</SectionTitle>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data.income_vs_expenses_6m}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => `${fmt(v / 1000)}k`}
                      tick={{ fontSize: 10 }}
                      width={38}
                    />
                    <Tooltip
                      formatter={(v, name) => [
                        `DOP ${fmtFull(v)}`,
                        name === "income_dop" ? "Ingresos" : "Gastos",
                      ]}
                    />
                    <Bar
                      dataKey="income_dop"
                      name="Ingresos"
                      fill="#22c55e"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="expense_dop"
                      name="Gastos"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Distribución de deudas ───────────────────────────── */}
          {data.debt_breakdown.length > 0 && (
            <div>
              <SectionTitle>Balance de deudas activas</SectionTitle>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.debt_breakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      labelLine={false}
                      label={renderCustomLabel}
                      dataKey="balance_dop"
                      nameKey="name"
                    >
                      {data.debt_breakdown.map((_, i) => (
                        <Cell
                          key={i}
                          fill={DEBT_COLORS[i % DEBT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`DOP ${fmtFull(v)}`, ""]} />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm mt-3 overflow-hidden">
                {data.debt_breakdown.map((d, i) => (
                  <div
                    key={d.name}
                    className={`flex items-center gap-3 px-4 py-3 ${i < data.debt_breakdown.length - 1 ? "border-b border-gray-50" : ""}`}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        background: DEBT_COLORS[i % DEBT_COLORS.length],
                      }}
                    />
                    <span className="flex-1 text-sm text-gray-700 truncate">
                      {d.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {d.percentage}%
                    </span>
                    <span className="text-sm font-bold text-red-600">
                      DOP {fmtFull(d.balance_dop)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
