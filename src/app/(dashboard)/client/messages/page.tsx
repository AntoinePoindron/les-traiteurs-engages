import { createClient } from "@/lib/supabase/server";
import MessagingLayout from "@/components/client/MessagingLayout";
import type { Message } from "@/types/database";

export type PartnerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  companies: { name: string } | null;
  caterers: { name: string } | null;
};

export type PendingThread = {
  threadId: string;
  partnerId: string;
  partnerName: string;
  companyName: string;
  quoteRequestId: string | null;
  orderId: string | null;
};

interface PageProps {
  searchParams: Promise<{ thread?: string; to?: string; qr?: string; order?: string }>;
}

export default async function ClientMessagesPage({ searchParams }: PageProps) {
  const { thread, to: toUserId, qr: qrId, order: pendingOrderId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .eq("id", user!.id)
    .single();

  const myUserId = user!.id;
  const myProfile = profileData as {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;

  // Fetch all messages for this user
  const { data: messagesData } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  const messages = (messagesData ?? []) as Message[];

  // Find unique partner IDs
  const partnerIds = [
    ...new Set(
      messages.map((m) =>
        m.sender_id === myUserId ? m.recipient_id : m.sender_id
      )
    ),
  ].filter(Boolean);

  // Fetch partner profiles + company names
  let partnerProfiles: PartnerProfile[] = [];
  if (partnerIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("users")
      .select("id, first_name, last_name, companies(name), caterers!caterer_id(name)")
      .in("id", partnerIds);

    partnerProfiles = (profilesData ?? []) as unknown as PartnerProfile[];
  }

  const myName = myProfile
    ? `${myProfile.first_name ?? ""} ${myProfile.last_name ?? ""}`.trim() ||
      user!.email!
    : user!.email!;

  // Nouveau thread sans messages existants
  let pendingThread: PendingThread | null = null;
  if (thread && toUserId && !messages.some((m) => m.thread_id === thread)) {
    const { data: partnerData } = await supabase
      .from("users")
      .select("id, first_name, last_name, caterers!caterer_id(name)")
      .eq("id", toUserId)
      .single();

    if (partnerData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pd = partnerData as any;
      pendingThread = {
        threadId: thread,
        partnerId: toUserId,
        partnerName:
          `${pd.first_name ?? ""} ${pd.last_name ?? ""}`.trim() || "Traiteur",
        companyName: pd.caterers?.name ?? "Traiteur",
        quoteRequestId: qrId ?? null,
        orderId: pendingOrderId ?? null,
      };
    }
  }

  return (
    <MessagingLayout
      initialMessages={messages}
      partnerProfiles={partnerProfiles}
      myUserId={myUserId}
      myName={myName}
      initialThreadId={thread ?? null}
      pendingThread={pendingThread}
    />
  );
}
