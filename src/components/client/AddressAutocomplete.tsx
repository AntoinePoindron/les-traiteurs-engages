"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

/**
 * Suggestion retournée par l'API Base Adresse Nationale.
 * Doc : https://adresse.data.gouv.fr/api-doc/adresse
 */
interface BanSuggestion {
  /** Label complet (ex. "8 Boulevard du Port 80000 Amiens") */
  label: string;
  /** Nom du lieu (rue + numéro) */
  name: string;
  postcode: string;
  city: string;
  context: string;
}

interface Props {
  address: string;
  zipCode: string;
  city: string;
  onChange: (next: { address: string; zipCode: string; city: string }) => void;
  /** Classes à appliquer aux <input>. Doit matcher le style du Wizard. */
  inputClassName?: string;
  addressLabel?: string;
  required?: boolean;
}

/**
 * Champ d'adresse avec autocomplete basé sur la Base Adresse Nationale
 * (https://api-adresse.data.gouv.fr). Gratuit, sans clé API, pensé
 * pour ce cas d'usage.
 *
 * Comportement :
 *  - Tape "8 bou..." → dropdown avec suggestions
 *  - Debounce 300ms pour ne pas spammer l'API
 *  - Clic sur une suggestion → remplit adresse + code postal + ville
 *  - Edit manuel des 3 champs possible (l'autocomplete est une aide, pas une contrainte)
 */
export default function AddressAutocomplete({
  address,
  zipCode,
  city,
  onChange,
  inputClassName = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#1A3A52] transition-colors",
  addressLabel = "Adresse",
  required = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<BanSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Flag pour suppress la prochaine requête autocomplete quand la
  // mise à jour vient d'un clic sur une suggestion (et pas d'un typage
  // user). Sans ça, le clic sur une suggestion re-triggerait l'API
  // avec le label complet.
  const skipNextFetchRef = useRef(false);

  // Fetch debouncé à chaque change de `address`
  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    const q = address.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      // Cancel la requête précédente si toujours en vol
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      try {
        const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=6&autocomplete=1`;
        const res = await fetch(url, { signal: abortRef.current.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          features?: Array<{ properties: any }>;
        };
        const mapped = (data.features ?? [])
          .map((f) => f.properties)
          .filter((p) => p && p.label && p.postcode && p.city)
          .map(
            (p): BanSuggestion => ({
              label: p.label,
              name: p.name ?? p.label,
              postcode: p.postcode,
              city: p.city,
              context: p.context ?? "",
            }),
          );
        setSuggestions(mapped);
        setOpen(mapped.length > 0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[AddressAutocomplete] fetch failed:", err);
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [address]);

  // Ferme le dropdown au clic extérieur
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function handleSelect(s: BanSuggestion) {
    skipNextFetchRef.current = true;
    setOpen(false);
    setSuggestions([]);
    // Coerce tous les champs en string — l'API BAN peut renvoyer undefined
    // sur certains types d'entrées (locality, municipality…) et ça
    // basculerait l'input de "controlled" à "uncontrolled".
    onChange({
      address: s.name    ?? "",
      zipCode: s.postcode ?? "",
      city:    s.city    ?? "",
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Adresse (autocomplete) */}
      <div ref={wrapperRef} className="relative">
        <label
          className="block text-xs font-bold text-[#1A3A52] mb-1"
          style={mFont}
        >
          {addressLabel}
          {required && <span className="text-[#DC2626]"> *</span>}
        </label>
        <div className="relative">
          <input
            type="text"
            // Fallback "" pour garantir que l'input reste "controlled" même
            // si le parent ou l'API renvoie undefined transitoirement.
            value={address ?? ""}
            onChange={(e) => {
              onChange({ address: e.target.value, zipCode: zipCode ?? "", city: city ?? "" });
            }}
            onFocus={() => {
              if (suggestions.length > 0) setOpen(true);
            }}
            placeholder="Commencez à taper l'adresse…"
            autoComplete="off"
            className={inputClassName}
            style={mFont}
          />
          {loading && (
            <Loader2
              size={14}
              className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
          )}
        </div>

        {/* Dropdown suggestions */}
        {open && suggestions.length > 0 && (
          <div
            className="absolute left-0 right-0 mt-1 bg-white rounded-xl border border-[#E5E7EB] shadow-lg overflow-hidden z-20"
            style={{ maxHeight: 280, overflowY: "auto" }}
          >
            {suggestions.map((s, i) => (
              <button
                key={`${s.label}-${i}`}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full flex items-start gap-2 px-4 py-2.5 text-left hover:bg-[#F5F1E8] cursor-pointer transition-colors border-b border-[#F3F4F6] last:border-0"
                style={mFont}
              >
                <MapPin
                  size={13}
                  className="shrink-0 mt-0.5 text-[#1A3A52]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-black truncate">{s.label}</p>
                  {s.context && (
                    <p className="text-[11px] text-[#9CA3AF] truncate">
                      {s.context}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Code postal + Ville en 2 colonnes */}
      <div className="flex gap-3">
        <div className="w-32 shrink-0">
          <label
            className="block text-xs font-bold text-[#1A3A52] mb-1"
            style={mFont}
          >
            Code postal
            {required && <span className="text-[#DC2626]"> *</span>}
          </label>
          <input
            type="text"
            value={zipCode ?? ""}
            onChange={(e) =>
              onChange({ address: address ?? "", zipCode: e.target.value, city: city ?? "" })
            }
            placeholder="75011"
            inputMode="numeric"
            autoComplete="postal-code"
            className={inputClassName}
            style={mFont}
          />
        </div>
        <div className="flex-1 min-w-0">
          <label
            className="block text-xs font-bold text-[#1A3A52] mb-1"
            style={mFont}
          >
            Ville
            {required && <span className="text-[#DC2626]"> *</span>}
          </label>
          <input
            type="text"
            value={city ?? ""}
            onChange={(e) =>
              onChange({ address: address ?? "", zipCode: zipCode ?? "", city: e.target.value })
            }
            placeholder="Paris"
            autoComplete="address-level2"
            className={inputClassName}
            style={mFont}
          />
        </div>
      </div>
    </div>
  );
}
