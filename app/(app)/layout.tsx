import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">FFM Tool</span>
            <Nav />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {profile?.full_name ?? user.email} · {profile?.role ?? "chưa có profile"}
            </span>
            <form action="/auth/signout" method="post">
              <button className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100">
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
