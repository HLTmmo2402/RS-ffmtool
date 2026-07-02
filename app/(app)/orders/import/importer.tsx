"use client";

import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parseCotik } from "@/lib/import/cotik";
import { parseRsaSheet } from "@/lib/import/rsa";
import type { ParseResult } from "@/lib/import/shared";
import { importParsedOrders, type ImportSource, type ImportResult } from "./actions";

type Source = ImportSource;
const CHUNK = 150; // số đơn/lô gửi lên server (tránh giới hạn body của server action)

function mergeResults(list: ParseResult[]): ParseResult {
  const orders = list.flatMap((r) => r.orders);
  return {
    orders,
    warnings: list.flatMap((r) => r.warnings),
    stats: {
      totalRows: list.reduce((n, r) => n + r.stats.totalRows, 0),
      orders: orders.length,
      items: orders.reduce((n, o) => n + o.items.length, 0),
      multiItemOrders: orders.filter((o) => o.items.length > 1).length,
    },
  };
}

export function Importer() {
  const [source, setSource] = useState<Source>("cotik");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("__ALL__");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setParsed(null); setWb(null); setSheetNames([]); setSelectedSheet("__ALL__");
    setSummary(null); setErr(null); setProgress(0);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();
    setFileName(file.name);

    if (source === "cotik") {
      Papa.parse<Record<string, string>>(file, {
        header: true, skipEmptyLines: true,
        complete: (res) => setParsed(parseCotik(res.data)),
        error: (er) => setErr("Đọc CSV lỗi: " + er.message),
      });
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const book = XLSX.read(reader.result, { type: "array", cellDates: true });
          // chỉ giữ các sheet có cột Order ID (bỏ pivot/hướng dẫn)
          const orderSheets = book.SheetNames.filter((n) => {
            const aoa = XLSX.utils.sheet_to_json(book.Sheets[n], { header: 1, blankrows: false }) as unknown[][];
            return aoa.slice(0, 10).some((row) => (row || []).some((c) => String(c ?? "").toLowerCase().replace(/\s/g, "").includes("orderid")));
          });
          setWb(book);
          setSheetNames(orderSheets);
          const def = orderSheets.length ? "__ALL__" : "";
          setSelectedSheet(def);
          if (orderSheets.length) parseSheets(book, orderSheets, def);
          else setErr("File không có sheet nào chứa cột Order ID.");
        } catch (er) {
          setErr("Đọc Excel lỗi: " + (er as Error).message);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  function parseSheets(book: XLSX.WorkBook, names: string[], sel: string) {
    const targets = sel === "__ALL__" ? names : [sel];
    const results = targets.map((n) => {
      const aoa = XLSX.utils.sheet_to_json(book.Sheets[n], { header: 1, blankrows: false, raw: true }) as unknown[][];
      return parseRsaSheet(aoa, n);
    });
    setParsed(mergeResults(results));
  }

  function onSelectSheet(v: string) {
    setSelectedSheet(v);
    if (wb) parseSheets(wb, sheetNames, v);
  }

  async function runImport() {
    if (!parsed) return;
    setBusy(true); setErr(null); setSummary(null); setProgress(0);
    const all = parsed.orders;
    const agg = { ordersUpserted: 0, itemsInserted: 0, skipped: 0 };
    const unAcc = new Set<string>(); const unFac = new Set<string>();
    for (let i = 0; i < all.length; i += CHUNK) {
      const chunk = all.slice(i, i + CHUNK);
      let res: ImportResult;
      try {
        res = await importParsedOrders(chunk, source);
      } catch (e) {
        setErr("Lỗi gọi máy chủ: " + (e as Error).message); setBusy(false); return;
      }
      if (!res.ok) { setErr(res.error); setBusy(false); return; }
      agg.ordersUpserted += res.ordersUpserted;
      agg.itemsInserted += res.itemsInserted;
      agg.skipped += res.skippedExistingOrders;
      res.unmatchedAccounts.forEach((x) => unAcc.add(x));
      res.unmatchedFactories.forEach((x) => unFac.add(x));
      setProgress(Math.min(all.length, i + CHUNK));
    }
    setBusy(false);
    let msg = `✅ Nạp ${agg.ordersUpserted} đơn · ${agg.itemsInserted} sản phẩm.`;
    if (agg.skipped) msg += ` (${agg.skipped} đơn đã có: chỉ cập nhật thông tin đơn, giữ nguyên sản phẩm/FFM.)`;
    if (unAcc.size) msg += `\n⚠ TK bán chưa có trong danh mục (cần Admin/FFM thêm): ${[...unAcc].join(", ")}`;
    if (unFac.size) msg += `\n⚠ Xưởng chưa có trong danh mục: ${[...unFac].join(", ")}`;
    setSummary(msg);
  }

  const st = parsed?.stats;

  return (
    <div className="space-y-5">
      {/* 1. Nguồn */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium">1. Chọn nguồn dữ liệu</div>
        <div className="mt-2 flex flex-wrap gap-3">
          {([
            ["cotik", "Cotik export (.csv)", "File Export đơn từ Cotik"],
            ["rsa_ffm", "Sheet RSA-FFM (.xlsx)", "File Excel 'Đơn đang đi' của seller"],
          ] as [Source, string, string][]).map(([val, label, hint]) => (
            <label key={val}
              className={"flex cursor-pointer flex-col rounded-lg border px-4 py-2 " +
                (source === val ? "border-slate-900 bg-slate-50" : "border-slate-200")}>
              <span className="flex items-center gap-2 text-sm font-medium">
                <input type="radio" name="src" checked={source === val}
                  onChange={() => { setSource(val); setFileName(""); reset(); }} />
                {label}
              </span>
              <span className="ml-6 text-xs text-slate-500">{hint}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 2. Upload */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium">
          2. Tải file lên {source === "cotik" ? "(.csv)" : "(.xlsx)"}
        </label>
        <input type="file" accept={source === "cotik" ? ".csv,text/csv" : ".xlsx"}
          onChange={onFile} className="mt-2 block text-sm" />
        {fileName && <p className="mt-1 text-xs text-slate-500">{fileName}</p>}

        {source === "rsa_ffm" && sheetNames.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-slate-600">Sheet:</span>
            <select value={selectedSheet} onChange={(e) => onSelectSheet(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1">
              <option value="__ALL__">Tất cả sheet đơn ({sheetNames.length})</option>
              {sheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>

      {err && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {/* 3. Preview */}
      {st && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Dòng đọc được", st.totalRows], ["Đơn (đã gộp)", st.orders],
              ["Sản phẩm", st.items], ["Đơn nhiều SP", st.multiItemOrders],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xl font-semibold">{v as number}</div>
                <div className="text-xs text-slate-500">{k as string}</div>
              </div>
            ))}
          </div>

          {parsed!.warnings.length > 0 && (
            <details className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <summary className="cursor-pointer font-medium">
                {parsed!.warnings.length} cảnh báo dữ liệu (bấm xem)
              </summary>
              <ul className="mt-2 max-h-40 list-disc space-y-0.5 overflow-auto pl-5 text-xs">
                {parsed!.warnings.slice(0, 50).map((w, i) => (
                  <li key={i}>Dòng {String(w.row)}: {w.message}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>{["Order ID", "Sàn", "TK bán", "Seller", "Khách", "SP", "SP đầu tiên", "Trạng thái"].map((h) =>
                  <th key={h} className="px-3 py-2 font-medium text-slate-600">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {parsed!.orders.slice(0, 8).map((o) => (
                  <tr key={o.platform_order_id} className="border-t border-slate-100">
                    <td className="px-3 py-1.5">{o.platform_order_id}</td>
                    <td className="px-3 py-1.5">{o.platform}</td>
                    <td className="px-3 py-1.5">{o.selling_account_name ?? "—"}</td>
                    <td className="px-3 py-1.5">{o.seller_name ?? "—"}</td>
                    <td className="max-w-[160px] truncate px-3 py-1.5">{o.customer_name ?? "—"}</td>
                    <td className="px-3 py-1.5">{o.items.length}</td>
                    <td className="max-w-[220px] truncate px-3 py-1.5">
                      {o.items[0]?.product_title ?? "—"}
                      {o.items[0]?.size ? ` · ${o.items[0].size}` : ""}
                    </td>
                    <td className="px-3 py-1.5"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{o.items[0]?.item_status ?? "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4. Import */}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={runImport} disabled={busy || st.orders === 0}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
              {busy ? `Đang nạp… ${progress}/${st.orders}` : `4. Nạp ${st.orders} đơn vào hệ thống`}
            </button>
            {summary && <span className="whitespace-pre-line text-sm">{summary}</span>}
          </div>
        </>
      )}
    </div>
  );
}
