import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import DataTable from "../components/tables/DataTable";
import { formatBillDueHint } from "../utils/billingSchedule";

const fmt = (n) =>
  new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

const DEBT_TYPE_SHORT = {
  credit_card: "Tarjeta",
  bank_loan_personal: "Préstamo",
  bank_loan_vehicle: "Vehículo",
  bank_loan_mortgage: "Hipoteca",
  informal: "Informal",
};

const CATEGORY_TYPE_LABEL = {
  daily: "Variable",
  recurring: "Fijo",
  debt_related: "Deuda",
};

export default function Dashboard() {
  const { dashboard, fetchDashboard, debts } = useApp();

  useEffect(() => {
    fetchDashboard();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const balance = dashboard?.available_balance_dop ?? 0;
  const isPositive = balance >= 0;
  const activeDebts = debts.filter((d) => d.status === "active");
  const recentExpenses = dashboard?.recent_expenses ?? [];

  const debtRows = useMemo(
    () =>
      activeDebts.map((d) => {
        const paid = parseFloat(d.original_amount) - parseFloat(d.current_balance);
        const paidPct = Math.min(
          100,
          (paid / parseFloat(d.original_amount)) * 100,
        );
        return { ...d, paidPct };
      }),
    [activeDebts],
  );

  const debtColumns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Deuda",
        cell: ({ row }) => (
          <Link to={`/debts/${row.original.id}`} className="block">
            <p className="font-semibold text-gray-900">{row.original.name}</p>
            <p className="text-xs text-gray-400">
              {DEBT_TYPE_SHORT[row.original.debt_type]}
            </p>
          </Link>
        ),
      },
      {
        accessorKey: "current_balance",
        header: "Saldo",
        cell: ({ row }) => (
          <div className="text-right">
            <p className="font-bold text-red-600">
              {row.original.currency} {fmt(row.original.current_balance)}
            </p>
            {row.original.currency === "USD" && (
              <p className="text-xs text-gray-400">
                ≈ DOP {fmt(row.original.current_balance_dop)}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "paidPct",
        header: "Progreso",
        cell: ({ row }) => (
          <div className="min-w-[80px]">
            <div className="bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-green-400 h-1.5 rounded-full"
                style={{ width: `${row.original.paidPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1 text-right">
              {row.original.paidPct.toFixed(0)}%
            </p>
          </div>
        ),
      },
      {
        id: "action",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to="/expenses/add"
            state={{ debt_id: row.original.id }}
            className="text-xs font-bold text-green-600 whitespace-nowrap"
          >
            Pagar →
          </Link>
        ),
      },
    ],
    [],
  );

  const expenseColumns = useMemo(
    () => [
      {
        accessorKey: "expense_date",
        header: "Fecha",
        cell: ({ getValue }) => (
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: "category_name",
        header: "Concepto",
        cell: ({ row }) => (
          <div className="min-w-[120px]">
            <p className="font-medium text-gray-900 truncate">
              {row.original.description || row.original.category_name}
            </p>
            <p className="text-xs text-gray-400">
              {CATEGORY_TYPE_LABEL[row.original.category_type] ??
                row.original.category_name}
              {row.original.debt_name && ` · ${row.original.debt_name}`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "base_amount_dop",
        header: "Monto",
        cell: ({ row }) => (
          <span className="font-bold text-red-600 whitespace-nowrap">
            DOP {fmt(row.original.base_amount_dop)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      {/* Balance hero */}
      <div
        className={`rounded-2xl p-6 text-white shadow-sm
        ${
          isPositive
            ? "bg-gradient-to-br from-green-500 to-green-600"
            : "bg-gradient-to-br from-red-500 to-red-600"
        }`}
      >
        <p className="text-sm opacity-80">Balance disponible</p>
        <p className="text-4xl font-extrabold mt-1 tracking-tight">
          DOP {fmt(balance)}
        </p>
        <div className="flex gap-5 mt-4 text-sm opacity-75">
          <span>↑ {fmt(dashboard?.total_income_dop)}</span>
          <span>↓ {fmt(dashboard?.total_expenses_dop)}</span>
        </div>
      </div>

      {/* This month breakdown */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
          Este mes
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
            <p className="text-[10px] text-gray-500 leading-tight">Variables</p>
            <p className="text-sm font-bold text-gray-900 mt-1">
              {fmt(dashboard?.monthly_daily_dop)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-blue-100 shadow-sm">
            <p className="text-[10px] text-blue-500 leading-tight">Fijos</p>
            <p className="text-sm font-bold text-blue-700 mt-1">
              {fmt(dashboard?.monthly_recurring_dop)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-orange-100 shadow-sm">
            <p className="text-[10px] text-orange-500 leading-tight">Deudas</p>
            <p className="text-sm font-bold text-orange-700 mt-1">
              {fmt(dashboard?.monthly_debt_dop)}
            </p>
          </div>
        </div>
        {(dashboard?.monthly_commitments_dop ?? 0) > 0 && (
          <p className="text-xs text-gray-400 mt-2 text-center">
            Compromisos fijos + deudas: DOP{" "}
            {fmt(dashboard?.monthly_commitments_dop)}
          </p>
        )}
      </div>

      {/* Upcoming bills — subscriptions & debt installments */}
      {(() => {
        const bills = dashboard?.upcoming_bills ?? [];
        const subs = bills.filter((b) => b.bill_type === "subscription");
        const installments = bills.filter((b) => b.bill_type === "debt_installment");
        if (!subs.length && !installments.length) return null;

        return (
          <>
            {subs.length > 0 && (
              <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-blue-50 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-blue-700">Servicios fijos</h3>
                  <Link to="/settings" className="text-xs text-blue-500">
                    Gestionar
                  </Link>
                </div>
                {subs.slice(0, 5).map((b) => (
                  <Link
                    key={b.id}
                    to="/expenses/add"
                    state={{
                      bill: {
                        category_id: b.category_id,
                        description: b.name,
                        amount: b.original_amount,
                        currency: b.currency,
                      },
                    }}
                    className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 active:bg-blue-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                      <p className="text-xs text-gray-400">{formatBillDueHint(b)}</p>
                    </div>
                    <span className="text-sm font-bold text-blue-600">
                      DOP {fmt(b.base_amount_dop)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            {installments.length > 0 && (
              <div className="bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-orange-50 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-orange-700">
                    Cuotas pendientes
                  </h3>
                  <Link to="/settings" className="text-xs text-orange-500">
                    Gestionar
                  </Link>
                </div>
                {installments.slice(0, 5).map((b) => (
                  <Link
                    key={b.id}
                    to="/expenses/add"
                    state={{
                      debt_id: b.debt_id,
                      bill: {
                        description: b.name,
                        amount: b.original_amount,
                        currency: b.currency,
                        payment_kind: "installment",
                      },
                    }}
                    className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 active:bg-orange-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatBillDueHint(b)}
                        {b.debt_name && ` · ${b.debt_name}`}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-orange-600">
                      DOP {fmt(b.base_amount_dop)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        );
      })()}

      {/* Budget progress */}
      {(dashboard?.budgets?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-purple-700">Presupuestos</h3>
            <Link to="/settings" className="text-xs text-purple-500">
              Ver todos
            </Link>
          </div>
          {dashboard.budgets.map((b) => (
            <div key={b.category_name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-gray-700">{b.category_name}</span>
                <span className="text-gray-400">
                  {b.percentage_used}% · DOP {fmt(b.spent_dop)}
                </span>
              </div>
              <div className="bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${b.percentage_used > 90 ? "bg-red-500" : "bg-purple-400"}`}
                  style={{ width: `${Math.min(100, b.percentage_used)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Liabilities summary */}
      {(dashboard?.active_debts_count ?? 0) > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 border border-red-100 flex justify-between items-center">
          <div>
            <p className="text-xs text-red-500 font-semibold">Deudas activas</p>
            <p className="font-bold text-gray-900">
              {dashboard.active_debts_count} · DOP{" "}
              {fmt(dashboard.total_debt_balance_dop)}
            </p>
          </div>
          <Link to="/debts" className="text-sm text-red-600 font-semibold">
            Ver →
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          to="/income/add"
          className="bg-green-50 border-2 border-green-200 rounded-xl p-3 text-center active:bg-green-100"
        >
          <span className="text-2xl">💰</span>
          <p className="text-xs font-bold text-green-700 mt-1">Ingreso</p>
        </Link>
        <Link
          to="/expenses/add"
          className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-center active:bg-red-100"
        >
          <span className="text-2xl">💳</span>
          <p className="text-xs font-bold text-red-700 mt-1">Gasto</p>
        </Link>
        <Link
          to="/debts"
          className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 text-center active:bg-blue-100"
        >
          <span className="text-2xl">📋</span>
          <p className="text-xs font-bold text-blue-700 mt-1">Deudas</p>
        </Link>
      </div>

      {/* Active debts table */}
      {debtRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-700">Mis deudas</h3>
            <Link to="/debts" className="text-xs text-green-600 font-semibold">
              Ver todas
            </Link>
          </div>
          <DataTable
            columns={debtColumns}
            data={debtRows}
            compact
            emptyMessage="Sin deudas activas"
          />
        </div>
      )}

      {/* Recent expenses table */}
      {recentExpenses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-700">
              Movimientos recientes
            </h3>
            <Link
              to="/historial"
              className="text-xs text-green-600 font-semibold"
            >
              Historial →
            </Link>
          </div>
          <DataTable
            columns={expenseColumns}
            data={recentExpenses}
            compact
            emptyMessage="Sin movimientos"
          />
        </div>
      )}
    </div>
  );
}
