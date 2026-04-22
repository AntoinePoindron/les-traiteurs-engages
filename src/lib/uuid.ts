/**
 * Génère un UUID v4, compatible contexte non-sécurisé.
 *
 * `crypto.randomUUID()` n'est exposé par les navigateurs qu'en contexte
 * sécurisé (HTTPS ou localhost). Quand on accède à l'app via une IP
 * locale en dev (ex. `http://192.168.1.143:3000` depuis un autre
 * appareil du LAN), l'appel plante avec "crypto.randomUUID is not a
 * function".
 *
 * Ce wrapper utilise `randomUUID` si dispo, sinon retombe sur
 * `crypto.getRandomValues` (disponible en HTTP aussi) pour générer un
 * UUID v4 conforme RFC 4122, avec un dernier filet Math.random pour
 * les environnements exotiques.
 */
export function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  // Bits de version (v4) et variant (RFC 4122)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
