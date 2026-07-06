"use client";

import { useState } from "react";
import { CrudTable, type Col } from "@/components/crud-table";
import { PermMatrix } from "../permissions/matrix";

type Row = { id: string; full_name: string | null; role: string; allowed_modules: string[] | null } & Record<string, unknown>;

export function UsersTabs({ rows, columns }: { rows: Row[]; columns: Col[] }) {
  const [tab, setTab] = useState<"role" | "module">("role");
  const btn = (t: "role" | "module", label: string) => (
    <button onClick={() => setTab(t)}
      className={"rounded-md px-3 py-1.5 text-sm font-medium transition " + (tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
      {label}
    </button>
  );
  return (
    <div className="space-y-3">
      <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1">
        {btn("role", "Vai trò & phạm vi")}
        {btn("module", "Quyền theo mục")}
      </div>
      {tab === "role" ? (
        <>
          <p className="text-sm text-slate-500">
            <b>Vai trò</b> = làm cột nào (seller/ffm/admin). <b>3 phạm vi</b> Xem/Sửa/Xoá (none/own/all) cấu hình riêng từng người.
            VD seller mới để Xem=<b>own</b>; seller tin tưởng set Xem=<b>all</b> để care hộ.
          </p>
          <CrudTable table="profiles" columns={columns} initial={rows} allowAdd={false} allowDelete={false} />
        </>
      ) : (
        <PermMatrix users={rows.map((r) => ({ id: r.id, full_name: r.full_name, role: r.role, allowed_modules: r.allowed_modules }))} />
      )}
    </div>
  );
}
