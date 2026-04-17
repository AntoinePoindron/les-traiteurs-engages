// One-shot : géocode les caterers + quote_requests qui n'ont pas
// encore de lat/lng. Utilise Nominatim (gratuit, 1 req/s max).
//
// Usage :
//   node --env-file=.env.local scripts/geocode-existing.mjs
//
// Requiert Node 20.6+ pour le flag --env-file. Les variables lues :
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "LesTraiteursEngages/1.0 (contact@lestraiteursenggages.fr)";
const DELAY_MS = 1100; // respect rate limit ~1 req/s

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Variables NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes.");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocode(query) {
  const fullUrl = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=fr&q=${encodeURIComponent(query)}`;
  const res = await fetch(fullUrl, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "fr" },
  });
  if (!res.ok) {
    console.warn(`  [!] nominatim ${res.status} pour "${query}"`);
    return null;
  }
  const data = await res.json();
  if (!data.length) return null;
  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

async function geocodeCaterers() {
  console.log("→ Caterers sans géoloc…");
  const { data: caterers, error } = await admin
    .from("caterers")
    .select("id, name, address, city, zip_code")
    .is("latitude", null)
    .not("address", "is", null);

  if (error) {
    console.error("  erreur fetch caterers:", error.message);
    return;
  }
  console.log(`  ${caterers.length} caterer(s) à géocoder`);

  for (const c of caterers) {
    const parts = [c.address, c.zip_code, c.city, "France"].filter(Boolean);
    const query = parts.join(", ");
    console.log(`  · ${c.name} — ${query}`);
    const coords = await geocode(query);
    if (coords) {
      const { error: updateErr } = await admin
        .from("caterers")
        .update({ latitude: coords.lat, longitude: coords.lng })
        .eq("id", c.id);
      if (updateErr) console.warn(`    [!] update failed: ${updateErr.message}`);
      else           console.log(`    ✓ ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    } else {
      console.log(`    [x] non trouvé`);
    }
    await sleep(DELAY_MS);
  }
}

async function geocodeRequests() {
  console.log("→ Quote requests sans géoloc…");
  const { data: requests, error } = await admin
    .from("quote_requests")
    .select("id, title, event_address")
    .is("event_latitude", null)
    .not("event_address", "is", null);

  if (error) {
    console.error("  erreur fetch quote_requests:", error.message);
    return;
  }
  console.log(`  ${requests.length} request(s) à géocoder`);

  for (const r of requests) {
    const query = `${r.event_address}, France`;
    console.log(`  · ${r.title} — ${query}`);
    const coords = await geocode(query);
    if (coords) {
      const { error: updateErr } = await admin
        .from("quote_requests")
        .update({ event_latitude: coords.lat, event_longitude: coords.lng })
        .eq("id", r.id);
      if (updateErr) console.warn(`    [!] update failed: ${updateErr.message}`);
      else           console.log(`    ✓ ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    } else {
      console.log(`    [x] non trouvé`);
    }
    await sleep(DELAY_MS);
  }
}

await geocodeCaterers();
await geocodeRequests();
console.log("\nTerminé.");
