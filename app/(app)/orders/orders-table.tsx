"use client";

import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/lib/types";

const columnHelper = createColumnHelper<Order>();

export function OrdersTable({ initialData }: { initialData: Order[] }) {
  const [data] = useState<Order[]>(initialData);

  async function updateNote(id: string, value: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({ seller_note: value })
      .eq("id", id);
    if (error) alert("Lưu thất bại: " + error.message);
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("order_date", {
        header: "Ngày",
        cell: (c) =>
          c.getValue()
            ? new Date(c.getValue() as string).toLocaleDateString("vi-VN")
            : "—",
      }),
      columnHelper.accessor("platform", { header: "Sàn" }),
      columnHelper.accessor("platform_order_id", { header: "Order ID" }),
      columnHelper.accessor("platform_status", {
        header: "Trạng thái",
        cell: (c) => {
          const v = c.getValue() as string | null;
          return v ? (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{v}</span>
          ) : (
            "—"
          );
        },
      }),
      columnHelper.accessor("customer_name", {
        header: "Khách",
        cell: (c) => {
          const o = c.row.original;
          return (
            <div>
              <div>{o.customer_name ?? "—"}</div>
              {o.customer_contact && (
                <div className="text-xs text-slate-400">{o.customer_contact}</div>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor("tracking_number", {
        header: "Tracking",
        cell: (c) => (c.getValue() as string) ?? "—",
      }),
      columnHelper.accessor("label_link", {
        header: "Label",
        cell: (c) => {
          const v = c.getValue() as string | null;
          return v ? (
            <a
              href={v}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              mở
            </a>
          ) : (
            "—"
          );
        },
      }),
      columnHelper.accessor("seller_note", {
        header: "Ghi chú (sửa trực tiếp)",
        cell: (c) => {
          const current = (c.getValue() as string) ?? "";
          return (
            <input
              defaultValue={current}
              onBlur={(e) => {
                if (e.target.value !== current) {
                  updateNote(c.row.original.id, e.target.value);
                }
              }}
              className="w-full rounded border border-transparent px-1 py-0.5 hover:border-slate-300 focus:border-slate-500 focus:outline-none"
            />
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-left">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="whitespace-nowrap px-3 py-2 font-medium text-slate-600"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-8 text-center text-slate-400"
              >
                Chưa có đơn nào. Import CSV hoặc thêm đơn để bắt đầu.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap px-3 py-1.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
