"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ImportRow = {
  platform_order_id: string;
  platform: "AMZ" | "TTS";
  order_date?: string | null;
  customer_name?: string | null;
  customer_contact?: string | null;
  customer_address?: string | null;
  tracking_number?: string | null;
  label_link?: string | null;
  platform_status?: string | null;
  buyer_note?: string | null;
  delivery_instructions?: string | null;
  label_fee?: number | null;
};

export async function importOrders(rows: ImportRow[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Chưa đăng nhập." };

  const valid = rows.filter((r) => r.platform_order_id?.trim() && r.platform);
  if (valid.length === 0)
    return { ok: false as const, error: "Không có dòng hợp lệ (thiếu Order ID)." };

  // Upsert theo (platform, platform_order_id): đơn đã có sẽ được cập nhật, chưa có thì tạo mới.
  const payload = valid.map((r) => ({ ...r, updated_by: user.id }));
  const { error, count } = await supabase
    .from("orders")
    .upsert(payload, {
      onConflict: "platform,platform_order_id",
      count: "exact",
      ignoreDuplicates: false,
    });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/orders");
  return {
    ok: true as const,
    processed: count ?? valid.length,
    skipped: rows.length - valid.length,
  };
}
