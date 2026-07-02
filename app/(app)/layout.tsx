import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { count: todayCount }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
    supabase.from("order_items").select("id", { count: "exact", head: true })
      .in("item_status", ["new", "waiting_design", "design_ok", "ordered"]),
  ]);

  const name = profile?.full_name ?? user.email ?? "Người dùng";
  const role = profile?.role ?? "chưa có quyền";

  return (
    <div className="md:flex">
      <Sidebar role={profile?.role ?? undefined} userName={name} userRole={role} todayCount={todayCount ?? 0} />
      <main className="min-h-screen min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}
