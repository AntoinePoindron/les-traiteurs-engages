import Link from "next/link";
import { Building2, ChefHat, ExternalLink } from "lucide-react";
import SendMessageButton from "@/components/messaging/SendMessageButton";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

export type ContactEntityType = "client" | "caterer";

interface ContactCardProps {
  entityType:       ContactEntityType;
  entityName:       string | null;
  entityLogoUrl:    string | null;
  contactUserId:    string | null;
  contactFirstName: string | null;
  contactLastName:  string | null;
  contactEmail:     string | null;
  publicProfileHref?: string;
  myUserId:         string;
  quoteRequestId?:  string;
  orderId?:         string;
  messagesHref:     string;
}

function initials(firstName: string | null, lastName: string | null, email: string | null): string {
  const f = firstName?.trim()[0] ?? "";
  const l = lastName?.trim()[0] ?? "";
  if (f || l) return (f + l).toUpperCase();
  return (email?.trim()[0] ?? "?").toUpperCase();
}

const LABELS: Record<ContactEntityType, { label: string; contactLabel: string }> = {
  client:  { label: "CLIENT",   contactLabel: "Responsable" },
  caterer: { label: "TRAITEUR", contactLabel: "Contact" },
};

export default function ContactCard({
  entityType,
  entityName,
  entityLogoUrl,
  contactUserId,
  contactFirstName,
  contactLastName,
  contactEmail,
  publicProfileHref,
  myUserId,
  quoteRequestId,
  orderId,
  messagesHref,
}: ContactCardProps) {
  const { label, contactLabel } = LABELS[entityType];
  const contactFullName = [contactFirstName, contactLastName].filter(Boolean).join(" ").trim();
  const displayContactName = contactFullName || contactEmail || "";
  const FallbackIcon = entityType === "caterer" ? ChefHat : Building2;

  return (
    <div className="bg-white rounded-lg p-5 flex flex-col gap-4">
      {/* Logo + nom de la structure */}
      <div className="flex items-center gap-3">
        {entityLogoUrl ? (
          <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-[#F5F1E8]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entityLogoUrl} alt="" className="w-full h-full object-contain p-1" />
          </div>
        ) : (
          <div
            className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#F5F1E8" }}
          >
            <FallbackIcon size={22} style={{ color: "#C4714A" }} />
          </div>
        )}
        <div className="flex flex-col gap-0.5 min-w-0">
          <p
            className="text-[10px] font-bold uppercase"
            style={{ color: "#9CA3AF", letterSpacing: "0.06em", ...mFont }}
          >
            {label}
          </p>
          <p
            className="font-display font-bold text-lg text-black truncate"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            {entityName ?? "—"}
          </p>
        </div>
      </div>

      {/* Responsable / Contact */}
      {displayContactName && (
        <div className="flex items-center gap-2.5 pt-3 border-t border-[#F3F4F6]">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
            style={{ backgroundColor: "#1A3A52", ...mFont }}
          >
            {initials(contactFirstName, contactLastName, contactEmail)}
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-bold text-black truncate" style={mFont}>
              {displayContactName}
            </p>
            <p className="text-[11px] text-[#6B7280]" style={mFont}>
              {contactLabel}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {publicProfileHref && (
          <Link
            href={publicProfileHref}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#1A3A52", ...mFont }}
          >
            <ExternalLink size={13} />
            Voir la fiche
          </Link>
        )}

        {contactUserId && (
          <SendMessageButton
            myUserId={myUserId}
            recipientUserId={contactUserId}
            recipientName={displayContactName || entityName || ""}
            quoteRequestId={quoteRequestId}
            orderId={orderId}
            messagesHref={messagesHref}
          />
        )}
      </div>
    </div>
  );
}
