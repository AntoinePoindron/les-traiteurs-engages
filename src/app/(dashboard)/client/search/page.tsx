import { createClient } from "@/lib/supabase/server";
import CatererSearch from "@/components/client/CatererSearch";
import type { Caterer } from "@/types/database";

export default async function ClientSearchPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("caterers")
    .select("id, name, city, zip_code, description, photos, logo_url, esat_status, structure_type, delivery_radius_km, service_config, dietary_vegetarian, dietary_gluten_free, dietary_halal, dietary_bio")
    .eq("is_validated", true)
    .order("name");

  const caterers = (data ?? []) as Caterer[];

  return <CatererSearch initialCaterers={caterers} />;
}
