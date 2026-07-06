import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { type Col } from "@/components/crud-table";
import { PageHeader } from "@/components/ui";
import { UsersTabs } from "./tabs";

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
  const user = await getCurrentUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();

  if (me?.role !== "admin") {
    return <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Trang này chỉ dành cho Admin.</div>;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, view_scope, edit_scope, delete_scope, allowed_modules")
    .order("role").order("full_name");

  return (
    <div className="space-y-4">
      <PageHeader title="Người dùng & Phân quyền" sub="Vai trò + phạm vi Xem/Sửa/Xoá, và quyền hiển thị theo mục — cấu hình riêng từng người." />
      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{error.message}</div>
      ) : (
        <UsersTabs rows={data ?? []} columns={columns} />
      )}
    </div>
  );
}
