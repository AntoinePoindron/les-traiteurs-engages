// Formatteurs de date/heure utilisés sur les cartes et détails
// (demandes, commandes). `formatDateTime` suit le format
// "jj/mm/aaaa à HH:mm" en fr-FR.

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-FR");
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} à ${time}`;
}
