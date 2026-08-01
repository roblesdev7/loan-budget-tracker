import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

export default function DataTable({
  columns,
  data,
  emptyMessage = "Sin datos",
  compact = false,
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!data.length) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">{emptyMessage}</div>
    );
  }

  const cellPad = compact ? "px-3 py-2.5" : "px-4 py-3";

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-gray-100">
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className={`${cellPad} text-left text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap
                    ${header.column.getCanSort() ? "cursor-pointer select-none active:text-gray-600" : ""}`}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                  {header.column.getIsSorted() === "asc" && " ↑"}
                  {header.column.getIsSorted() === "desc" && " ↓"}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={`${cellPad} text-gray-700`}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
