const MONTHS = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

export function formatBillSchedule(bill) {
  const freq = bill.billing_frequency ?? "monthly";
  if (freq === "yearly" && bill.due_month) {
    const month = MONTHS.find((m) => Number(m.value) === Number(bill.due_month));
    return `${bill.due_day} ${month?.label?.slice(0, 3) ?? ""} · Anual`;
  }
  return `Día ${bill.due_day} · Mensual`;
}

export function formatBillDueHint(bill) {
  const schedule = formatBillSchedule(bill);
  if (bill.days_until === 0) return `${schedule} · Hoy`;
  if (bill.days_until <= 7) return `${schedule} · en ${bill.days_until} días`;
  return schedule;
}

export { MONTHS };
