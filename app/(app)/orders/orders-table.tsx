"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/lib/types";
import { stageOf, statusMeta, STATUS_OPTIONS } from "@/lib/status";
import { StatusBadge, Badge, Button } from "@/components/ui";
import { bulkUpdateItems } from "./[id]/actions";

type Filters = { q: string; platform: string; from: string; to: string };

export function OrdersTable({
  orders, total, page, size, isFFM, filters,
}: { orders: Order[]; total: number; page: number; size: number; isFFM: boolean; filters: Filters }) {
  const router = useRouter();
  const [f, setF] = useState<Filters>(filters);
  const [stage, setStage] = useState("");           // lọc tiến độ (trong trang hiện)
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function go(params: Record<string, string | number>) {
    const sp = new URLSearchParams();
    const merged = { q: f.q, platform: f.platform, from: f.from, to: f.to, page: 1, ...params };
    for (const [k, v] of Object.entries(merged)) if (v !== "" && v != null) sp.set(k, String(v));
    router.push(`/orders?${sp.toString()}`);
  }

  async function updateNote(id: string, value: string) {
    const supabase = createClient();
    const { error } = await supabase.from("orders").update({ seller_note: value }).eq("id", id);
    if (error) alert("Lưu thất bại: " + error.message);
  }

  const rows = useMemo(() => (stage ? orders.filter((o) => stageOf(o.items) === stage) : orders), [orders, stage]);
  const totalPages = Math.max(1, Math.ceil(total / size));

  function toggle(id: string) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSel((s) => (s.size === rows.length ? new Set() : new Set(rows.map((o) => o.id))));
  }
  async function applyBulk() {
    if (!bulkStatus || sel.size === 0) return;
    setBusy(true);
    const r = await bulkUpdateItems([...sel], { item_status: bulkStatus });
    setBusy(false);
    if (r.ok) { setSel(new Set()); setBulkStatus(""); router.refresh(); }
    else alert("Lỗi: " + r.error);
  }

  function exportCSV() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Ngày", "Order ID", "Sàn", "TK bán", "Seller", "Khách", "SĐT", "Tiến độ", "Tracking", "Giá trị", "Ghi chú", "Sản phẩm"];
    const body = rows.map((o) => [
      o.order_date ?? "", o.platform_order_id, o.platform, o.selling_account_name ?? "", o.seller_name ?? "",
      o.customer_name ?? "", o.customer_contact ?? "", statusMeta(stageOf(o.items)).label, o.tracking_number ?? "",
      o.order_value ?? "", o.seller_note ?? "", o.items.map((i) => `${i.product_title ?? ""}${i.size ? " (" + i.size + ")" : ""}`).join(" | "),
    ].map(esc).join(","));
    const csv = "﻿" + [head.map(esc).join(","), ...body].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "don-hang.csv"; a.click();
  }

  const inputCls = "rounded-md border border-slate-300 px-3 py-1.5 text-sm";
  const H = "whitespace-nowrap px-3 py-2 font-medium text-slate-600";

  return (
    <div className="space-y-3">
      {/* Thanh lọc */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && go({ q: f.q })}
          placeholder="Tìm Order ID / khách / seller / tracking…" className={inputCls + " w-full max-w-xs"} />
        <select value={f.platform} onChange={(e) => { setF({ ...f, platform: e.target.value }); go({ platform: e.target.value }); }} className={inputCls}>
          <option value="">Tất cả sàn</option><option value="TTS">TTS</option><option value="AMZ">AMZ</option>
        </select>
        <input type="date" value={f.from} onChange={(e) => { setF({ ...f, from: e.target.value }); go({ from: e.target.value }); }} className={inputCls} title="Từ ngày" />
        <input type="date" value={f.to} onChange={(e) => { setF({ ...f, to: e.target.value }); go({ to: e.target.value }); }} className={inputCls} title="Đến ngày" />
        <select value={stage} onChange={(e) => setStage(e.target.value)} className={inputCls} title="Lọc tiến độ (trong trang)">
          <option value="">Mọi tiến độ</option>
          {STATUS_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        <Button variant="secondary" size="sm" onClick={() => go({ q: f.q })}>Lọc</Button>
        {(f.q || f.platform || f.from || f.to) && (
          <button onClick={() => { setF({ q: "", platform: "", from: "", to: "" }); router.push("/orders"); }} className="text-xs text-blue-600 hover:underline">Xoá lọc</button>
        )}
        <Button variant="secondary" size="sm" className="ml-auto" onClick={exportCSV}>⬇ Xuất CSV</Button>
      </div>

      {/* Thanh bulk (FFM) */}
      {isFFM && sel.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
          <span className="font-medium">Đã chọn {sel.size} đơn:</span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className={inputCls}>
            <option value="">— Đổi trạng thái sang —</option>
            {STATUS_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <Button size="sm" onClick={applyBulk} disabled={!bulkStatus || busy}>{busy ? "Đang lưu…" : "Áp dụng"}</Button>
          <button onClick={() => setSel(new Set())} className="text-xs text-slate-500 hover:underline">Bỏ chọn</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              {isFFM && <th className="px-3 py-2"><input type="checkbox" checked={rows.length > 0 && sel.size === rows.length} onChange={toggleAll} /></th>}
              {["Ngày", "Order ID", "TK bán", "Seller", "Khách", "Tiến độ", "Tracking", "Giá trị", "Sản phẩm", "Ghi chú"].map((h) => <th key={h} className={H}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={isFFM ? 11 : 10} className="px-3 py-8 text-center text-slate-400">Không có đơn khớp lọc.</td></tr>
            ) : rows.map((o) => (
              <tr key={o.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                {isFFM && <td className="px-3 py-1.5"><input type="checkbox" checked={sel.has(o.id)} onChange={() => toggle(o.id)} /></td>}
                <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{o.order_date ? new Date(o.order_date).toLocaleDateString("vi-VN") : "—"}</td>
                <td className="whitespace-nowrap px-3 py-1.5">
                  <Link href={`/orders/${o.id}`} className="text-blue-600 hover:underline">{o.platform_order_id}</Link>
                  {o.items.length > 1 && <Badge tone="blue" className="ml-1">{o.items.length} SP</Badge>}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5">{o.selling_account_name ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-1.5">{o.seller_name ?? "—"}</td>
                <td className="px-3 py-1.5">
                  <div className="max-w-[150px] truncate">{o.customer_name ?? "—"}</div>
                  {o.customer_contact && <div className="text-xs text-slate-400">{o.customer_contact}</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5"><StatusBadge status={stageOf(o.items)} /></td>
                <td className="whitespace-nowrap px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    {o.tracking_number ? <span className="max-w-[130px] truncate">{o.tracking_number}</span> : "—"}
                    {o.label_link && <a href={o.label_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">label</a>}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5">{o.order_value != null ? "$" + Number(o.order_value).toLocaleString("en-US") : "—"}</td>
                <td className="px-3 py-1.5"><div className="max-w-[200px] truncate">{o.items[0]?.product_title ?? "—"}{o.items[0]?.size ? ` · ${o.items[0].size}` : ""}</div></td>
                <td className="px-3 py-1.5">
                  <input defaultValue={o.seller_note ?? ""} onBlur={(e) => { if (e.target.value !== (o.seller_note ?? "")) updateNote(o.id, e.target.value); }}
                    className="w-36 rounded border border-transparent px-1 py-0.5 hover:border-slate-300 focus:border-slate-500 focus:outline-none" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phân trang */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Tổng <b>{total.toLocaleString("en-US")}</b> đơn{stage ? ` · lọc tiến độ trong trang: ${rows.length}` : ""}</span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>← Trước</Button>
          <span>Trang {page}/{totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => go({ page: page + 1 })}>Sau →</Button>
        </div>
      </div>
    </div>
  );
}
