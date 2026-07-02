"use client";

import { useState, useCallback } from "react";
import { saveOrderRow, type OrderRowInput } from "./actions";

export type TemplateOpt = {
  id: string; code: string | null; name: string;
  product_type: string | null; dimension: string | null;
  factory_id: string | null; factory_name: string | null;
};
export type AccountOpt = { id: string; name: string };

const ITEM_STATUS = ["new", "waiting_design", "design_ok", "ordered", "in_production", "has_tracking", "synced", "delivered", "issue", "cancelled"];

type Row = {
  key: number;
  orderId: string; orderDate: string; sellingAccountId: string; labelLink: string;
  customerName: string; customerContact: string; customerAddress: string;
  templateId: string; productType: string; factoryId: string; factoryName: string; dimension: string;
  skuPhoi: string; size: string; color: string; quantity: string;
  listingLink: string; designLink: string; confirmDesign: boolean; sellerNote: string;
  // FFM
  factoryOrderId: string; carrier: string; pushedAt: string; trackingNumber: string; itemStatus: string;
  savedOrderId?: string; savedItemId?: string;
  status: "" | "saving" | "saved" | "error"; error?: string;
};

let SEQ = 1;
const emptyRow = (): Row => ({
  key: SEQ++, orderId: "", orderDate: "", sellingAccountId: "", labelLink: "",
  customerName: "", customerContact: "", customerAddress: "", templateId: "", productType: "",
  factoryId: "", factoryName: "", dimension: "", skuPhoi: "", size: "", color: "", quantity: "1",
  listingLink: "", designLink: "", confirmDesign: false, sellerNote: "",
  factoryOrderId: "", carrier: "", pushedAt: "", trackingNumber: "", itemStatus: "", status: "",
});
const isEmpty = (r: Row) => !r.orderId && !r.templateId && !r.customerName && !r.skuPhoi && !r.labelLink;

const inp = "w-full min-w-[7rem] rounded border border-transparent bg-transparent px-1 py-1 hover:border-slate-300 focus:border-slate-500 focus:outline-none";
const autoCls = "w-full min-w-[7rem] rounded bg-emerald-50 px-1 py-1 text-slate-500";
const ffmInp = "w-full min-w-[7rem] rounded border border-transparent bg-transparent px-1 py-1 hover:border-slate-300 focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function aging(d: string): number | null {
  if (!d) return null;
  const t = Date.parse(d + "T00:00:00");
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000);
}

export function OrderSheet({
  templates, accounts, sellerName, isFFM,
}: { templates: TemplateOpt[]; accounts: AccountOpt[]; sellerName: string; isFFM: boolean }) {
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);
  const [savingAll, setSavingAll] = useState(false);

  const patch = useCallback((key: number, up: Partial<Row>) => {
    setRows((rs) => {
      const next = rs.map((r) => (r.key === key ? { ...r, ...up, status: up.status ?? (r.status === "saved" ? "" : r.status) } : r));
      const trailingEmpty = [...next].reverse().findIndex((r) => !isEmpty(r));
      const emptyCount = trailingEmpty === -1 ? next.length : trailingEmpty;
      if (emptyCount < 2) next.push(emptyRow());
      return next;
    });
  }, []);

  function onTemplate(key: number, templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    patch(key, {
      templateId, productType: t?.product_type ?? "", dimension: t?.dimension ?? "",
      factoryId: t?.factory_id ?? "", factoryName: t?.factory_name ?? "",
    });
  }

  function toInput(r: Row): OrderRowInput {
    return {
      orderId: r.orderId, orderDate: r.orderDate || null, sellingAccountId: r.sellingAccountId || null,
      labelLink: r.labelLink || null, customerName: r.customerName || null,
      customerContact: r.customerContact || null, customerAddress: r.customerAddress || null,
      sellerNote: r.sellerNote || null, templateId: r.templateId || null, productType: r.productType || null,
      factoryId: r.factoryId || null, dimension: r.dimension || null, skuPhoi: r.skuPhoi || null,
      size: r.size || null, color: r.color || null, quantity: Number(r.quantity) || 1,
      listingLink: r.listingLink || null, designLink: r.designLink || null, confirmDesign: r.confirmDesign,
      factoryOrderId: r.factoryOrderId || null, carrier: r.carrier || null, pushedAt: r.pushedAt || null,
      trackingNumber: r.trackingNumber || null, itemStatus: r.itemStatus || null,
      savedOrderId: r.savedOrderId, savedItemId: r.savedItemId,
    };
  }

  async function saveRow(key: number) {
    const r = rows.find((x) => x.key === key);
    if (!r || isEmpty(r)) return;
    if (!r.orderId.trim()) { patch(key, { status: "error", error: "Thiếu Order ID" }); return; }
    patch(key, { status: "saving", error: undefined });
    const res = await saveOrderRow(toInput(r));
    if (res.ok) patch(key, { status: "saved", savedOrderId: res.orderId, savedItemId: res.itemId });
    else patch(key, { status: "error", error: res.error });
  }

  async function saveAll() {
    setSavingAll(true);
    for (const r of rows) if (!isEmpty(r) && r.status !== "saved") await saveRow(r.key);
    setSavingAll(false);
  }

  const filled = rows.filter((r) => !isEmpty(r)).length;
  const Gb = "bg-blue-700 text-white text-xs font-semibold px-2 py-1 text-center";
  const Ge = "bg-emerald-700 text-white text-xs font-semibold px-2 py-1 text-center";
  const Gp = "bg-orange-600 text-white text-xs font-semibold px-2 py-1 text-center";
  const Gg = "bg-green-700 text-white text-xs font-semibold px-2 py-1 text-center";
  const Gd = "bg-slate-600 text-white text-xs font-semibold px-2 py-1 text-center";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Nhập như Excel. Chọn <b>Template</b> → tự điền ô <span className="rounded bg-emerald-50 px-1 text-emerald-700">xanh (auto)</span>.
          Cột <b className="text-blue-700">🔵 Seller</b> bạn điền; cột <b className="text-green-700">🟢 FFM</b>
          {isFFM ? " bạn (FFM) điền" : " do FFM điền (bạn chỉ xem)"}. Platform=TTS, Shipped by=TikTok Shipping, Seller={sellerName} tự gán.
        </p>
        <button onClick={saveAll} disabled={savingAll || filled === 0}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
          {savingAll ? "Đang lưu…" : `Lưu ${filled} dòng`}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-max text-sm">
          <thead>
            <tr>
              <th className={Gb} colSpan={4}>🔵 Thông tin đơn (Seller)</th>
              <th className={Gb} colSpan={3}>Khách hàng</th>
              <th className={Gb} colSpan={1}>Sản phẩm</th>
              <th className={Ge} colSpan={3}>Auto (Template)</th>
              <th className={Gb} colSpan={4}>Sản phẩm (Seller)</th>
              <th className={Gp} colSpan={1}>🎨 Thiết kế</th>
              <th className={Gg} colSpan={5}>🟢 Vận chuyển &amp; FFM</th>
              <th className={Gd} colSpan={1}>⏱</th>
              <th className={Gd} colSpan={1}></th>
            </tr>
            <tr className="bg-slate-100 text-left">
              {["Ngày order", "Order ID", "TK bán", "Link Label", "Tên khách", "SĐT", "Địa chỉ",
                "Template", "Product Type", "Nhà in/Xưởng", "Dimension", "Phôi/SKU", "Size", "Color", "SL",
                "Confirm DS", "Order FFM", "Carrier", "Ngày đẩy", "Tracking", "Trạng thái", "Ngày", ""].map((h, i) => (
                <th key={i} className="whitespace-nowrap px-2 py-1.5 font-medium text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const days = aging(r.orderDate);
              return (
                <tr key={r.key} className="border-t border-slate-100 align-top">
                  <td className="px-1"><input type="date" value={r.orderDate} onChange={(e) => patch(r.key, { orderDate: e.target.value })} className={inp} /></td>
                  <td className="px-1"><input value={r.orderId} onChange={(e) => patch(r.key, { orderId: e.target.value })} placeholder="577…" className={inp} /></td>
                  <td className="px-1">
                    <select value={r.sellingAccountId} onChange={(e) => patch(r.key, { sellingAccountId: e.target.value })} className={inp}>
                      <option value="">—</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </td>
                  <td className="px-1"><input value={r.labelLink} onChange={(e) => patch(r.key, { labelLink: e.target.value })} className={inp} /></td>
                  <td className="px-1"><input value={r.customerName} onChange={(e) => patch(r.key, { customerName: e.target.value })} className={inp} /></td>
                  <td className="px-1"><input value={r.customerContact} onChange={(e) => patch(r.key, { customerContact: e.target.value })} className={inp} /></td>
                  <td className="px-1"><input value={r.customerAddress} onChange={(e) => patch(r.key, { customerAddress: e.target.value })} className={inp} /></td>
                  <td className="px-1">
                    <select value={r.templateId} onChange={(e) => onTemplate(r.key, e.target.value)} className={inp + " min-w-[12rem]"}>
                      <option value="">— chọn —</option>
                      {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </td>
                  <td className="px-1"><input value={r.productType} readOnly className={autoCls} /></td>
                  <td className="px-1"><input value={r.factoryName} readOnly className={autoCls} /></td>
                  <td className="px-1"><input value={r.dimension} readOnly className={autoCls} /></td>
                  <td className="px-1"><input value={r.skuPhoi} onChange={(e) => patch(r.key, { skuPhoi: e.target.value })} className={inp} /></td>
                  <td className="px-1"><input value={r.size} onChange={(e) => patch(r.key, { size: e.target.value })} className={inp + " min-w-[4rem]"} /></td>
                  <td className="px-1"><input value={r.color} onChange={(e) => patch(r.key, { color: e.target.value })} className={inp + " min-w-[5rem]"} /></td>
                  <td className="px-1"><input value={r.quantity} onChange={(e) => patch(r.key, { quantity: e.target.value })} className={inp + " min-w-[3rem]"} /></td>
                  <td className="px-1 text-center"><input type="checkbox" checked={r.confirmDesign} onChange={(e) => patch(r.key, { confirmDesign: e.target.checked })} /></td>
                  {/* FFM */}
                  <td className="bg-green-50/40 px-1"><input value={r.factoryOrderId} disabled={!isFFM} onChange={(e) => patch(r.key, { factoryOrderId: e.target.value })} className={ffmInp} /></td>
                  <td className="bg-green-50/40 px-1"><input value={r.carrier} disabled={!isFFM} onChange={(e) => patch(r.key, { carrier: e.target.value })} className={ffmInp + " min-w-[5rem]"} /></td>
                  <td className="bg-green-50/40 px-1"><input type="date" value={r.pushedAt} disabled={!isFFM} onChange={(e) => patch(r.key, { pushedAt: e.target.value })} className={ffmInp} /></td>
                  <td className="bg-green-50/40 px-1"><input value={r.trackingNumber} disabled={!isFFM} onChange={(e) => patch(r.key, { trackingNumber: e.target.value })} className={ffmInp} /></td>
                  <td className="bg-green-50/40 px-1">
                    <select value={r.itemStatus} disabled={!isFFM} onChange={(e) => patch(r.key, { itemStatus: e.target.value })} className={ffmInp}>
                      <option value="">—</option>
                      {ITEM_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-1 text-center">
                    {days != null && (
                      <span className={"rounded-full px-2 py-0.5 text-xs " + (days >= 5 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500")}>{days}n</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2">
                    {isEmpty(r) ? <span className="text-xs text-slate-300">—</span> : (
                      <button onClick={() => saveRow(r.key)} disabled={r.status === "saving"}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                        {r.status === "saving" ? "…" : r.status === "saved" ? "✓" : "Lưu"}
                      </button>
                    )}
                    {r.status === "error" && <div className="max-w-[10rem] text-xs text-red-500">{r.error}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Cột <b className="text-green-700">🟢 FFM</b> {isFFM ? "bạn điền được" : "bị khoá với seller"} — đúng phân chia như sheet cũ.
        Cột <b>⏱ Ngày</b> = số ngày kể từ Ngày order (≥5 ngày chuyển cam) để thấy đơn tồn đọng.
      </p>
    </div>
  );
}
