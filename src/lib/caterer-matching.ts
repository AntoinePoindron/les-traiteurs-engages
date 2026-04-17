// Filtre les traiteurs correspondant aux critères d'une demande.
// Utilisé côté admin pour le mode "comparer 3 devis" : lors de la
// qualification, on diffuse la demande à tous les traiteurs matchants
// et les 3 premiers à répondre verront leur devis transmis au client.

import { createAdminClient } from "@/lib/supabase/admin";
import { haversineKm, type GeoPoint } from "@/lib/geocoding";

export interface MatchingRequest {
  meal_type:            string;
  guest_count:          number;
  event_latitude:       number | null;
  event_longitude:      number | null;
  dietary_vegetarian:   boolean;
  dietary_vegan?:       boolean;
  dietary_halal:        boolean;
  dietary_kosher?:      boolean;
  dietary_gluten_free:  boolean;
}

interface CatererRow {
  id:                   string;
  name:                 string;
  latitude:             number | null;
  longitude:            number | null;
  delivery_radius_km:   number | null;
  capacity_min:         number | null;
  capacity_max:         number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service_config:       any;
  dietary_vegetarian:   boolean | null;
  dietary_halal:        boolean | null;
  dietary_gluten_free:  boolean | null;
}

export interface MatchedCaterer {
  id:          string;
  name:        string;
  distance_km: number | null;
}

export async function findMatchingCaterers(
  request: MatchingRequest
): Promise<MatchedCaterer[]> {
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("caterers")
    .select(
      "id, name, latitude, longitude, delivery_radius_km, capacity_min, capacity_max, service_config, dietary_vegetarian, dietary_halal, dietary_gluten_free"
    )
    .eq("is_validated", true);

  if (error || !data) {
    console.error("[findMatchingCaterers]", error);
    return [];
  }

  const caterers = data as CatererRow[];
  const eventPoint: GeoPoint | null =
    request.event_latitude != null && request.event_longitude != null
      ? { lat: request.event_latitude, lng: request.event_longitude }
      : null;

  const matched: MatchedCaterer[] = [];

  for (const c of caterers) {
    // Prestation : service_config[meal_type].enabled = true
    const svc = c.service_config?.[request.meal_type];
    if (!svc?.enabled) continue;

    // Capacité (si bornes définies)
    if (c.capacity_min != null && request.guest_count < c.capacity_min) continue;
    if (c.capacity_max != null && request.guest_count > c.capacity_max) continue;

    // Régimes : si la demande exige un régime, le traiteur doit le couvrir
    if (request.dietary_vegetarian  && !c.dietary_vegetarian)  continue;
    if (request.dietary_halal       && !c.dietary_halal)       continue;
    if (request.dietary_gluten_free && !c.dietary_gluten_free) continue;

    // Géographie : si on a les 2 points + un rayon, on filtre. Sinon
    // on garde le traiteur (pas de filtrage géo possible).
    let distance_km: number | null = null;
    if (
      eventPoint &&
      c.latitude != null &&
      c.longitude != null &&
      c.delivery_radius_km != null
    ) {
      const d = haversineKm(eventPoint, { lat: c.latitude, lng: c.longitude });
      if (d > c.delivery_radius_km) continue;
      distance_km = d;
    }

    matched.push({ id: c.id, name: c.name, distance_km });
  }

  // Tri par proximité si dispo, sinon par nom
  matched.sort((a, b) => {
    if (a.distance_km != null && b.distance_km != null) {
      return a.distance_km - b.distance_km;
    }
    if (a.distance_km != null) return -1;
    if (b.distance_km != null) return 1;
    return a.name.localeCompare(b.name);
  });

  return matched;
}
