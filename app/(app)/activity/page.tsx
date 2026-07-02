import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  at: string; action: string; entity: string; entity_id: string | null;
  changes: Record<string, unknown> | null;
  actor: { full_name: string } | { full_name: string }[] | null;
};

const ACTION_CLS: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};

function summarize(action: string, changes: Record<string, unknown> | null): string {
  if (!changes) return "";
  const keys = Object.keys(changes);
  if (action === "UPDATE") return "sửa: " + keys.slice(0, 8).join(", ") + (keys.length > 8 ? "…" : "");
  return keys.slice(0, 6).join(", ") + (keys.length > 6 ? "…" : "");
}

export default async function ActivityPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("at, action, entity, entity_id, changes, actor:profiles!actor(full_name)")
    .order("at", { ascending: false })
    .limit(200);

  const rows = (data as Row[] | null) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Nhật ký hoạt động</h1>
      <p className="text-sm text-slate-500">Ai INSERT/UPDATE/DELETE gì, khi nào (200 dòng gần nhất). Chỉ người có quyền xem-toàn-bộ mới thấy.</p>
      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{error.message}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left"><tr>
              {["Thời gian", "Người", "Hành động", "Bảng", "Thay đổi"].map((h) =>
                <th key={h} className="px-3 py-2 font-medium text-slate-600">{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Chưa có nhật ký (hoặc bạn không có quyền xem-toàn-bộ).</td></tr>
              ) : rows.map((r, i) => {
                const actor = Array.isArray(r.actor) ? r.actor[0]?.full_name : r.actor?.full_name;
                return (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{new Date(r.at).toLocaleString("vi-VN")}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">{actor ?? "—"}</td>
                    <td className="px-3 py-1.5"><span className={"rounded px-2 py-0.5 text-xs " + (ACTION_CLS[r.action] ?? "bg-slate-100")}>{r.action}</span></td>
                    <td className="px-3 py-1.5">{r.entity}</td>
                    <td className="max-w-[380px] truncate px-3 py-1.5 text-slate-500">{summarize(r.action, r.changes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
