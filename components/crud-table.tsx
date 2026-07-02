"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Col = {
  key: string;
  label: string;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  editable?: boolean; // mặc định true
  addable?: boolean; // mặc định true
};

type Row = { id: string; [k: string]: unknown };

const inputCls =
  "w-full rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-slate-300 focus:border-slate-500 focus:outline-none";

function toStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function coerce(col: Col, value: string): string | number | null {
  if (value === "") return null;
  if (col.type === "number") {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  return value;
}

function EditableCell({
  col,
  initial,
  onSave,
}: {
  col: Col;
  initial: string;
  onSave: (v: string) => void;
}) {
  const [val, setVal] = useState(initial);
  if (col.type === "select") {
    return (
      <select
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          onSave(e.target.value);
        }}
        className={inputCls}
      >
        <option value="">—</option>
        {col.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={col.type === "number" ? "number" : "text"}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val !== initial) onSave(val);
      }}
      className={inputCls}
    />
  );
}

export function CrudTable({
  table,
  columns,
  initial,
}: {
  table: string;
  columns: Col[];
  initial: Row[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>(initial);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function addRow() {
    const payload: Record<string, string | number | null> = {};
    for (const c of columns) {
      if (c.addable === false) continue;
      payload[c.key] = coerce(c, draft[c.key] ?? "");
    }
    setBusy(true);
    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select()
      .single();
    setBusy(false);
    if (error) return alert("Thêm lỗi: " + error.message);
    setRows((r) => [...r, data as Row]);
    setDraft({});
    router.refresh();
  }

  async function saveCell(id: string, col: Col, value: string) {
    const { error } = await supabase
      .from(table)
      .update({ [col.key]: coerce(col, value) })
      .eq("id", id);
    if (error) alert("Lưu lỗi: " + error.message);
    else router.refresh();
  }

  async function removeRow(id: string) {
    if (!confirm("Xoá dòng này?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return alert("Xoá lỗi: " + error.message);
    setRows((r) => r.filter((x) => x.id !== id));
    router.refresh();
  }

  const addCols = columns.filter((c) => c.addable !== false);

  return (
    <div className="space-y-3">
      {/* Form thêm mới */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
        {addCols.map((c) => (
          <div key={c.key} className="flex flex-col">
            <label className="text-xs text-slate-500">{c.label}</label>
            <div className="w-40">
              {c.type === "select" ? (
                <select
                  value={draft[c.key] ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [c.key]: e.target.value }))
                  }
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value="">—</option>
                  {c.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={c.type === "number" ? "number" : "text"}
                  value={draft[c.key] ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [c.key]: e.target.value }))
                  }
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              )}
            </div>
          </div>
        ))}
        <button
          onClick={addRow}
          disabled={busy}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          + Thêm
        </button>
      </div>

      {/* Bảng dữ liệu */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2 font-medium text-slate-600">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-3 py-8 text-center text-slate-400"
                >
                  Chưa có dữ liệu.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-1 align-top">
                      {c.editable === false ? (
                        <span className="px-1">{toStr(row[c.key]) || "—"}</span>
                      ) : (
                        <EditableCell
                          col={c}
                          initial={toStr(row[c.key])}
                          onSave={(v) => saveCell(row.id, c, v)}
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-1 text-right">
                    <button
                      onClick={() => removeRow(row.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
