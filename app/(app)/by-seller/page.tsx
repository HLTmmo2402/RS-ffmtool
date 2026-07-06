import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = { name: string; total: number; design: number; push: number; prod: number; done: number; issue: number };

export default async function BySellerPage() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("seller_stats");
  const list = (data as Row[] | null) ?? [];

  const H = "px-3 py-2 text-right font-medium text-slate-600";
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Thống kê theo Seller</h1>
      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {error.message}. Kiểm tra đã chạy migration 0005_perf.sql (hàm seller_stats) chưa.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-slate-600">Seller</th>
                <th className={H}>Tổng đơn</th>
                <th className={H}>Chờ design</th>
                <th className={H}>Chờ đẩy</th>
                <th className={H}>Đang SX/ship</th>
                <th className={H}>Đã giao</th>
                <th className={H}>Sự cố</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Chưa có đơn.</td></tr>
              ) : list.map((a) => (
                <tr key={a.name} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-medium">{a.name}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{a.total}</td>
                  <td className="px-3 py-1.5 text-right text-orange-600">{a.design || ""}</td>
                  <td className="px-3 py-1.5 text-right text-amber-600">{a.push || ""}</td>
                  <td className="px-3 py-1.5 text-right text-blue-600">{a.prod || ""}</td>
                  <td className="px-3 py-1.5 text-right text-emerald-600">{a.done || ""}</td>
                  <td className="px-3 py-1.5 text-right text-red-600">{a.issue || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
