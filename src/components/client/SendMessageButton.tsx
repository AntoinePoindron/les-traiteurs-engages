"use client";

import { useState, useRef } from "react";
import { MessageSquare, Send, X, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface SendMessageButtonProps {
  myUserId: string;
  recipientUserId: string;
  recipientName: string;
  quoteRequestId: string;
}

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

export default function SendMessageButton({
  myUserId,
  recipientUserId,
  recipientName,
  quoteRequestId,
}: SendMessageButtonProps) {
  const [open, setOpen]       = useState(false);
  const [body, setBody]       = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const supabase = useRef(createClient());

  function handleClose() {
    setOpen(false);
    // Reset après fermeture de la modale
    setTimeout(() => { setBody(""); setSent(false); setError(null); }, 200);
  }

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);

    // Chercher un thread existant pour cette demande entre les deux utilisateurs
    // La RLS ne renvoie que les messages visibles pour l'utilisateur courant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.current as any)
      .from("messages")
      .select("thread_id")
      .eq("quote_request_id", quoteRequestId)
      .or(`sender_id.eq.${recipientUserId},recipient_id.eq.${recipientUserId}`)
      .limit(1)
      .maybeSingle();

    const threadId = existing?.thread_id ?? crypto.randomUUID();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase.current as any)
      .from("messages")
      .insert({
        thread_id:        threadId,
        sender_id:        myUserId,
        recipient_id:     recipientUserId,
        quote_request_id: quoteRequestId,
        order_id:         null,
        body:             trimmed,
        is_read:          false,
      });

    setSending(false);

    if (insertError) {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } else {
      setSent(true);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-colors border"
        style={{
          ...mFont,
          borderColor: "#1A3A52",
          color: "#1A3A52",
          backgroundColor: "transparent",
        }}
      >
        <MessageSquare size={13} />
        Envoyer un message
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full flex flex-col"
            style={{ maxWidth: 480 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#F0F4F7" }}
                >
                  <MessageSquare size={16} style={{ color: "#1A3A52" }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-black" style={mFont}>
                    Message à {recipientName}
                  </p>
                  <p className="text-xs text-[#6B7280]" style={mFont}>
                    À propos de cette demande
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors"
              >
                <X size={16} className="text-[#6B7280]" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {sent ? (
                /* ── Succès ── */
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#DCFCE7" }}
                  >
                    <CheckCircle size={22} style={{ color: "#16A34A" }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-black" style={mFont}>
                      Message envoyé !
                    </p>
                    <p className="text-xs text-[#6B7280] mt-1" style={mFont}>
                      {recipientName} recevra votre message dans sa messagerie.
                    </p>
                  </div>
                  <Link
                    href="/client/messages"
                    onClick={handleClose}
                    className="text-xs font-bold underline underline-offset-2 hover:opacity-70 transition-opacity"
                    style={{ ...mFont, color: "#1A3A52" }}
                  >
                    Voir la conversation →
                  </Link>
                </div>
              ) : (
                /* ── Formulaire ── */
                <div className="flex flex-col gap-4">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Votre message à ${recipientName}… (Entrée pour envoyer)`}
                    rows={4}
                    autoFocus
                    className="w-full rounded-lg border border-[#E5E7EB] px-4 py-3 text-sm text-black resize-none focus:outline-none focus:border-[#1A3A52] transition-colors"
                    style={mFont}
                  />
                  {error && (
                    <p className="text-xs text-[#DC2626]" style={mFont}>{error}</p>
                  )}
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2.5 rounded-full text-sm font-bold text-[#6B7280] hover:text-black transition-colors"
                      style={mFont}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={!body.trim() || sending}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
                      style={{ ...mFont, backgroundColor: "#1A3A52" }}
                    >
                      <Send size={13} />
                      {sending ? "Envoi…" : "Envoyer"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
