"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ServiceConfig = {
  enabled: boolean;
  capacity_min?: number | null;
  capacity_max?: number | null;
  price_per_person_min?: number | null;
  global_min?: number | null;
  lead_time_days?: number | null;
};

export type ProfileUpdateData = {
  name: string;
  esat_status: boolean;
  address: string;
  city: string;
  zip_code: string;
  description: string;
  logo_url: string | null;
  delivery_radius_km: number | null;
  dietary_vegetarian: boolean;
  dietary_gluten_free: boolean;
  dietary_halal: boolean;
  dietary_bio: boolean;
  service_config: Record<string, ServiceConfig>;
  photos: string[];
};

export async function updateCatererProfile(
  data: ProfileUpdateData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("users")
    .select("caterer_id")
    .eq("id", user.id)
    .single();

  const catererId = (profile as { caterer_id: string | null } | null)
    ?.caterer_id;
  if (!catererId) return { error: "Traiteur introuvable" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("caterers")
    .update({
      name: data.name,
      esat_status: data.esat_status,
      address: data.address || null,
      city: data.city || null,
      zip_code: data.zip_code || null,
      description: data.description || null,
      logo_url: data.logo_url,
      delivery_radius_km: data.delivery_radius_km,
      dietary_vegetarian: data.dietary_vegetarian,
      dietary_gluten_free: data.dietary_gluten_free,
      dietary_halal: data.dietary_halal,
      dietary_bio: data.dietary_bio,
      service_config: data.service_config,
      photos: data.photos,
    })
    .eq("id", catererId);

  if (error) return { error: error.message };

  revalidatePath("/caterer/profile");
  return {};
}
