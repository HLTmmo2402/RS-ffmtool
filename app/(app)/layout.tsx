import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { count: todayCount }, modRes] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
    supabase.from("order_items").select("id", { count: "exact", head: true })
      .in("item_status", ["new", "waiting_design", "design_ok", "ordered"]),
    // truy vấn riêng: nếu chưa chạy 0004 (chưa có cột) chỉ mục này lỗi -> null, KHÔNG ảnh hưởng menu/role
    supabase.from("profiles").select("allowed_modules").eq("id", user.id).maybeSingle(),
  ]);

  const name = profile?.full_name ?? user.email ?? "Người dùng";
  const role = profile?.role ?? "chưa có quyền";
  const allowedModules =
    ((modRes.data as { allowed_modules: string[] | null } | null)?.allowed_modules) ?? null;

  return (
    <div className="md:flex">
      <Sidebar role={profile?.role ?? undefined} userName={name} userRole={role}
        todayCount={todayCount ?? 0} allowedModules={allowedModules} />
      <main className="min-h-screen min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}
