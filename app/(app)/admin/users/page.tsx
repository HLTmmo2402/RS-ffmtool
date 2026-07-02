import { createClient } from "@/lib/supabase/server";
import { CrudTable, type Col } from "@/components/crud-table";

export const dynamic = "force-dynamic";

const SCOPE = [
  { value: "none", label: "none — không" },
  { value: "own", label: "own — của mình" },
  { value: "all", label: "all — toàn bộ" },
];

const columns: Col[] = [
  { key: "full_name", label: "Tên", addable: false },
  {
    key: "role", label: "Vai trò", type: "select", addable: false,
    options: [
      { value: "seller", label: "seller" },
      { value: "ffm", label: "ffm" },
      { value: "admin", label: "admin" },
    ],
  },
  { key: "view_scope", label: "Xem", type: "select", addable: false, options: SCOPE },
  { key: "edit_scope", label: "Sửa", type: "select", addable: false, options: SCOPE },
  { key: "delete_scope", label: "Xoá", type: "select", addable: false, options: SCOPE },
];

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();

  if (me?.role !== "admin") {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        Trang này chỉ dành cho Admin.
      </div>
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, view_scope, edit_scope, delete_scope")
    .order("full_name");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Người dùng & phân quyền</h1>
      <p className="text-sm text-slate-500">
        <b>Vai trò</b> = làm cột nào (seller/ffm/admin). <b>3 phạm vi độc lập</b> Xem/Sửa/Xoá
        (none/own/all) — cấu hình riêng từng người. VD seller mới để Xem=<b>own</b>; seller tin tưởng /
        trưởng nhóm set Xem=<b>all</b> để tra cứu &amp; care hộ. User tạo tự động khi đăng nhập lần đầu.
      </p>
      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{error.message}</div>
      ) : (
        <CrudTable table="profiles" columns={columns} initial={data ?? []} allowAdd={false} allowDelete={false} />
      )}
    </div>
  );
}
