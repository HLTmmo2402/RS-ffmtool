import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { ChangePassword } from "./change-password";

export const dynamic = "force-dynamic";

const SCOPE_LABEL: Record<string, string> = { none: "không", own: "của mình", all: "toàn bộ" };

export default async function ProfilePage() {
  const supabase = createClient();
  const user = await getCurrentUser();
  const { data: p } = await supabase
    .from("profiles")
    .select("full_name, role, view_scope, edit_scope, delete_scope")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const rows: [string, string][] = [
    ["Email", user?.email ?? "—"],
    ["Tên", p?.full_name ?? "—"],
    ["Vai trò", p?.role ?? "—"],
    ["Quyền xem", SCOPE_LABEL[p?.view_scope ?? ""] ?? "—"],
    ["Quyền sửa", SCOPE_LABEL[p?.edit_scope ?? ""] ?? "—"],
    ["Quyền xoá", SCOPE_LABEL[p?.delete_scope ?? ""] ?? "—"],
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Hồ sơ của tôi</h1>
      <div className="max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-slate-100 last:border-0">
                <td className="w-32 bg-slate-50 px-3 py-2 text-slate-500">{k}</td>
                <td className="px-3 py-2 font-medium">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Quyền do Admin cấp. Cần đổi vai trò/phạm vi thì báo Admin (mục Người dùng).</p>
      <ChangePassword />
    </div>
  );
}
