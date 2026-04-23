"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Landmark, Info, Loader2 } from "lucide-react";
import {
  declareBankTransferAction,
  cancelBankTransferDeclarationAction,
} from "@/app/(dashboard)/client/orders/[id]/bank-transfer-actions";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

interface Props {
  orderId: string;
  accountHolderName: string;
  bankName: string | null;
  iban: string;
  bic: string;
  amountTtc?: number | null;
  /** ISO timestamp si le client a déjà cliqué "J'ai effectué le virement". */
  declaredAt?: string | null;
}

/**
 * Carte virement bancaire :
 *  - Affiche les coordonnées (IBAN, BIC, bénéficiaire) avec copy buttons
 *  - Si le virement n'a PAS encore été déclaré : checkbox + bouton
 *    "J'ai effectué le virement"
 *  - Si déclaré : bandeau vert "Virement déclaré, en cours de traitement"
 */
export default function BankTransferCard({
  orderId,
  accountHolderName,
  bankName,
  iban,
  bic,
  amountTtc,
  declaredAt,
}: Props) {
  const formattedAmount =
    amountTtc != null && amountTtc > 0
      ? amountTtc.toLocaleString("fr-FR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : null;

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{ backgroundColor: "#F8F9FA" }}
    >
      <div className="flex items-center gap-2">
        <Landmark size={14} style={{ color: "#1A3A52" }} />
        <p className="text-xs font-bold text-black" style={mFont}>
          Payer par virement bancaire
        </p>
      </div>

      <p className="text-[11px] text-[#6B7280] leading-snug" style={mFont}>
        Transférez le montant à régler sur le compte ci-dessous. Le
        paiement sera associé automatiquement à votre facture (pas de
        référence à ajouter).
      </p>

      <div className="flex flex-col gap-2">
        <CopyRow label="Bénéficiaire" value={accountHolderName} />
        {bankName && <CopyRow label="Banque" value={bankName} />}
        <CopyRow label="IBAN" value={iban} mono />
        <CopyRow label="BIC / SWIFT" value={bic} mono />
        {formattedAmount && (
          <CopyRow label="Montant" value={`${formattedAmount} EUR`} />
        )}
      </div>

      <div
        className="flex items-start gap-1.5 text-[10px] text-[#6B7280] leading-snug pt-1"
        style={mFont}
      >
        <Info size={11} className="shrink-0 mt-0.5" />
        <p>
          Délai bancaire : 1 à 3 jours ouvrés. La commande passera en
          &ldquo;Payée&rdquo; dès réception du virement.
        </p>
      </div>

      {/* Zone de déclaration */}
      {declaredAt ? (
        <DeclaredBanner orderId={orderId} declaredAt={declaredAt} />
      ) : (
        <DeclareForm orderId={orderId} amountLabel={formattedAmount} />
      )}
    </div>
  );
}

// ── Bandeau "Virement déclaré" ─────────────────────────────────

function DeclaredBanner({
  orderId,
  declaredAt,
}: {
  orderId: string;
  declaredAt: string;
}) {
  const [isPending, startTransition] = useTransition();
  const date = new Date(declaredAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function handleCancel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(() => {
      cancelBankTransferDeclarationAction(formData);
    });
  }

  return (
    <div
      className="flex items-start gap-2 rounded-lg p-3 mt-1"
      style={{ backgroundColor: "#FEF3C7" }}
    >
      <Check size={14} style={{ color: "#B45309" }} className="shrink-0 mt-0.5" />
      {/* Colonne texte + bouton d'annulation. En mettant tout dans le
          même flex-col, le bouton "Annuler ma déclaration" hérite de
          l'indentation apportée par l'icône Check + gap-2 (22px). */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold" style={{ color: "#B45309", ...mFont }}>
          Virement déclaré
        </p>
        <p className="text-[11px] text-[#78350F]" style={mFont}>
          Vous avez indiqué avoir émis le virement le {date}. Nous
          confirmerons la réception sous 1 à 3 jours ouvrés.
        </p>

        {/* Bouton d'annulation — discret, texte underline. Au clic on
            remet bank_transfer_declared_at à NULL → retour à l'état
            "À payer" avec le formulaire de déclaration visible. */}
        <form onSubmit={handleCancel}>
          <input type="hidden" name="order_id" value={orderId} />
          <button
            type="submit"
            disabled={isPending}
            className="text-[11px] font-bold underline underline-offset-2 text-[#78350F] hover:text-[#B45309] disabled:opacity-60 disabled:cursor-wait cursor-pointer transition-colors"
            style={mFont}
          >
            {isPending ? "Annulation…" : "Annuler ma déclaration"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Formulaire de déclaration (checkbox + bouton) ──────────────

function DeclareForm({
  orderId,
  amountLabel,
}: {
  orderId: string;
  amountLabel: string | null;
}) {
  const [checked, setChecked] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!checked || isPending) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(() => {
      declareBankTransferAction(formData);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 pt-1 border-t"
      style={{ borderColor: "#E5E7EB" }}
    >
      <input type="hidden" name="order_id" value={orderId} />

      {/* Checkbox de confirmation */}
      <label
        className="flex items-start gap-2 cursor-pointer select-none pt-2"
        style={mFont}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 w-4 h-4 cursor-pointer accent-[#1A3A52] shrink-0"
        />
        <span className="text-[11px] text-[#374151] leading-snug">
          Je confirme avoir émis un virement{" "}
          {amountLabel ? (
            <>de <strong>{amountLabel} €</strong></>
          ) : (
            "du montant indiqué"
          )}{" "}
          au bénéficiaire ci-dessus.
        </span>
      </label>

      {/* Bouton de déclaration */}
      <button
        type="submit"
        disabled={!checked || isPending}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          backgroundColor: checked && !isPending ? "#1A3A52" : "#E5E7EB",
          color: checked && !isPending ? "#FFFFFF" : "#9CA3AF",
          ...mFont,
        }}
      >
        {isPending ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            Enregistrement…
          </>
        ) : (
          "J'ai effectué le virement"
        )}
      </button>
    </form>
  );
}

// ── Ligne copiable (IBAN, BIC, etc.) ──────────────────────────

function CopyRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Pas de clipboard (contexte non sécurisé ou permission refusée).
      // On ne bloque pas : l'user peut sélectionner manuellement.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[#9CA3AF]" style={mFont}>
          {label}
        </p>
        <p
          className={`text-xs text-black break-all ${mono ? "font-mono" : ""}`}
          style={mono ? { fontFamily: "ui-monospace, monospace" } : mFont}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-white cursor-pointer"
        title={copied ? "Copié !" : "Copier"}
        aria-label={`Copier ${label}`}
      >
        {copied ? (
          <Check size={13} style={{ color: "#16A34A" }} />
        ) : (
          <Copy size={13} style={{ color: "#6B7280" }} />
        )}
      </button>
    </div>
  );
}
