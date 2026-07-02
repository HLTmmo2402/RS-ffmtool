import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = createClient();
  const [ordersRes, factoriesRes, templatesRes, statusRes] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("factories").select("id", { count: "exact", head: true }),
    supabase.from("templates").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("platform_status"),
  ]);

  const byStatus: Record<string, number> = {};
  for (const r of (statusRes.data ?? []) as { platform_status: string | null }[]) {
    const k = r.platform_status || "(chưa có)";
    byStatus[k] = (byStatus[k] ?? 0) + 1;
  }

  const cards = [
    { label: "Tổng đơn", value: ordersRes.count ?? 0, href: "/orders" },
    { label: "Xưởng", value: factoriesRes.count ?? 0, href: "/factories" },
    { label: "Template", value: templatesRes.count ?? 0, href: "/templates" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Tổng quan</h1>

      {ordersRes.error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Chưa đọc được dữ liệu ({ordersRes.error.message}). Kiểm tra đã chạy migration
          và cấu hình Supabase (xem README).
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {cards.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400"
              >
                <div className="text-sm text-slate-500">{c.label}</div>
                <div className="mt-1 text-3xl font-semibold">{c.value}</div>
              </Link>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 text-sm font-medium">Đơn theo trạng thái sàn</div>
            {Object.keys(byStatus).length === 0 ? (
              <p className="text-sm text-slate-400">
                Chưa có đơn — vào <Link href="/orders/import" className="text-blue-600 hover:underline">Import Cotik</Link> để nạp.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(byStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded-full bg-slate-100 px-3 py-1 text-sm"
                    >
                      {k}: <b>{v}</b>
                    </span>
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
