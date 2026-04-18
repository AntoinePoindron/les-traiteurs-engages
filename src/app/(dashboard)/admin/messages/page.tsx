import { createClient } from "@/lib/supabase/server";
import MessagingLayout from "@/components/caterer/MessagingLayout";
import type { Message } from "@/types/database";
import type { PartnerProfile } from "@/app/(dashboard)/caterer/messages/page";

interface PageProps {
  searchParams: Promise<{ thread?: string }>;
}

export default async function AdminMessagesPage({ searchParams }: PageProps) {
  const { thread } = await searchParams;
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
      .select("id, first_name, last_name, companies(name, logo_url), caterers!caterer_id(name, logo_url)")
      .in("id", partnerIds);

    partnerProfiles = (profilesData ?? []) as unknown as PartnerProfile[];
  }

  const myName = myProfile
    ? `${myProfile.first_name ?? ""} ${myProfile.last_name ?? ""}`.trim() ||
      user!.email!
    : user!.email!;

  return (
    <MessagingLayout
      initialMessages={messages}
      partnerProfiles={partnerProfiles}
      myUserId={myUserId}
      myName={myName}
      initialThreadId={thread ?? null}
    />
  );
}
