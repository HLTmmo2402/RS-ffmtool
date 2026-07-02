"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Order, OrderItemLite } from "@/lib/types";

// Tiến độ đơn = rollup từ trạng thái các sản phẩm (khớp view v_order_status).
function stage(items: OrderItemLite[]): { label: string; cls: string } {
  const S = (k: string) => ({ label: k, cls: "" });
  if (!items.length) return { label: "Mới", cls: "bg-slate-100 text-slate-600" };
  const has = (s: string) => items.some((i) => i.item_status === s);
  const all = (s: string) => items.every((i) => i.item_status === s);
  if (has("issue")) return { label: "Sự cố", cls: "bg-red-100 text-red-700" };
  if (all("cancelled")) return { label: "Đã huỷ", cls: "bg-slate-200 text-slate-600" };
  if (all("delivered")) return { label: "Đã giao", cls: "bg-emerald-100 text-emerald-700" };
  if (has("synced")) return { label: "Đã sync", cls: "bg-teal-100 text-teal-700" };
  if (has("has_tracking")) return { label: "Có tracking", cls: "bg-blue-100 text-blue-700" };
  if (has("in_production")) return { label: "Đang sản xuất", cls: "bg-indigo-100 text-indigo-700" };
  if (has("ordered")) return { label: "Chờ FFM đẩy", cls: "bg-amber-100 text-amber-700" };
  if (has("design_ok")) return { label: "Design OK", cls: "bg-lime-100 text-lime-700" };
  if (has("waiting_design")) return { label: "Chờ design", cls: "bg-orange-100 text-orange-700" };
  void S;
  return { label: "Mới", cls: "bg-slate-100 text-slate-600" };
}

export function OrdersTable({ initialData }: { initialData: Order[] }) {
  const [data] = useState<Order[]>(initialData);
  const [q, setQ] = useState("");

  async function updateNote(id: string, value: string) {
    const supabase = createClient();
    const { error } = await supabase.from("orders").update({ seller_note: value }).eq("id", id);
    if (error) alert("Lưu thất bại: " + error.message);
  }

  function exportCSV() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Ngày", "Order ID", "Sàn", "TK bán", "Seller", "Khách", "SĐT", "Tiến độ", "TT sàn", "Tracking", "Giá trị (USD)", "Ghi chú", "Sản phẩm"];
    const body = rows.map((o) => [
      o.order_date ?? "", o.platform_order_id, o.platform, o.selling_account_name ?? "",
      o.seller_name ?? "", o.customer_name ?? "", o.customer_contact ?? "",
      stage(o.items).label, o.platform_status ?? "", o.tracking_number ?? "",
      o.order_value ?? "", o.seller_note ?? "",
      o.items.map((i) => `${i.product_title ?? ""}${i.size ? " (" + i.size + ")" : ""}`).join(" | "),
    ].map(esc).join(","));
    const csv = "﻿" + [head.map(esc).join(","), ...body].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "don-hang.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data;
    return data.filter((o) => {
      const hay = [
        o.platform_order_id, o.customer_name, o.customer_contact, o.seller_note,
        o.seller_name, o.selling_account_name, o.tracking_number,
        ...o.items.map((i) => `${i.product_title ?? ""} ${i.size ?? ""}`),
      ].join(" ").toLowerCase();
      return hay.includes(s);
    });
  }, [data, q]);

  const H = "whitespace-nowrap px-3 py-2 font-medium text-slate-600";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm: Order ID, khách, seller note, color, tracking…"
          className="w-full max-w-md rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        <span className="whitespace-nowrap text-sm text-slate-400">{rows.length}/{data.length} đơn</span>
        <button onClick={exportCSV} disabled={rows.length === 0}
          className="ml-auto whitespace-nowrap rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50">
          ⬇ Xuất CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              {["Ngày", "Order ID", "TK bán", "Seller", "Khách", "Tiến độ", "TT sàn",
                "Tracking", "Giá trị", "Sản phẩm", "Ghi chú (sửa)"].map((h) => (
                <th key={h} className={H}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-400">
                {data.length ? "Không có đơn khớp tìm kiếm." : "Chưa có đơn nào. Nhập đơn hoặc Import để bắt đầu."}
              </td></tr>
            ) : rows.map((o) => {
              const s = stage(o.items);
              return (
                <tr key={o.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-1.5">
                    {o.order_date ? new Date(o.order_date).toLocaleDateString("vi-VN") : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <Link href={`/orders/${o.id}`} className="text-blue-600 hover:underline">{o.platform_order_id}</Link>
                    {o.items.length > 1 && (
                      <span className="ml-1 rounded bg-purple-100 px-1.5 text-xs text-purple-700" title="Đơn nhiều sản phẩm">
                        {o.items.length} SP
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">{o.selling_account_name ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{o.seller_name ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    <div className="max-w-[150px] truncate">{o.customer_name ?? "—"}</div>
                    {o.customer_contact && <div className="text-xs text-slate-400">{o.customer_contact}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <span className={"rounded px-2 py-0.5 text-xs " + s.cls}>{s.label}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    {o.platform_status ? <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{o.platform_status}</span> : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      {o.tracking_number ? <span className="max-w-[140px] truncate">{o.tracking_number}</span> : "—"}
                      {o.label_link && <a href={o.label_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">label</a>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">{o.order_value != null ? `$${o.order_value}` : "—"}</td>
                  <td className="px-3 py-1.5">
                    <div className="max-w-[220px] truncate">
                      {o.items[0]?.product_title ?? "—"}{o.items[0]?.size ? ` · ${o.items[0].size}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <input defaultValue={o.seller_note ?? ""}
                      onBlur={(e) => { if (e.target.value !== (o.seller_note ?? "")) updateNote(o.id, e.target.value); }}
                      className="w-40 rounded border border-transparent px-1 py-0.5 hover:border-slate-300 focus:border-slate-500 focus:outline-none" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
