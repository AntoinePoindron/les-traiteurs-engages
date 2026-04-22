"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

/**
 * Bouton de submit qui affiche un spinner tant que la server action
 * rattachée à la `<form>` parente n'a pas répondu.
 *
 * Utilise `useFormStatus()` de `react-dom` — donc doit être placé à
 * l'intérieur d'une balise `<form action={serverAction}>` pour que
 * l'état `pending` soit détecté automatiquement.
 *
 * Les props de style (className, style) sont passés tels quels au
 * <button> ; le composant se contente d'ajouter le spinner et de
 * désactiver le bouton pendant l'appel.
 */
interface SubmitButtonProps {
  children: React.ReactNode;
  pendingLabel?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Taille du spinner Loader2 (px). Par défaut 13 pour coller aux boutons existants. */
  spinnerSize?: number;
}

export default function SubmitButton({
  children,
  pendingLabel,
  className,
  style,
  spinnerSize = 13,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
      style={{
        ...style,
        opacity: pending ? 0.7 : 1,
        cursor: pending ? "wait" : "pointer",
      }}
    >
      {pending ? (
        <>
          <Loader2 size={spinnerSize} className="animate-spin" />
          {pendingLabel ?? "En cours…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}
