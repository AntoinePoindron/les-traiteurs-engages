import { createClient } from "@/lib/supabase/server";
import MessagingLayout, { type PendingThread } from "@/components/caterer/MessagingLayout";
import type { Message } from "@/types/database";
import type { PartnerProfile } from "@/app/(dashboard)/caterer/messages/page";

interface PageProps {
  searchParams: Promise<{ thread?: string; to?: string }>;
}

export default async function AdminMessagesPage({ searchParams }: PageProps) {
  const { thread, to: toUserId } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const myUserId = user!.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sq = supabase as any;

  const { data: profileData } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .eq("id", myUserId)
    .single();

  const myProfile = profileData as {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;

  // Fetch all messages visible to admin
  const { data: messagesData } = await sq
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  const messages = (messagesData ?? []) as Message[];

  // Unique partner IDs
  const partnerIds = [
    ...new Set(
      messages.map((m: Message) =>
        m.sender_id === myUserId ? m.recipient_id : m.sender_id
      )
    ),
  ].filter(Boolean);

  // Fetch partner profiles (clients have companies, caterers have caterers)
  let partnerProfiles: PartnerProfile[] = [];
  if (partnerIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("users")
      .select("id, first_name, last_name, caterer_id, company_id, companies(name, logo_url), caterers!caterer_id(name, logo_url)")
      .in("id", partnerIds);

    partnerProfiles = (profilesData ?? []) as unknown as PartnerProfile[];
  }

  const myName = myProfile
    ? `${myProfile.first_name ?? ""} ${myProfile.last_name ?? ""}`.trim() ||
      user!.email!
    : user!.email!;

  // ── Handle ?to= param : find existing thread or build a pending one ──

  let pendingThread: PendingThread | null = null;
  let resolvedThreadId = thread ?? null;

  if (toUserId && toUserId !== myUserId) {
    // Find an existing thread between current admin and recipient
    const existing = messages.find(
      (m) =>
        (m.sender_id === myUserId && m.recipient_id === toUserId) ||
        (m.sender_id === toUserId && m.recipient_id === myUserId)
    );

    if (existing) {
      resolvedThreadId = existing.thread_id;
    } else {
      // No existing thread → build a pending one
      const { data: recipientRaw } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, caterer_id, company_id, companies(name, logo_url), caterers!caterer_id(name, logo_url)")
        .eq("id", toUserId)
        .single();

      if (recipientRaw) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = recipientRaw as any;
        const partnerName =
          `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.email;
        const companyName =
          r.caterers?.name ?? r.companies?.name ?? partnerName;
        const companyLogoUrl =
          r.caterers?.logo_url ?? r.companies?.logo_url ?? null;
        const partnerKind: "caterer" | "client" | null = r.caterer_id
          ? "caterer"
          : r.company_id
            ? "client"
            : null;
        const partnerEntityId = r.caterer_id ?? r.company_id ?? null;

        pendingThread = {
          threadId: crypto.randomUUID(),
          partnerId: r.id,
          partnerName,
          companyName,
          companyLogoUrl,
          partnerKind,
          partnerEntityId,
        };
        resolvedThreadId = pendingThread.threadId;
      }
    }
  }

  return (
    <MessagingLayout
      initialMessages={messages}
      partnerProfiles={partnerProfiles}
      myUserId={myUserId}
      myName={myName}
      initialThreadId={resolvedThreadId}
      viewerRole="admin"
      pendingThread={pendingThread}
    />
  );
}
