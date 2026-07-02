"use server";

import { createClient } from "@/lib/supabase/server";

export async function updateAllowedModules(userId: string, modules: string[] | null) {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ allowed_modules: modules }).eq("id", userId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
