import { supabase } from './supabase';

export interface ChatMessageRecord {
  id: string;
  patient_email: string;
  patient_name: string;
  sender_type: 'patient' | 'bot' | 'admin';
  message: string;
  created_at: string;
  read: boolean;
}

export interface ChatConversationSummary {
  patientEmail: string;
  patientName: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
}

type ChatConversationRow = Pick<
  ChatMessageRecord,
  'patient_email' | 'patient_name' | 'message' | 'created_at' | 'sender_type' | 'read'
>;

export function normalizePatientEmail(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

export function parseChatTimestamp(timestamp: string) {
  const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  return new Date(hasExplicitTimezone ? normalized : `${normalized}Z`);
}

async function requireSupabaseSession(action: string) {
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    throw new Error(
      `No Supabase session found. Sign in with a Supabase Auth admin account to ${action}.`
    );
  }

  return data.session;
}

export function summarizeChatConversations(rows: ChatConversationRow[]): ChatConversationSummary[] {
  const map = new Map<string, ChatConversationSummary>();

  for (const row of rows) {
    const normalizedEmail = normalizePatientEmail(row.patient_email);
    if (!normalizedEmail) continue;

    if (!map.has(normalizedEmail)) {
      map.set(normalizedEmail, {
        patientEmail: normalizedEmail,
        patientName: (row.patient_name || row.patient_email || normalizedEmail).trim(),
        unreadCount: 0,
        lastMessage: row.message,
        lastMessageTime: row.created_at,
      });
    }

    const conversation = map.get(normalizedEmail)!;
    if (row.sender_type === 'patient' && !row.read) {
      conversation.unreadCount += 1;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => parseChatTimestamp(b.lastMessageTime).getTime() - parseChatTimestamp(a.lastMessageTime).getTime()
  );
}

export async function fetchChatConversations(): Promise<ChatConversationSummary[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('patient_email, patient_name, message, created_at, sender_type, read')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return summarizeChatConversations(data as ChatConversationRow[]);
}

export async function fetchConversationMessages(patientEmail: string): Promise<ChatMessageRecord[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const normalizedEmail = normalizePatientEmail(patientEmail);
  return ((data || []) as ChatMessageRecord[]).filter(
    (row) => normalizePatientEmail(row.patient_email) === normalizedEmail
  );
}

export async function markMessagesRead(messageIds: string[]) {
  if (messageIds.length === 0) return;

  await requireSupabaseSession('mark chat messages as read');

  const { error } = await supabase
    .from('chat_messages')
    .update({ read: true })
    .in('id', messageIds);

  if (error) {
    throw error;
  }
}

export async function deleteConversationByPatientEmail(patientEmail: string) {
  await requireSupabaseSession('delete conversations');

  const normalizedEmail = normalizePatientEmail(patientEmail);
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, patient_email');

  if (error) {
    throw error;
  }

  const idsToDelete = (data || [])
    .filter((row) => normalizePatientEmail(row.patient_email) === normalizedEmail)
    .map((row) => row.id);

  if (idsToDelete.length === 0) {
    return 0;
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from('chat_messages')
    .delete()
    .in('id', idsToDelete)
    .select('id');

  if (deleteError) {
    throw deleteError;
  }

  const deletedCount = (deletedRows || []).length;

  if (idsToDelete.length > 0 && deletedCount === 0) {
    throw new Error(
      'Supabase blocked the delete. Check the chat_messages DELETE policy and make sure you are signed in with a real Supabase-authenticated admin account.'
    );
  }

  return deletedCount;
}
