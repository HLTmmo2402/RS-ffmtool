import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PermMatrix } from "./matrix";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const user = await getCurrentUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (me?.role !== "admin") {
    return <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Trang này chỉ dành cho Admin.</div>;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, allowed_modules")
    .order("role")
    .order("full_name");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Phân quyền theo mục</h1>
      <p className="text-sm text-slate-500">
        Chọn từng người được vào những <b>mục</b> nào trên thanh menu. Đây là lớp riêng, tách khỏi
        Vai trò &amp; phạm vi Xem/Sửa (mục <b>Người dùng</b>).
      </p>
      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {error.message}. Đã chạy migration 0004_module_access.sql chưa?
        </div>
      ) : (
        <PermMatrix users={data ?? []} />
      )}
    </div>
  );
}
