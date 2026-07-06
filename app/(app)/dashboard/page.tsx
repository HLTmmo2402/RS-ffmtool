import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { STAGE_GROUPS } from "@/lib/status";
import { StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const OPEN = ["new", "waiting_design", "design_ok", "ordered", "in_production", "has_tracking"];

type Stats = {
  total: number; today: number; week: number; overdue: number;
  stages: Record<string, number>;
  byFactory: { name: string; n: number }[];
  topSeller: { name: string; n: number }[];
  byDay: { d: string; n: number }[];
  recent: { id: string; oid: string; date: string | null; seller: string | null; customer: string | null; status: string }[];
  negBalance: { name: string; balance: number }[];
};

export default async function DashboardPage() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("dashboard_stats");

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Tổng quan</h1>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Chưa đọc được dữ liệu ({error.message}). Kiểm tra đã chạy migration 0005_perf.sql (hàm dashboard_stats) chưa.
        </div>
      </div>
    );
  }

  const s = (data ?? {}) as Stats;
  const cnt = (keys: string[]) => keys.reduce((n, k) => n + (s.stages?.[k] ?? 0), 0);
  const dist = STAGE_GROUPS.map((g) => ({ k: g.label, n: cnt([...g.statuses]), c: g.bar }));
  const totalD = dist.reduce((a, d) => a + d.n, 0) || 1;
  const byDay = s.byDay ?? [];
  const maxDay = Math.max(1, ...byDay.map((x) => x.n));

  const cards = [
    { label: "Tổng đơn", value: s.total ?? 0, cls: "text-slate-900" },
    { label: "Đơn hôm nay", value: s.today ?? 0, cls: "text-slate-900" },
    { label: "7 ngày qua", value: s.week ?? 0, cls: "text-slate-900" },
    { label: "Đang xử lý", value: cnt(OPEN), cls: "text-blue-600" },
    { label: "Quá hạn ship", value: s.overdue ?? 0, cls: "text-red-600" },
    { label: "Đã giao", value: cnt(["delivered", "synced"]), cls: "text-emerald-600" },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">Tổng quan</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className={"text-2xl font-semibold " + c.cls}>{c.value}</div>
            <div className="mt-1 text-xs text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>

      {(s.overdue ?? 0) > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <span>⏰ Có <b>{s.overdue}</b> sản phẩm quá hạn ship chưa giao.</span>
          <Link href="/today" className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700">Xem việc hôm nay →</Link>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Phân bố đơn theo tiến độ</h2>
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
          {dist.filter((d) => d.n > 0).map((d) => (
            <div key={d.k} className={d.c} style={{ width: `${(d.n / totalD) * 100}%` }} title={`${d.k}: ${d.n}`} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {dist.map((d) => (
            <div key={d.k} className="flex items-center gap-1.5 text-xs">
              <span className={"h-3 w-3 rounded-sm " + d.c} />
              <span className="text-slate-600">{d.k}</span><span className="font-semibold">{d.n}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Đơn theo ngày (14 ngày gần nhất)</h2>
          <div className="flex h-32 items-end gap-1">
            {byDay.map((x) => (
              <div key={x.d} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${x.d}: ${x.n} đơn`}>
                <span className="text-[10px] font-medium text-slate-500">{x.n || ""}</span>
                <div className="w-full rounded-t bg-blue-500" style={{ height: `${(x.n / maxDay) * 100}%`, minHeight: x.n ? "4px" : "0" }} />
                <span className="text-[9px] text-slate-400">{x.d.slice(8)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Top seller</h2>
            <Link href="/by-seller" className="text-xs text-blue-600 hover:underline">Chi tiết →</Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm"><tbody>
              {(s.topSeller ?? []).length === 0 ? (
                <tr><td className="px-3 py-5 text-center text-slate-400">Chưa có.</td></tr>
              ) : s.topSeller.map((t) => (
                <tr key={t.name} className="border-t border-slate-100 first:border-0">
                  <td className="px-3 py-1.5">{t.name}</td><td className="px-3 py-1.5 text-right font-medium">{t.n}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Đơn gần đây</h2>
            <Link href="/orders" className="text-xs text-blue-600 hover:underline">Tất cả đơn →</Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm"><tbody>
              {(s.recent ?? []).length === 0 ? (
                <tr><td className="px-3 py-6 text-center text-slate-400">Chưa có đơn. Vào Import để nạp.</td></tr>
              ) : s.recent.map((o) => {
                return (
                  <tr key={o.id} className="border-t border-slate-100 first:border-0 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">{o.date ? new Date(o.date).toLocaleDateString("vi-VN") : "—"}</td>
                    <td className="px-2 py-2"><Link href={`/orders/${o.id}`} className="font-medium text-blue-600 hover:underline">{o.oid}</Link></td>
                    <td className="px-2 py-2">{o.seller ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{o.seller}</span> : ""}</td>
                    <td className="max-w-[140px] truncate px-2 py-2 text-slate-500">{o.customer ?? "—"}</td>
                    <td className="px-3 py-2 text-right"><StatusBadge status={o.status} /></td>
                  </tr>
                );
              })}
            </tbody></table>
          </div>
        </section>

        <div className="space-y-4">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-700">Hàng chờ theo xưởng</h2>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm"><tbody>
                {(s.byFactory ?? []).length === 0 ? (
                  <tr><td className="px-3 py-5 text-center text-slate-400">Không có hàng chờ.</td></tr>
                ) : s.byFactory.map((f) => (
                  <tr key={f.name} className="border-t border-slate-100 first:border-0">
                    <td className="px-3 py-1.5">{f.name}</td><td className="px-3 py-1.5 text-right font-medium">{f.n}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          </section>
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Xưởng cần topup</h2>
              <Link href="/finance" className="text-xs text-blue-600 hover:underline">Tài chính →</Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm"><tbody>
                {(s.negBalance ?? []).length === 0 ? (
                  <tr><td className="px-3 py-5 text-center text-slate-400">Không có xưởng âm số dư.</td></tr>
                ) : s.negBalance.map((b) => (
                  <tr key={b.name} className="border-t border-slate-100 first:border-0">
                    <td className="px-3 py-1.5">{b.name}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-red-600">{Number(b.balance).toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
