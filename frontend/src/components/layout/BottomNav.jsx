import { NavLink } from "react-router-dom";

const NAV = [
  { to: "/", end: true, icon: "🏠", label: "Inicio" },
  { to: "/expenses/add", end: false, icon: "💳", label: "Gasto" },
  { to: "/debts", end: false, icon: "📋", label: "Deudas" },
  { to: "/historial", end: false, icon: "📜", label: "Historial" },
  { to: "/analytics", end: false, icon: "📊", label: "Análisis" },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 max-w-lg mx-auto"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {NAV.map(({ to, end, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2.5 text-[10px] font-medium transition-colors select-none
               ${isActive ? "text-green-600" : "text-gray-400"}`
            }
          >
            <span className="text-xl mb-0.5">{icon}</span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
