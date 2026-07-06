import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { OrderDetail } from "./order-detail";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const user = await getCurrentUser();

  const [orderRes, meRes, facRes, accRes, faccRes] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*), selling_accounts(name)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle(),
    supabase.from("factories").select("id, name").order("name"),
    supabase.from("selling_accounts").select("id, name, platform").order("name"),
    supabase.from("factory_accounts").select("id, factory_id, email").eq("active", true),
  ]);

  if (orderRes.error || !orderRes.data) notFound();

  return (
    <div className="space-y-4">
      <Link href="/orders" className="text-sm text-blue-600 hover:underline">← Về danh sách đơn</Link>
      <OrderDetail
        order={orderRes.data as never}
        role={(meRes.data?.role as string) ?? "seller"}
        factories={facRes.data ?? []}
        accounts={accRes.data ?? []}
        factoryAccounts={faccRes.data ?? []}
      />
    </div>
  );
}
