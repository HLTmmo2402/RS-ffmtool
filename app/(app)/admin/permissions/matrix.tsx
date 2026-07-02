"use client";

import { useState } from "react";
import { MODULES } from "@/lib/modules";
import { updateAllowedModules } from "./actions";

type U = { id: string; full_name: string | null; role: string; allowed_modules: string[] | null };

export function PermMatrix({ users }: { users: U[] }) {
  const [state, setState] = useState<Record<string, string[] | null>>(
    () => Object.fromEntries(users.map((u) => [u.id, u.allowed_modules]))
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function save(id: string, mods: string[] | null) {
    setState((s) => ({ ...s, [id]: mods }));
    setSaving(id);
    const r = await updateAllowedModules(id, mods);
    setSaving(null);
    if (!r.ok) alert("Lưu lỗi: " + r.error);
  }

  function toggle(u: U, key: string) {
    const cur = state[u.id];
    const set = new Set(cur ?? MODULES.map((m) => m.key)); // null = đang thấy tất cả
    if (set.has(key)) set.delete(key); else set.add(key);
    save(u.id, [...set]);
  }

  const nonAdmin = users.filter((u) => u.role !== "admin");
  const admins = users.filter((u) => u.role === "admin");

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="sticky left-0 bg-slate-100 px-3 py-2 font-medium text-slate-600">Người dùng</th>
              {MODULES.map((m) => (
                <th key={m.key} className="px-2 py-2 text-center font-medium text-slate-600" title={m.label}>
                  <span className="block text-base">{m.icon}</span>
                  <span className="text-[10px] leading-none">{m.label}</span>
                </th>
              ))}
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {nonAdmin.length === 0 ? (
              <tr><td colSpan={MODULES.length + 2} className="px-3 py-6 text-center text-slate-400">Chưa có seller/FFM nào.</td></tr>
            ) : nonAdmin.map((u) => {
              const cur = state[u.id];
              const custom = cur !== null && cur !== undefined;
              return (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="sticky left-0 bg-white px-3 py-1.5">
                    <div className="font-medium">{u.full_name ?? "—"}</div>
                    <div className="text-[11px] text-slate-400">{u.role}{custom ? "" : " · theo vai trò"}</div>
                  </td>
                  {MODULES.map((m) => {
                    const disabled = m.ffmOnly && u.role !== "ffm";
                    const checked = disabled ? false : (cur ? cur.includes(m.key) : true);
                    return (
                      <td key={m.key} className="px-2 py-1.5 text-center">
                        <input type="checkbox" checked={checked} disabled={disabled || saving === u.id}
                          onChange={() => toggle(u, m.key)} title={disabled ? "Chỉ FFM" : m.label} />
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right">
                    {custom && (
                      <button onClick={() => save(u.id, null)} className="text-xs text-blue-600 hover:underline">
                        Đặt lại
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {admins.length > 0 && (
        <p className="text-xs text-slate-400">
          Admin (toàn quyền, không giới hạn): {admins.map((a) => a.full_name ?? "—").join(", ")}.
        </p>
      )}
      <p className="text-xs text-slate-400">
        Bỏ tích = ẩn mục đó với người này (Tổng quan &amp; Hồ sơ luôn hiển thị). &quot;Theo vai trò&quot; = thấy mọi mục vai trò cho phép.
        Tài chính chỉ áp dụng cho FFM.
      </p>
    </div>
  );
}
