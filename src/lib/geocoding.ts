// Géocodage via Nominatim (OpenStreetMap). Gratuit, sans clé API,
// mais rate-limité à ~1 req/s. Utilisation :
//   - à la sauvegarde de la fiche traiteur (si adresse/cp/ville changent)
//   - à la création d'une demande de devis (event_address)
//
// Nominatim exige un User-Agent identifiant explicitement l'app
// (sinon bannissement). Voir https://operations.osmfoundation.org/policies/nominatim/

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "LesTraiteursEngages/1.0 (contact@lestraiteursenggages.fr)";

export type GeoPoint = { lat: number; lng: number };

export interface GeocodeInput {
  address?: string | null;
  city?:    string | null;
  zipCode?: string | null;
}

export async function geocodeAddress(input: GeocodeInput): Promise<GeoPoint | null> {
  const parts = [input.address, input.zipCode, input.city, "France"]
    .map((p) => p?.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const query = parts.join(", ");
  const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=fr&q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":      USER_AGENT,
        "Accept-Language": "fr",
      },
    });
    if (!res.ok) {
      console.error("[geocodeAddress] nominatim responded", res.status);
      return null;
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch (err) {
    console.error("[geocodeAddress] fetch failed", err);
    return null;
  }
}

// Haversine en km. Source : https://en.wikipedia.org/wiki/Haversine_formula
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
