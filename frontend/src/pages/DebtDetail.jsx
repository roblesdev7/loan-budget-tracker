import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";
import DataTable from "../components/tables/DataTable";

const DEBT_TYPE_SHORT = {
  credit_card: "Tarjeta de crédito",
  bank_loan_personal: "Préstamo personal",
  bank_loan_vehicle: "Préstamo vehículo",
  bank_loan_mortgage: "Hipoteca",
  informal: "Deuda informal",
};

const fmt = (n) =>
  new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

export default function DebtDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const { fetchDebts } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adjustBal, setAdjustBal] = useState("");
  const [showAdjust, setShowAdjust] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/debts/${id}`, token);
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdjust = async () => {
    setSaving(true);
    try {
      await api.put(
        `/debts/${id}/balance`,
        { current_balance: parseFloat(adjustBal) },
        token,
      );
      setShowAdjust(false);
      fetchDebts();
      load();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-400">Cargando…</div>;
  }

  if (!data?.debt) {
    return (
      <div className="text-center py-20 text-gray-400">
        Deuda no encontrada
        <Link to="/debts" className="block mt-4 text-green-600">
          ← Volver
        </Link>
      </div>
    );
  }

  const debt = data.debt;
  const paymentColumns = [
    {
      accessorKey: "expense_date",
      header: "Fecha",
      cell: ({ getValue }) => (
        <span className="text-xs text-gray-500">{getValue()}</span>
      ),
    },
    {
      accessorKey: "description",
      header: "Concepto",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.description || row.original.category_name}
        </span>
      ),
    },
    {
      accessorKey: "original_amount",
      header: "Monto",
      cell: ({ row }) => (
        <span className="font-bold text-red-600">
          {row.original.currency} {fmt(row.original.original_amount)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate("/debts")}
        className="text-sm text-green-600 font-medium"
      >
        ← Mis deudas
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs text-gray-400">{DEBT_TYPE_SHORT[debt.debt_type]}</p>
        <h2 className="text-xl font-bold text-gray-900 mt-1">{debt.name}</h2>
        <p className="text-3xl font-extrabold text-red-600 mt-3">
          {debt.currency} {fmt(debt.current_balance)}
        </p>
        {debt.currency === "USD" && (
          <p className="text-sm text-gray-400">
            ≈ DOP {fmt(debt.current_balance_dop)}
          </p>
        )}
        <div className="mt-4 bg-gray-100 rounded-full h-2">
          <div
            className="bg-green-400 h-2 rounded-full"
            style={{ width: `${Math.min(100, data.paid_pct)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {data.paid_pct}% pagado · {debt.currency} {fmt(data.paid_amount)} abonado
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/expenses/add"
          state={{ debt_id: debt.id }}
          className="bg-red-500 text-white font-bold py-3 rounded-xl text-center text-sm active:bg-red-600"
        >
          Registrar pago
        </Link>
        <button
          type="button"
          onClick={() => {
            setAdjustBal(String(debt.current_balance));
            setShowAdjust(true);
          }}
          className="bg-amber-50 border-2 border-amber-200 text-amber-800 font-bold py-3 rounded-xl text-sm"
        >
          Actualizar saldo
        </button>
      </div>

      <Link
        to={`/debts/${id}/edit`}
        className="block text-center text-sm text-gray-500 py-2"
      >
        Editar información →
      </Link>

      {showAdjust && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-800">
            Saldo actual según el prestamista ({debt.currency})
          </p>
          <input
            type="number"
            inputMode="decimal"
            value={adjustBal}
            onChange={(e) => setAdjustBal(e.target.value)}
            className="w-full text-xl font-bold p-3 rounded-xl border-2 border-amber-300 bg-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAdjust(false)}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdjust}
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-amber-500 text-white font-bold disabled:opacity-40"
            >
              {saving ? "…" : "Guardar saldo"}
            </button>
          </div>
        </div>
      )}

      {data.payments?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-sm font-bold text-gray-700">
              Historial de pagos
            </h3>
          </div>
          <DataTable
            columns={paymentColumns}
            data={data.payments}
            compact
            emptyMessage="Sin pagos"
          />
        </div>
      )}
    </div>
  );
}
