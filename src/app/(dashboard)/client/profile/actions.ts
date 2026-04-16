"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(formData: FormData) {
  const firstName = (formData.get("first_name") as string | null)?.trim() || null;
  const lastName  = (formData.get("last_name")  as string | null)?.trim() || null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("users")
    .update({ first_name: firstName, last_name: lastName })
    .eq("id", user.id);

  revalidatePath("/client/profile");
  revalidatePath("/client/dashboard");
}
