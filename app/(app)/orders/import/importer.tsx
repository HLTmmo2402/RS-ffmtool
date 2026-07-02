"use client";

import { useState } from "react";
import Papa from "papaparse";
import { importOrders, type ImportRow } from "./actions";

type Raw = Record<string, string>;

const TARGET_FIELDS: {
  key: string;
  label: string;
  required?: boolean;
  guess: RegExp;
}[] = [
  { key: "platform_order_id", label: "Order ID", required: true, guess: /order.?id|mã.?đơn|^id$/i },
  { key: "order_date", label: "Ngày order", guess: /date|ngày|created|thời gian/i },
  { key: "customer_name", label: "Tên khách", guess: /(customer|buyer|recipient).*name|name|khách|tên|họ tên/i },
  { key: "customer_contact", label: "SĐT khách", guess: /phone|contact|sđt|tel|số điện/i },
  { key: "customer_address", label: "Địa chỉ", guess: /address|địa chỉ|shipping.?addr/i },
  { key: "tracking_number", label: "Tracking", guess: /tracking/i },
  { key: "label_link", label: "Link label", guess: /label.*(link|url)|shipping.?label|label/i },
  { key: "platform_status", label: "Trạng thái sàn", guess: /status|trạng thái/i },
  { key: "buyer_note", label: "Buyer note", guess: /buyer.?note|note|ghi chú|message|lời nhắn/i },
  { key: "delivery_instructions", label: "HD giao hàng", guess: /delivery|instruction|giao hàng/i },
  { key: "label_fee", label: "Phí label ($)", guess: /label.?fee|phí.?label|shipping.?fee/i },
];

function parseDate(s: string): string | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); // DD-MM-YYYY (Cotik)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); // YYYY-MM-DD
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

function parseFee(s: string): number | null {
  const t = (s ?? "").replace(/[^0-9.]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

function autoGuess(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  for (const f of TARGET_FIELDS) {
    const hit = headers.find((h) => !used.has(h) && f.guess.test(h));
    if (hit) {
      map[f.key] = hit;
      used.add(hit);
    }
  }
  return map;
}

export function Importer() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Raw[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [platform, setPlatform] = useState<"TTS" | "AMZ">("TTS");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    Papa.parse<Raw>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = (res.meta.fields ?? []).filter((h) => h && h.trim());
        setHeaders(hs);
        setRows(res.data as Raw[]);
        setMap(autoGuess(hs));
      },
    });
  }

  function get(row: Raw, key: string): string {
    const col = map[key];
    return col ? (row[col] ?? "").toString().trim() : "";
  }

  function buildRows(): ImportRow[] {
    return rows.map((row) => ({
      platform_order_id: get(row, "platform_order_id"),
      platform,
      order_date: parseDate(get(row, "order_date")),
      customer_name: get(row, "customer_name") || null,
      customer_contact: get(row, "customer_contact") || null,
      customer_address: get(row, "customer_address") || null,
      tracking_number: get(row, "tracking_number") || null,
      label_link: get(row, "label_link") || null,
      platform_status: get(row, "platform_status") || null,
      buyer_note: get(row, "buyer_note") || null,
      delivery_instructions: get(row, "delivery_instructions") || null,
      label_fee: parseFee(get(row, "label_fee")),
    }));
  }

  async function runImport() {
    setBusy(true);
    setResult(null);
    const res = await importOrders(buildRows());
    setBusy(false);
    if (!res.ok) setResult("❌ " + res.error);
    else
      setResult(
        `✅ Đã nạp ${res.processed} đơn` +
          (res.skipped ? ` (bỏ qua ${res.skipped} dòng thiếu Order ID)` : "")
      );
  }

  const previewCol = map["platform_order_id"];

  return (
    <div className="space-y-5">
      {/* Upload */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium">1. Chọn file Export từ Cotik (.csv)</label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="mt-2 block text-sm"
        />
        {fileName && (
          <p className="mt-1 text-xs text-slate-500">
            {fileName} — đọc được {rows.length} dòng, {headers.length} cột.
          </p>
        )}
      </div>

      {headers.length > 0 && (
        <>
          {/* Mapping */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">2. Map cột (đã tự đoán, chỉnh nếu sai)</span>
              <label className="flex items-center gap-2 text-sm">
                Sàn mặc định:
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as "TTS" | "AMZ")}
                  className="rounded border border-slate-300 px-2 py-1"
                >
                  <option value="TTS">TTS (TikTok)</option>
                  <option value="AMZ">AMZ (Amazon)</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TARGET_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-sm text-slate-600">
                    {f.label}
                    {f.required && <span className="text-red-500"> *</span>}
                  </span>
                  <select
                    value={map[f.key] ?? ""}
                    onChange={(e) =>
                      setMap((m) => ({ ...m, [f.key]: e.target.value }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="">— bỏ qua —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  {TARGET_FIELDS.filter((f) => map[f.key]).map((f) => (
                    <th key={f.key} className="px-3 py-2 font-medium text-slate-600">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {TARGET_FIELDS.filter((f) => map[f.key]).map((f) => (
                      <td key={f.key} className="max-w-[200px] truncate px-3 py-1.5">
                        {get(row, f.key) || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Import */}
          <div className="flex items-center gap-3">
            <button
              onClick={runImport}
              disabled={busy || !previewCol}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {busy ? "Đang nạp…" : `3. Import ${rows.length} đơn`}
            </button>
            {!previewCol && (
              <span className="text-sm text-amber-600">
                Cần map cột Order ID trước.
              </span>
            )}
            {result && <span className="text-sm">{result}</span>}
          </div>
        </>
      )}
    </div>
  );
}
