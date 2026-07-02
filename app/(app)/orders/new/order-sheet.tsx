"use client";

import { useState, useCallback } from "react";
import { saveOrderRow, type OrderRowInput } from "./actions";

export type TemplateOpt = {
  id: string; code: string | null; name: string;
  product_type: string | null; dimension: string | null;
  factory_id: string | null; factory_name: string | null;
};
export type AccountOpt = { id: string; name: string };

type Row = {
  key: number;
  orderId: string;
  orderDate: string;
  sellingAccountId: string;
  labelLink: string;
  customerName: string;
  customerContact: string;
  customerAddress: string;
  templateId: string;
  productType: string;
  factoryId: string;
  factoryName: string;
  dimension: string;
  skuPhoi: string;
  size: string;
  color: string;
  quantity: string;
  listingLink: string;
  designLink: string;
  confirmDesign: boolean;
  sellerNote: string;
  savedOrderId?: string;
  savedItemId?: string;
  status: "" | "saving" | "saved" | "error";
  error?: string;
};

let SEQ = 1;
const emptyRow = (): Row => ({
  key: SEQ++, orderId: "", orderDate: "", sellingAccountId: "", labelLink: "",
  customerName: "", customerContact: "", customerAddress: "", templateId: "",
  productType: "", factoryId: "", factoryName: "", dimension: "", skuPhoi: "",
  size: "", color: "", quantity: "1", listingLink: "", designLink: "",
  confirmDesign: false, sellerNote: "", status: "",
});
const isEmpty = (r: Row) =>
  !r.orderId && !r.templateId && !r.customerName && !r.skuPhoi && !r.labelLink;

const inp = "w-full min-w-[7rem] rounded border border-transparent bg-transparent px-1 py-1 hover:border-slate-300 focus:border-slate-500 focus:outline-none";
const autoCls = "w-full min-w-[7rem] rounded bg-green-50 px-1 py-1 text-slate-500";

export function OrderSheet({
  templates, accounts, sellerName,
}: { templates: TemplateOpt[]; accounts: AccountOpt[]; sellerName: string }) {
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);
  const [savingAll, setSavingAll] = useState(false);

  const patch = useCallback((key: number, up: Partial<Row>) => {
    setRows((rs) => {
      const next = rs.map((r) => (r.key === key ? { ...r, ...up, status: up.status ?? (r.status === "saved" ? "" : r.status) } : r));
      // luôn còn >=2 dòng trống ở cuối (gõ gần hết tự sinh thêm)
      const trailingEmpty = [...next].reverse().findIndex((r) => !isEmpty(r));
      const emptyCount = trailingEmpty === -1 ? next.length : trailingEmpty;
      if (emptyCount < 2) next.push(emptyRow());
      return next;
    });
  }, []);

  function onTemplate(key: number, templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    patch(key, {
      templateId,
      productType: t?.product_type ?? "",
      dimension: t?.dimension ?? "",
      factoryId: t?.factory_id ?? "",
      factoryName: t?.factory_name ?? "",
    });
  }

  function toInput(r: Row): OrderRowInput {
    return {
      orderId: r.orderId, orderDate: r.orderDate || null, sellingAccountId: r.sellingAccountId || null,
      labelLink: r.labelLink || null, customerName: r.customerName || null,
      customerContact: r.customerContact || null, customerAddress: r.customerAddress || null,
      sellerNote: r.sellerNote || null, templateId: r.templateId || null,
      productType: r.productType || null, factoryId: r.factoryId || null, dimension: r.dimension || null,
      skuPhoi: r.skuPhoi || null, size: r.size || null, color: r.color || null,
      quantity: Number(r.quantity) || 1, listingLink: r.listingLink || null, designLink: r.designLink || null,
      confirmDesign: r.confirmDesign, savedOrderId: r.savedOrderId, savedItemId: r.savedItemId,
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

  const G = "bg-slate-800 text-white text-xs font-semibold px-2 py-1 text-center";
  const Gs = "bg-emerald-700 text-white text-xs font-semibold px-2 py-1 text-center"; // nhóm auto

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Nhập như Excel: gõ thẳng vào dòng, <b>Enter/Tab</b> để sang ô. Chọn <b>Template</b> → tự điền
          các ô <span className="rounded bg-green-50 px-1 text-green-700">xanh (auto)</span>.
          Cột <b>Platform=TTS</b>, <b>Shipped by=TikTok Shipping</b>, <b>Seller={sellerName}</b> đã tự gán, không cần điền.
        </p>
        <button onClick={saveAll} disabled={savingAll || filled === 0}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
          {savingAll ? "Đang lưu…" : `Lưu ${filled} dòng`}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-max text-sm">
          <thead>
            {/* nhóm cột (giống bố cục sheet) */}
            <tr>
              <th className={G} colSpan={4}>Thông tin đơn hàng</th>
              <th className={G} colSpan={3}>Khách hàng</th>
              <th className={G} colSpan={1}>Sản phẩm</th>
              <th className={Gs} colSpan={3}>Auto (từ Template)</th>
              <th className={G} colSpan={5}>Sản phẩm & Thiết kế</th>
              <th className={G} colSpan={1}></th>
            </tr>
            <tr className="bg-slate-100 text-left">
              {["Ngày Order", "Order ID", "TK bán", "Link Label",
                "Tên khách", "SĐT", "Địa chỉ",
                "Template", "Product Type", "Nhà in/Xưởng", "Dimension",
                "Phôi/SKU", "Size", "Color", "SL", "Confirm Design", ""].map((h, i) => (
                <th key={i} className="whitespace-nowrap px-2 py-1.5 font-medium text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
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
                <td className="whitespace-nowrap px-2">
                  {isEmpty(r) ? <span className="text-xs text-slate-300">—</span> : (
                    <button onClick={() => saveRow(r.key)} disabled={r.status === "saving"}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                      {r.status === "saving" ? "…" : r.status === "saved" ? "✓ đã lưu" : "Lưu"}
                    </button>
                  )}
                  {r.status === "error" && <div className="max-w-[10rem] text-xs text-red-500">{r.error}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        2 dòng trống luôn sẵn ở cuối; gõ gần hết sẽ tự thêm dòng. Cột thiết kế/vận chuyển của FFM (Order FFM,
        Tracking, Carrier…) cập nhật ở mục <b>Đơn hàng</b>.
      </p>
    </div>
  );
}
