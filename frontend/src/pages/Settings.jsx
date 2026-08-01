import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";
import { formatBillSchedule, MONTHS } from "../utils/billingSchedule";

const BASE_TABS = [
  { id: "bills", label: "Pagos fijos" },
  { id: "categories", label: "Categorías" },
  { id: "budgets", label: "Presupuestos" },
  { id: "account", label: "Mi cuenta" },
];

const fmt = (n) =>
  new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

const CATEGORY_TYPE_LABELS = {
  daily: "Variable",
  recurring: "Fijo (suscripciones)",
  debt_related: "Deuda",
};

const CATEGORY_TYPE_HINTS = {
  daily: "Gastos variables del día a día",
  recurring: "Suscripciones, IA, hosting, dominios, etc.",
  debt_related: "Pagos vinculados a deudas",
};

function catByName(categories, name) {
  return categories.find((c) => c.name === name)?.id ?? "";
}

const emptyBill = {
  bill_kind: "subscription",
  billing_frequency: "monthly",
  name: "",
  category_id: "",
  debt_id: "",
  original_amount: "",
  currency: "DOP",
  exchange_rate: "60",
  due_day: "1",
  due_month: "1",
  notes: "",
};

export default function Settings() {
  const { token, user, updateProfile } = useAuth();
  const isAdmin = user?.role === "admin";
  const tabs = isAdmin
    ? [...BASE_TABS, { id: "users", label: "Usuarios" }]
    : BASE_TABS;
  const { expenseCategories, debts, fetchCategories, latestRate } = useApp();
  const [tab, setTab] = useState("bills");
  const [bills, setBills] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyBill);
  const [budgetForm, setBudgetForm] = useState({ category_id: "", monthly_limit_dop: "" });
  const [catForm, setCatForm] = useState({ name: "", category_type: "recurring" });
  const [accountForm, setAccountForm] = useState({
    email: user?.email ?? "",
    current_password: "",
    new_password: "",
  });
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (user?.email) {
      setAccountForm((p) => ({ ...p, email: user.email }));
    }
  }, [user?.email]);

  const recurringCats = expenseCategories.filter(
    (c) => c.category_type === "recurring",
  );
  const debtCats = expenseCategories.filter(
    (c) => c.category_type === "debt_related",
  );
  const activeDebts = debts.filter((d) => d.status === "active");
  const allExpenseCats = expenseCategories;
  const categoryGroups = [
    { type: "recurring", label: "Fijo (suscripciones, hosting, dominios)" },
    { type: "daily", label: "Variable (gastos del día a día)" },
    { type: "debt_related", label: "Deuda" },
  ];

  const isDebtBill = form.bill_kind === "debt_installment";
  const isYearly = !isDebtBill && form.billing_frequency === "yearly";

  const loadBills = useCallback(async () => {
    try {
      const res = await api.get("/recurring-bills", token);
      setBills(res.data ?? []);
    } catch {
      setBills([]);
    }
  }, [token]);

  const loadBudgets = useCallback(async () => {
    try {
      const res = await api.get("/budgets", token);
      setBudgets(res.data ?? []);
    } catch {
      setBudgets([]);
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get("/admin/users", token);
      setUsers(res.data ?? []);
    } catch {
      setUsers([]);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    loadBills();
    loadBudgets();
    loadUsers();
  }, [loadBills, loadBudgets, loadUsers]);

  const onDebtSelect = (debtId) => {
    const debt = activeDebts.find((d) => String(d.id) === String(debtId));
    if (!debt) {
      setForm((p) => ({ ...p, debt_id: debtId, category_id: "" }));
      return;
    }
    const catName =
      debt.debt_type === "credit_card" ? "Pago tarjeta" : "Cuota préstamo";
    setForm((p) => ({
      ...p,
      debt_id: debtId,
      name: p.name || `Cuota ${debt.name}`,
      category_id: String(catByName(debtCats, catName)),
      currency: debt.currency,
    }));
  };

  const saveBill = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const payload = {
        name: form.name,
        category_id: parseInt(form.category_id),
        original_amount: parseFloat(form.original_amount),
        currency: form.currency,
        exchange_rate:
          form.currency === "USD" ? parseFloat(form.exchange_rate) : 1.0,
        due_day: parseInt(form.due_day),
        billing_frequency: isDebtBill ? "monthly" : form.billing_frequency,
        due_month:
          !isDebtBill && form.billing_frequency === "yearly"
            ? parseInt(form.due_month)
            : null,
        notes: form.notes || null,
        debt_id: isDebtBill ? parseInt(form.debt_id) : null,
      };
      await api.post("/recurring-bills", payload, token);
      setForm({ ...emptyBill, exchange_rate: latestRate.toFixed(2) });
      loadBills();
      setMsg(isDebtBill ? "Cuota programada" : "Pago fijo agregado");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteBill = async (id) => {
    await api.delete(`/recurring-bills/${id}`, token);
    loadBills();
  };

  const saveBudget = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(
        "/budgets",
        {
          category_id: parseInt(budgetForm.category_id),
          monthly_limit_dop: parseFloat(budgetForm.monthly_limit_dop),
        },
        token,
      );
      setBudgetForm({ category_id: "", monthly_limit_dop: "" });
      loadBudgets();
      setMsg("Presupuesto guardado");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteBudget = async (id) => {
    await api.delete(`/budgets/${id}`, token);
    loadBudgets();
  };

  const saveCategory = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/categories/expense", catForm, token);
      setCatForm({ name: "", category_type: "recurring" });
      await fetchCategories();
      setMsg("Categoría creada");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      await updateProfile(accountForm);
      setAccountForm((p) => ({
        ...p,
        current_password: "",
        new_password: "",
      }));
      setMsg("Cuenta actualizada");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      await api.post("/admin/users", userForm, token);
      setUserForm({ name: "", email: "", password: "" });
      loadUsers();
      setMsg("Usuario creado");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = async (u) => {
    await api.put(
      `/admin/users/${u.id}`,
      { is_active: u.is_active ? 0 : 1 },
      token,
    );
    loadUsers();
  };

  const subscriptionBills = bills.filter(
    (b) => b.bill_type === "subscription" || !b.debt_id,
  );
  const debtBills = bills.filter(
    (b) => b.bill_type === "debt_installment" || b.debt_id,
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Configuración</h2>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold whitespace-nowrap
              ${tab === id ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <p
          className={`text-sm px-3 py-2 rounded-lg ${
            msg.includes("duplicad") || msg.includes("Ya existe") || msg.includes("inválid")
              ? "text-red-600 bg-red-50"
              : "text-green-600 bg-green-50"
          }`}
        >
          {msg}
        </p>
      )}

      {tab === "bills" && (
        <>
          <form onSubmit={saveBill} className="bg-white rounded-xl border p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Nuevo pago fijo</p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    bill_kind: "subscription",
                    debt_id: "",
                    category_id: "",
                  }))
                }
                className={`py-2.5 rounded-xl text-xs font-bold border-2 ${
                  !isDebtBill
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500"
                }`}
              >
                📺 Suscripción
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    bill_kind: "debt_installment",
                    category_id: "",
                  }))
                }
                className={`py-2.5 rounded-xl text-xs font-bold border-2 ${
                  isDebtBill
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 text-gray-500"
                }`}
              >
                🏦 Cuota de deuda
              </button>
            </div>

            {isDebtBill ? (
              <select
                value={form.debt_id}
                onChange={(e) => onDebtSelect(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                required
              >
                <option value="">Seleccionar deuda…</option>
                {activeDebts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.currency} {fmt(d.current_balance)}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={form.category_id}
                onChange={(e) =>
                  setForm((p) => ({ ...p, category_id: e.target.value }))
                }
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                required
              >
                <option value="">Categoría…</option>
                {recurringCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <input
              placeholder={isDebtBill ? "Ej. Cuota préstamo BHD" : "Ej. Netflix"}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              required
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Monto"
                value={form.original_amount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, original_amount: e.target.value }))
                }
                className="border rounded-xl px-3 py-2.5 text-sm"
                required
              />
              {!isDebtBill && (
                <select
                  value={form.billing_frequency}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      billing_frequency: e.target.value,
                    }))
                  }
                  className="border rounded-xl px-3 py-2.5 text-sm"
                >
                  <option value="monthly">Mensual</option>
                  <option value="yearly">Anual</option>
                </select>
              )}
            </div>

            {isYearly ? (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.due_month}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, due_month: e.target.value }))
                  }
                  className="border rounded-xl px-3 py-2.5 text-sm"
                  required
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  max="28"
                  placeholder="Día"
                  value={form.due_day}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, due_day: e.target.value }))
                  }
                  className="border rounded-xl px-3 py-2.5 text-sm"
                  required
                />
              </div>
            ) : (
              <input
                type="number"
                min="1"
                max="28"
                placeholder="Día del mes"
                value={form.due_day}
                onChange={(e) =>
                  setForm((p) => ({ ...p, due_day: e.target.value }))
                }
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                required
              />
            )}

            <button
              type="submit"
              disabled={loading || (isDebtBill && !form.debt_id)}
              className="w-full bg-blue-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm"
            >
              Agregar
            </button>
          </form>

          {subscriptionBills.length > 0 && (
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">
                Suscripciones y servicios
              </p>
              <div className="space-y-2">
                {subscriptionBills.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white rounded-xl border p-4 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{b.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatBillSchedule(b)} · {b.category_name} · {b.currency}{" "}
                        {fmt(b.original_amount)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteBill(b.id)}
                      className="text-red-400 text-sm"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {debtBills.length > 0 && (
            <div>
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-2">
                Cuotas de deudas
              </p>
              <div className="space-y-2">
                {debtBills.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white rounded-xl border border-orange-100 p-4 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{b.name}</p>
                      <p className="text-xs text-gray-400">
                        Día {b.due_day} · {b.debt_name ?? b.category_name} ·{" "}
                        {b.currency} {fmt(b.original_amount)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteBill(b.id)}
                      className="text-red-400 text-sm"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!bills.length && (
            <p className="text-center text-gray-400 text-sm py-8">
              Sin pagos fijos registrados
            </p>
          )}
        </>
      )}

      {tab === "categories" && (
        <>
          <form onSubmit={saveCategory} className="bg-white rounded-xl border p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Nueva categoría</p>
            <input
              placeholder="Ej. Herramientas IA, Hosting, Dominios"
              value={catForm.name}
              onChange={(e) =>
                setCatForm((p) => ({ ...p, name: e.target.value }))
              }
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              required
            />
            <select
              value={catForm.category_type}
              onChange={(e) =>
                setCatForm((p) => ({ ...p, category_type: e.target.value }))
              }
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="recurring">Fijo (suscripciones, hosting, dominios)</option>
              <option value="daily">Variable (gastos del día a día)</option>
              <option value="debt_related">Deuda</option>
            </select>
            <p className="text-xs text-gray-400">
              {CATEGORY_TYPE_HINTS[catForm.category_type]}
            </p>
            {catForm.category_type === "recurring" && recurringCats.length > 0 && (
              <p className="text-xs text-gray-400">
                Ya tienes: {recurringCats.map((c) => c.name).join(", ")}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 text-white font-bold py-3 rounded-xl text-sm"
            >
              Crear categoría
            </button>
          </form>
          <div className="space-y-4">
            {categoryGroups.map(({ type, label }) => {
              const items = allExpenseCats
                .filter((c) => c.category_type === type)
                .sort((a, b) => a.name.localeCompare(b.name, "es"));
              if (!items.length) return null;
              return (
                <div key={type}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    {label}
                  </p>
                  <div className="bg-white rounded-xl border overflow-hidden">
                    {items.map((c, i) => (
                      <div
                        key={c.id}
                        className={`px-4 py-3 flex justify-between ${i ? "border-t border-gray-50" : ""}`}
                      >
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className="text-xs text-gray-400">
                          {CATEGORY_TYPE_LABELS[c.category_type] ?? c.category_type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {!allExpenseCats.length && (
              <p className="text-center text-gray-400 text-sm py-8">
                Sin categorías registradas
              </p>
            )}
          </div>
        </>
      )}

      {tab === "budgets" && (
        <>
          <form onSubmit={saveBudget} className="bg-white rounded-xl border p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Límite mensual</p>
            <select
              value={budgetForm.category_id}
              onChange={(e) =>
                setBudgetForm((p) => ({ ...p, category_id: e.target.value }))
              }
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              required
            >
              <option value="">Categoría…</option>
              {allExpenseCats
                .filter((c) => c.category_type !== "debt_related")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <input
              type="number"
              placeholder="Límite DOP / mes"
              value={budgetForm.monthly_limit_dop}
              onChange={(e) =>
                setBudgetForm((p) => ({
                  ...p,
                  monthly_limit_dop: e.target.value,
                }))
              }
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-500 text-white font-bold py-3 rounded-xl text-sm"
            >
              Guardar presupuesto
            </button>
          </form>
          <div className="space-y-2">
            {budgets.map((b) => (
              <div key={b.id} className="bg-white rounded-xl border p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm">{b.category_name}</p>
                    <p className="text-xs text-gray-400">
                      DOP {fmt(b.spent_dop)} / {fmt(b.monthly_limit_dop)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteBudget(b.id)}
                    className="text-red-400 text-sm"
                  >
                    🗑
                  </button>
                </div>
                <div className="mt-2 bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${b.percentage_used > 90 ? "bg-red-500" : "bg-green-400"}`}
                    style={{ width: `${Math.min(100, b.percentage_used)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "account" && (
        <form onSubmit={saveAccount} className="bg-white rounded-xl border p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Mi cuenta</p>
          <p className="text-xs text-gray-400">
            Sesión: {user?.name} · {user?.role === "admin" ? "Administrador" : "Usuario"}
          </p>
          <input
            type="email"
            placeholder="Email"
            value={accountForm.email}
            onChange={(e) =>
              setAccountForm((p) => ({ ...p, email: e.target.value }))
            }
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            required
          />
          <input
            type="password"
            placeholder="Contraseña actual"
            value={accountForm.current_password}
            onChange={(e) =>
              setAccountForm((p) => ({ ...p, current_password: e.target.value }))
            }
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            required
          />
          <input
            type="password"
            placeholder="Nueva contraseña (mín. 12 caracteres)"
            value={accountForm.new_password}
            onChange={(e) =>
              setAccountForm((p) => ({ ...p, new_password: e.target.value }))
            }
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            required
            minLength={12}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl text-sm"
          >
            Guardar cambios
          </button>
        </form>
      )}

      {tab === "users" && isAdmin && (
        <>
          <form onSubmit={saveUser} className="bg-white rounded-xl border p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Crear usuario</p>
            <p className="text-xs text-gray-400">
              Cada persona tendrá sus propias deudas y finanzas, separadas de las tuyas.
            </p>
            <input
              placeholder="Nombre (ej. María)"
              value={userForm.name}
              onChange={(e) =>
                setUserForm((p) => ({ ...p, name: e.target.value }))
              }
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={userForm.email}
              onChange={(e) =>
                setUserForm((p) => ({ ...p, email: e.target.value }))
              }
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              required
            />
            <input
              type="password"
              placeholder="Contraseña temporal (mín. 12 caracteres)"
              value={userForm.password}
              onChange={(e) =>
                setUserForm((p) => ({ ...p, password: e.target.value }))
              }
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              required
              minLength={12}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm"
            >
              Crear usuario
            </button>
          </form>
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="bg-white rounded-xl border p-4 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-sm text-gray-900">
                    {u.name}
                    {u.role === "admin" && (
                      <span className="ml-2 text-xs text-indigo-600">admin</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {u.email} · {u.is_active ? "Activo" : "Inactivo"}
                  </p>
                </div>
                {u.id !== user?.id && (
                  <button
                    type="button"
                    onClick={() => toggleUser(u)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                      u.is_active
                        ? "text-red-500 bg-red-50"
                        : "text-green-600 bg-green-50"
                    }`}
                  >
                    {u.is_active ? "Desactivar" : "Activar"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
