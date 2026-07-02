"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateOrder, updateOrderItem, addOrderItem, deleteOrderItem,
} from "./actions";

type Item = Record<string, unknown> & { id: string; source_line: number | null };
type Order = Record<string, unknown> & {
  id: string; platform: string; platform_order_id: string;
  order_items: Item[]; selling_accounts: { name: string } | null;
};
type Opt = { id: string; name?: string; email?: string; factory_id?: string; platform?: string };

const ITEM_STATUS = ["new", "waiting_design", "design_ok", "ordered", "in_production", "has_tracking", "synced", "delivered", "issue", "cancelled"];
const TRACK_STATUS = ["none", "in_transit", "delivered", "returned"];

const box = "w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-500";

function Field({ label, value, onSave, type = "text", options, disabled }: {
  label: string; value: unknown; onSave: (v: string) => void;
  type?: "text" | "number" | "date" | "select"; options?: { v: string; l: string }[]; disabled?: boolean;
}) {
  const [v, setV] = useState(value == null ? "" : String(value));
  const commit = () => { if (v !== (value == null ? "" : String(value))) onSave(v); };
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500">{label}</span>
      {type === "select" ? (
        <select className={box} value={v} disabled={disabled}
          onChange={(e) => { setV(e.target.value); if (!disabled) onSave(e.target.value); }}>
          {options?.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : (
        <input className={box} type={type} value={v} disabled={disabled}
          onChange={(e) => setV(e.target.value)} onBlur={commit} />
      )}
    </label>
  );
}

export function OrderDetail({ order, role, factories, accounts, factoryAccounts }: {
  order: Order; role: string; factories: Opt[]; accounts: Opt[]; factoryAccounts: Opt[];
}) {
  const router = useRouter();
  const isFFM = role === "ffm" || role === "admin";
  const items = [...(order.order_items ?? [])].sort(
    (a, b) => (a.source_line ?? 0) - (b.source_line ?? 0) || String(a.id).localeCompare(String(b.id))
  );

  async function saveOrder(col: string, val: string, num = false) {
    const r = await updateOrder(order.id, { [col]: num ? (val === "" ? null : Number(val)) : val });
    if (!r.ok) alert("Lưu lỗi: " + r.error); else router.refresh();
  }
  async function saveItem(id: string, col: string, val: string | boolean, num = false) {
    const value = num ? (val === "" ? null : Number(val)) : val;
    const r = await updateOrderItem(id, { [col]: value });
    if (!r.ok) alert("Lưu lỗi: " + r.error); else router.refresh();
  }

  const facOpts = [{ v: "", l: "—" }, ...factories.map((f) => ({ v: f.id, l: f.name ?? "" }))];
  const accOpts = [{ v: "", l: "—" }, ...accounts.map((a) => ({ v: a.id, l: a.name ?? "" }))];

  return (
    <div className="space-y-4">
      {/* ---- Header đơn ---- */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-3">
          <h1 className="text-lg font-semibold">Đơn {order.platform_order_id}</h1>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{order.platform}</span>
          <span className="text-sm text-slate-400">{items.length} sản phẩm</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Ngày order" type="date" value={order.order_date} onSave={(v) => saveOrder("order_date", v)} />
          <Field label="TK bán" type="select" value={order.selling_account_id}
            options={accOpts} onSave={(v) => saveOrder("selling_account_id", v)} />
          <Field label="Trạng thái sàn" value={order.platform_status} onSave={(v) => saveOrder("platform_status", v)} />
          <Field label="Giá trị ($)" type="number" value={order.order_value} onSave={(v) => saveOrder("order_value", v, true)} />
          <Field label="Tên khách" value={order.customer_name} onSave={(v) => saveOrder("customer_name", v)} />
          <Field label="SĐT" value={order.customer_contact} onSave={(v) => saveOrder("customer_contact", v)} />
          <Field label="Địa chỉ" value={order.customer_address} onSave={(v) => saveOrder("customer_address", v)} />
          <Field label="Link Label" value={order.label_link} onSave={(v) => saveOrder("label_link", v)} />
          <Field label="Tracking (đơn)" value={order.tracking_number} onSave={(v) => saveOrder("tracking_number", v)} />
          <Field label="Ghi chú seller" value={order.seller_note} onSave={(v) => saveOrder("seller_note", v)} />
        </div>
      </div>

      {/* ---- Sản phẩm ---- */}
      {items.map((it, i) => {
        const facAccOpts = [{ v: "", l: "—" },
          ...factoryAccounts.filter((fa) => fa.factory_id === it.factory_id).map((fa) => ({ v: fa.id, l: fa.email ?? "" }))];
        return (
          <div key={it.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium">Sản phẩm #{it.source_line ?? i + 1}
                <span className="ml-2 text-sm font-normal text-slate-500">{(it.product_title as string) ?? ""}</span>
              </div>
              <button onClick={async () => { if (confirm("Xoá sản phẩm này?")) { await deleteOrderItem(it.id); router.refresh(); } }}
                className="text-xs text-red-600 hover:underline">Xoá</button>
            </div>

            {/* Seller nhập */}
            <div className="rounded-md bg-blue-50/40 p-2">
              <div className="mb-1 text-xs font-semibold text-blue-800">🔵 Seller nhập</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Product Type" value={it.product_type} onSave={(v) => saveItem(it.id, "product_type", v)} />
                <Field label="Dimension" value={it.dimension} onSave={(v) => saveItem(it.id, "dimension", v)} />
                <Field label="Phôi/SKU" value={it.sku_phoi} onSave={(v) => saveItem(it.id, "sku_phoi", v)} />
                <Field label="Size" value={it.size} onSave={(v) => saveItem(it.id, "size", v)} />
                <Field label="Color" value={it.color} onSave={(v) => saveItem(it.id, "color", v)} />
                <Field label="SL" type="number" value={it.quantity} onSave={(v) => saveItem(it.id, "quantity", v, true)} />
                <Field label="Link design" value={it.design_link} onSave={(v) => saveItem(it.id, "design_link", v)} />
                <Field label="Confirm design" type="select" value={it.confirm_design ? "true" : "false"}
                  options={[{ v: "false", l: "Chưa" }, { v: "true", l: "Done" }]}
                  onSave={(v) => saveItem(it.id, "confirm_design", v === "true")} />
              </div>
            </div>

            {/* FFM cập nhật */}
            <div className="mt-2 rounded-md bg-emerald-50/50 p-2">
              <div className="mb-1 text-xs font-semibold text-emerald-800">
                🟢 FFM cập nhật {!isFFM && <span className="font-normal text-slate-400">(chỉ FFM/Admin sửa)</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Xưởng" type="select" value={it.factory_id} options={facOpts} disabled={!isFFM}
                  onSave={(v) => saveItem(it.id, "factory_id", v)} />
                <Field label="TK xưởng (email)" type="select" value={it.factory_account_id} options={facAccOpts} disabled={!isFFM}
                  onSave={(v) => saveItem(it.id, "factory_account_id", v)} />
                <Field label="Order FFM" value={it.factory_order_id} disabled={!isFFM}
                  onSave={(v) => saveItem(it.id, "factory_order_id", v)} />
                <Field label="Tracking" value={it.tracking_number} disabled={!isFFM}
                  onSave={(v) => saveItem(it.id, "tracking_number", v)} />
                <Field label="Tracking status" type="select" value={it.tracking_status} disabled={!isFFM}
                  options={TRACK_STATUS.map((s) => ({ v: s, l: s }))} onSave={(v) => saveItem(it.id, "tracking_status", v)} />
                <Field label="Trạng thái item" type="select" value={it.item_status} disabled={!isFFM}
                  options={ITEM_STATUS.map((s) => ({ v: s, l: s }))} onSave={(v) => saveItem(it.id, "item_status", v)} />
                <Field label="Carrier" value={it.carrier} disabled={!isFFM} onSave={(v) => saveItem(it.id, "carrier", v)} />
                <Field label="Ngày đẩy đơn" type="date" value={it.pushed_at} disabled={!isFFM}
                  onSave={(v) => saveItem(it.id, "pushed_at", v)} />
                <Field label="Chi phí hàng ($)" type="number" value={it.fulfillment_cost} disabled={!isFFM}
                  onSave={(v) => saveItem(it.id, "fulfillment_cost", v, true)} />
                <Field label="Phí ship ($)" type="number" value={it.shipping_cost} disabled={!isFFM}
                  onSave={(v) => saveItem(it.id, "shipping_cost", v, true)} />
              </div>
            </div>
          </div>
        );
      })}

      <button onClick={async () => { const r = await addOrderItem(order.id); if (r.ok) router.refresh(); else alert(r.error); }}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
        + Thêm sản phẩm
      </button>
    </div>
  );
}
