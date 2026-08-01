import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";

const LABELS = {
  credit_card: "💳 Tarjeta de crédito",
  bank_loan_personal: "🏦 Préstamo personal",
  bank_loan_vehicle: "🚗 Préstamo vehículo",
  bank_loan_mortgage: "🏠 Hipoteca",
  informal: "🤝 Deuda informal",
};

const fmt = (n) =>
  new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

export default function Debts() {
  const { debts } = useApp();

  const active = debts.filter((d) => d.status === "active");
  const paid = debts.filter((d) => d.status !== "active");
  const totalDop = active.reduce(
    (s, d) => s + parseFloat(d.current_balance_dop),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Mis deudas</h2>
          <p className="text-sm text-gray-400">
            {active.length} activas · DOP {fmt(totalDop)} total
          </p>
        </div>
        <Link
          to="/debts/add"
          className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold active:bg-green-600"
        >
          + Nueva
        </Link>
      </div>

      {active.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-3">🎉</p>
          <p className="font-medium">Sin deudas activas</p>
          <p className="text-sm mt-1">¡Buen trabajo!</p>
        </div>
      )}

      {active.map((debt) => {
        const paid =
          parseFloat(debt.original_amount) - parseFloat(debt.current_balance);
        const paidPct = Math.min(
          100,
          (paid / parseFloat(debt.original_amount)) * 100,
        );

        return (
          <div
            key={debt.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3"
          >
            <div className="flex justify-between items-start">
              <div>
                <Link to={`/debts/${debt.id}`}>
                  <p className="font-bold text-gray-900">{debt.name}</p>
                </Link>
                <p className="text-xs text-gray-500">
                  {LABELS[debt.debt_type]}
                </p>
                {debt.institution_name && (
                  <p className="text-xs text-gray-400">
                    {debt.institution_name}
                  </p>
                )}
                {debt.debt_type === "informal" && debt.creditor_name && (
                  <p className="text-xs text-gray-400">
                    Acreedor: {debt.creditor_name}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-bold text-red-600 text-lg">
                  {debt.currency} {fmt(debt.current_balance)}
                </p>
                {debt.currency === "USD" && (
                  <p className="text-xs text-gray-400">
                    ≈ DOP {fmt(debt.current_balance_dop)}
                  </p>
                )}
                {debt.interest_rate && (
                  <p className="text-xs text-gray-400">
                    {debt.interest_rate}% anual
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Pagado: {paidPct.toFixed(0)}%</span>
                <span>
                  Original: {debt.currency} {fmt(debt.original_amount)}
                </span>
              </div>
              <div className="bg-gray-100 rounded-full h-2">
                <div
                  className="bg-green-400 h-2 rounded-full transition-all"
                  style={{ width: `${paidPct}%` }}
                />
              </div>
            </div>

            {debt.debt_type === "credit_card" && debt.credit_limit && (
              <p className="text-xs text-gray-400">
                Límite: {debt.currency} {fmt(debt.credit_limit)}
              </p>
            )}

            <div className="pt-2 border-t border-gray-100 flex gap-2">
              <Link
                to="/expenses/add"
                state={{ debt_id: debt.id, debt_name: debt.name }}
                className="flex-1 bg-green-500 text-white text-sm font-bold py-2.5 rounded-xl text-center active:bg-green-600"
              >
                💳 Registrar pago
              </Link>
              <Link
                to={`/debts/${debt.id}`}
                className="px-4 py-2.5 border-2 border-gray-200 text-gray-500 text-sm font-medium rounded-xl active:bg-gray-50"
              >
                👁
              </Link>
              <Link
                to={`/debts/${debt.id}/edit`}
                className="px-4 py-2.5 border-2 border-gray-200 text-gray-500 text-sm font-medium rounded-xl active:bg-gray-50"
              >
                ✏️
              </Link>
            </div>
          </div>
        );
      })}

      {paid.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-2">
            Saldadas ({paid.length})
          </p>
          {paid.map((debt) => (
            <div
              key={debt.id}
              className="bg-gray-50 rounded-xl border border-gray-100 p-3 mb-2 opacity-60"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-700">{debt.name}</p>
                  <p className="text-xs text-gray-400">
                    {LABELS[debt.debt_type]} · {debt.currency}{" "}
                    {fmt(debt.original_amount)}
                  </p>
                </div>
                <Link
                  to={`/debts/${debt.id}/edit`}
                  className="text-xs text-gray-400 border border-gray-200 px-3 py-1.5 rounded-lg active:bg-gray-100"
                >
                  ✏️
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
