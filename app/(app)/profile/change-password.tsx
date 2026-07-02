"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ChangePassword() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setOk(false);
    if (pw.length < 6) { setMsg("Mật khẩu tối thiểu 6 ký tự."); return; }
    if (pw !== pw2) { setMsg("Hai ô mật khẩu chưa khớp."); return; }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg("Lỗi: " + error.message); }
    else { setOk(true); setMsg("Đã đổi mật khẩu."); setPw(""); setPw2(""); }
  }

  const box = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";
  return (
    <form onSubmit={submit} className="max-w-sm space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-700">Đổi mật khẩu</div>
      <div className="space-y-1">
        <label className="text-xs text-slate-500">Mật khẩu mới</label>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={box} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-slate-500">Nhập lại mật khẩu mới</label>
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={box} />
      </div>
      {msg && <p className={"text-sm " + (ok ? "text-emerald-600" : "text-red-600")}>{msg}</p>}
      <button type="submit" disabled={busy}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
        {busy ? "Đang lưu…" : "Đổi mật khẩu"}
      </button>
    </form>
  );
}
