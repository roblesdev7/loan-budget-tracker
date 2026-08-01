/** Large-touch-target grid for daily and recurring expense categories */

const ICONS = {
  Vivienda: "🏠",
  Vehículo: "🚗",
  Electricidad: "⚡",
  Médico: "🏥",
  Dependientes: "👨‍👩‍👧",
  Alimentación: "🍽️",
  "Otro gasto": "📌",
  Suscripciones: "📺",
  Internet: "🌐",
  Teléfono: "📱",
  Seguros: "🛡️",
  "Servicios fijos": "🔄",
};

export default function QuickAction({ categories, selected, onSelect }) {
  const daily = categories.filter((c) => c.category_type === "daily");
  const recurring = categories.filter((c) => c.category_type === "recurring");

  if (!daily.length && !recurring.length) return null;

  const renderGrid = (items, accent) => (
    <div className="grid grid-cols-4 gap-2">
      {items.map((cat) => {
        const isSelected = String(selected) === String(cat.id);
        const border = accent === "green" ? "green" : "blue";
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(String(cat.id))}
            className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 min-h-[68px] text-xs font-medium transition-colors active:scale-95
              ${
                isSelected
                  ? `border-${border}-500 bg-${border}-50 text-${border}-700`
                  : "border-gray-200 bg-white text-gray-600"
              }`}
            style={
              isSelected
                ? {
                    borderColor: accent === "green" ? "#22c55e" : "#3b82f6",
                    backgroundColor: accent === "green" ? "#f0fdf4" : "#eff6ff",
                    color: accent === "green" ? "#15803d" : "#1d4ed8",
                  }
                : undefined
            }
          >
            <span className="text-2xl mb-1">{ICONS[cat.name] ?? "📎"}</span>
            <span className="leading-tight text-center">{cat.name}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      {daily.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-2">
            Gastos variables
          </p>
          {renderGrid(daily, "green")}
        </div>
      )}
      {recurring.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-2">
            Pagos fijos mensuales
          </p>
          {renderGrid(recurring, "blue")}
        </div>
      )}
    </div>
  );
}
