import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Search,
  ArrowUpRight,
  Bot,
  CheckCheck,
  RefreshCw,
  Trash2,
  ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import {
  ChatConversationSummary,
  ChatMessageRecord,
  deleteConversationByPatientEmail,
  fetchChatConversations,
  fetchConversationMessages,
  markMessagesRead,
  normalizePatientEmail,
  parseChatTimestamp,
} from '../lib/chat';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/ui/ConfirmModal';

interface ConversationSummary extends ChatConversationSummary {
  escalated: boolean;
}

const PH_TIMEZONE = 'Asia/Manila';

function getParticipantInitials(name?: string, email?: string) {
  const source = (name || email || 'Patient').trim();
  const words = source.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function formatTimeLabel(timestamp: string) {
  return parseChatTimestamp(timestamp).toLocaleTimeString('en-PH', {
    timeZone: PH_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPHDayKey(value: Date | string) {
  const date = value instanceof Date ? value : parseChatTimestamp(value);
  return date.toLocaleDateString('en-CA', {
    timeZone: PH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatConversationTimestamp(timestamp: string) {
  const date = parseChatTimestamp(timestamp);
  const now = new Date();

  if (getPHDayKey(date) === getPHDayKey(now)) {
    return formatTimeLabel(timestamp);
  }

  return date.toLocaleDateString('en-PH', {
    timeZone: PH_TIMEZONE,
    month: 'short',
    day: 'numeric',
  });
}

function formatConversationStart(timestamp: string) {
  return parseChatTimestamp(timestamp).toLocaleDateString('en-PH', {
    timeZone: PH_TIMEZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function cleanPreviewText(message: string) {
  return message.replace(/\s+/g, ' ').trim();
}

function MessageBubble({ msg, adminName }: { msg: ChatMessageRecord; adminName: string }) {
  const isAdmin = msg.sender_type === 'admin';
  const isBot = msg.sender_type === 'bot';
  const time = formatTimeLabel(msg.created_at);

  if (isAdmin) {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mb-4 flex justify-end">
        <div className="max-w-[88%] sm:max-w-[76%]">
          <div
            className="rounded-[24px] rounded-br-md px-4 py-3.5 text-white"
            style={{ background: 'linear-gradient(135deg, #0A2463, #1B4FD8 58%, #3A86FF)' }}
          >
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.89rem', lineHeight: 1.6 }}>{msg.message}</p>
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-1.5 px-1">
            <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.72rem' }}>{adminName} - {time}</span>
            <CheckCheck className="w-3 h-3" style={{ color: msg.read ? '#059669' : '#6B7A99' }} />
          </div>
        </div>
      </motion.div>
    );
  }

  if (isBot) {
    return (
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-4 flex gap-3">
        <div
          className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #0F766E, #14B8A6)' }}
        >
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="max-w-[88%] sm:max-w-[76%]">
          <div className="mb-1 flex items-center gap-2">
            <span style={{ fontFamily: 'var(--font-body)', color: '#0F766E', fontSize: '0.72rem', fontWeight: 700 }}>Automated reply</span>
            <span style={{ fontFamily: 'var(--font-body)', color: '#94A3B8', fontSize: '0.72rem' }}>{time}</span>
          </div>
          <div className="rounded-[24px] rounded-bl-md px-4 py-3.5" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
            <p style={{ fontFamily: 'var(--font-body)', color: '#115E59', fontSize: '0.89rem', lineHeight: 1.6 }}>{msg.message}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  const initials = getParticipantInitials(msg.patient_name, msg.patient_email);

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-4 flex gap-3">
      <div
        className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl text-white"
        style={{ background: 'linear-gradient(135deg, #F97316, #F59E0B)', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}
      >
        {initials}
      </div>
      <div className="max-w-[88%] sm:max-w-[76%]">
        <div className="mb-1 flex items-center gap-2">
          <span style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.74rem', fontWeight: 700 }}>
            {msg.patient_name || msg.patient_email}
          </span>
          <span style={{ fontFamily: 'var(--font-body)', color: '#94A3B8', fontSize: '0.72rem' }}>{time}</span>
        </div>
        <div
          className="rounded-[24px] rounded-bl-md px-4 py-3.5"
          style={{ background: '#FFFFFF', border: '1px solid #DCE8FF', boxShadow: '0 10px 30px rgba(10, 36, 99, 0.05)' }}
        >
          <p style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.89rem', lineHeight: 1.6 }}>{msg.message}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function ChatPage() {
  const { user } = useAuth();
  const adminName = user?.name ?? 'Admin';

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const [hasSupabaseSession, setHasSupabaseSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<ConversationSummary | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    let mounted = true;

    const syncSessionState = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setHasSupabaseSession(!!data.session);
      }
    };

    syncSessionState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setHasSupabaseSession(!!session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const syncConversationList = useCallback(async () => {
    setLoadingConvs(true);
    const summaries = await fetchChatConversations();
    setConversations(summaries.map((conversation) => ({ ...conversation, escalated: false })));
    setLoadingConvs(false);
  }, []);

  const loadMessages = useCallback(async (patientEmail: string) => {
    setLoadingMsgs(true);

    try {
      const conversationMessages = await fetchConversationMessages(patientEmail);
      setMessages(conversationMessages);

      const unreadPatientMessageIds = conversationMessages
        .filter((row) => row.sender_type === 'patient' && !row.read)
        .map((row) => row.id);

      if (hasSupabaseSession) {
        await markMessagesRead(unreadPatientMessageIds);
      }

      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.patientEmail === patientEmail ? { ...conversation, unreadCount: 0 } : conversation
        )
      );
    } catch (error: any) {
      console.error('loadMessages error:', error?.message || error);
      toast.error('Failed to load messages.');
    } finally {
      setLoadingMsgs(false);
    }
  }, [hasSupabaseSession]);

  const refreshSelectedConversation = useCallback(async () => {
    const currentSelected = selectedRef.current;
    if (!currentSelected) return;
    await loadMessages(currentSelected.patientEmail);
  }, [loadMessages]);

  useEffect(() => {
    syncConversationList();
  }, [syncConversationList]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!selected) return;

    const updatedConversation = conversations.find(
      (conversation) => conversation.patientEmail === selected.patientEmail
    );

    if (!updatedConversation) {
      setSelected(null);
      setMessages([]);
      return;
    }

    if (
      updatedConversation.patientName !== selected.patientName ||
      updatedConversation.lastMessage !== selected.lastMessage ||
      updatedConversation.lastMessageTime !== selected.lastMessageTime ||
      updatedConversation.unreadCount !== selected.unreadCount ||
      updatedConversation.escalated !== selected.escalated
    ) {
      setSelected(updatedConversation);
    }
  }, [conversations, selected]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-chat-realtime-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, async (payload) => {
        const changedRow = (payload.new || payload.old) as Partial<ChatMessageRecord> | null;
        const currentSelected = selectedRef.current;

        await syncConversationList();

        if (!currentSelected) return;

        const changedEmail = normalizePatientEmail(changedRow?.patient_email);
        if (!changedEmail || changedEmail === currentSelected.patientEmail) {
          await refreshSelectedConversation();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshSelectedConversation, syncConversationList]);

  const handleSelectConversation = useCallback((conversation: ConversationSummary) => {
    setSelected(conversation);
    loadMessages(conversation.patientEmail);
  }, [loadMessages]);

  const handleSend = async () => {
    if (!message.trim() || !selected || sending) return;
    if (!hasSupabaseSession) {
      toast.error('Chat sending is blocked because there is no active Supabase session. Sign in with a real Supabase admin account.');
      return;
    }

    setSending(true);
    const text = message.trim();
    setMessage('');

    const { error } = await supabase.from('chat_messages').insert({
      patient_email: normalizePatientEmail(selected.patientEmail),
      patient_name: selected.patientName,
      sender_type: 'admin',
      message: text,
      read: true,
    });

    if (error) {
      toast.error('Failed to send message. ' + error.message);
      setMessage(text);
    }

    setSending(false);
  };

  const handleDeleteChat = async () => {
    if (!selected) return;
    if (!hasSupabaseSession) {
      toast.error('Delete is blocked because there is no active Supabase session. Sign in with a real Supabase admin account.');
      return;
    }

    setDeletingChat(true);

    try {
      const deletedCount = await deleteConversationByPatientEmail(selected.patientEmail);
      if (deletedCount === 0) {
        throw new Error('No chat rows were deleted. Supabase is still blocking this operation.');
      }
      await syncConversationList();
      setSelected(null);
      setMessages([]);
      toast.success('Conversation deleted successfully.');
    } catch (error: any) {
      toast.error('Failed to delete conversation: ' + (error?.message || 'Unknown error'));
    } finally {
      setDeletingChat(false);
    }
  };

  const filteredConversations = conversations.filter((conversation) =>
    conversation.patientEmail.toLowerCase().includes(search.toLowerCase()) ||
    conversation.patientName.toLowerCase().includes(search.toLowerCase())
  );

  const selectedInitials = selected ? getParticipantInitials(selected.patientName, selected.patientEmail) : '';
  const firstMsgTime = messages[0]?.created_at;
  const totalUnread = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
  return (
    <div className="h-full min-h-0 p-3 sm:p-4 md:p-6 xl:p-8">
      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete Conversation?"
        description={
          selected
            ? `Are you sure you want to delete this conversation with ${selected.patientName}? All messages will be permanently removed.`
            : 'Are you sure you want to delete this conversation?'
        }
        confirmLabel={deletingChat ? 'Deleting...' : 'Delete Chat'}
        variant="danger"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          handleDeleteChat();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <div className="flex h-full min-h-0 flex-col gap-4 lg:gap-5">
        {!hasSupabaseSession && (
          <div
            className="rounded-[24px] border px-4 py-3.5"
            style={{
              background: '#FFF7ED',
              borderColor: '#FED7AA',
              color: '#9A3412',
              fontFamily: 'var(--font-body)',
              fontSize: '0.88rem',
            }}
          >
            Chat is currently in read-only fallback mode. Sign in with a real Supabase admin account to send replies, mark messages as read, and delete threads.
          </div>
        )}
        <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section
            className={`${selected ? 'hidden lg:flex' : 'flex'} min-h-[420px] flex-col overflow-hidden rounded-[28px] border bg-white lg:min-h-0`}
            style={{ borderColor: '#DCE8FF', boxShadow: '0 20px 60px rgba(10, 36, 99, 0.08)' }}
          >
            <div className="border-b px-4 py-4 sm:px-5" style={{ borderColor: '#E8F1FF', background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FBFF 100%)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1.1rem', fontWeight: 700 }}>Inbox</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full px-3 py-1.5" style={{ background: '#EEF4FF', color: '#1B4FD8', fontFamily: 'var(--font-body)', fontSize: '0.76rem', fontWeight: 700 }}>
                    {totalUnread} unread
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={syncConversationList}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2"
                    style={{
                      background: '#FFFFFF',
                      borderColor: '#DCE8FF',
                      color: '#0A2463',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </motion.button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-2xl border px-3 py-3" style={{ background: '#F8FBFF', borderColor: '#DCE8FF' }}>
                <Search className="h-4 w-4" style={{ color: '#6B7A99' }} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by patient name or email"
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.88rem' }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
              {loadingConvs ? (
                <div className="flex h-40 flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                  <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.82rem' }}>Loading conversations...</span>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-5 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: '#EEF4FF' }}>
                    <Search className="h-6 w-6" style={{ color: '#1B4FD8' }} />
                  </div>
                  <p className="mt-4" style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 700 }}>
                    No conversations found
                  </p>
                  <p className="mt-2" style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.84rem', lineHeight: 1.6 }}>
                    New patient chats will appear here as soon as messages arrive.
                  </p>
                </div>
              ) : (
                filteredConversations.map((conversation) => {
                  const isSelected = selected?.patientEmail === conversation.patientEmail;

                  return (
                    <motion.button
                      key={conversation.patientEmail}
                      onClick={() => handleSelectConversation(conversation)}
                      whileHover={{ y: -1 }}
                      className="mb-2 w-full rounded-[22px] border p-3.5 text-left transition-all"
                      style={{
                        background: isSelected ? 'linear-gradient(135deg, #0A2463, #1B4FD8)' : '#FFFFFF',
                        borderColor: isSelected ? '#1B4FD8' : '#E8F1FF',
                        boxShadow: isSelected ? '0 18px 40px rgba(27, 79, 216, 0.24)' : '0 6px 20px rgba(10, 36, 99, 0.05)',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                          <div
                            className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                            style={{
                              background: isSelected ? 'rgba(255,255,255,0.16)' : 'linear-gradient(135deg, #F97316, #F59E0B)',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            {getParticipantInitials(conversation.patientName, conversation.patientEmail)}
                          </div>
                          {conversation.unreadCount > 0 && (
                            <span
                              className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-white"
                              style={{ background: '#EF4444', fontSize: '0.62rem', fontWeight: 700 }}
                            >
                              {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div
                                className="truncate"
                                style={{
                                  fontFamily: 'var(--font-body)',
                                  color: isSelected ? '#FFFFFF' : '#0A2463',
                                  fontSize: '0.9rem',
                                  fontWeight: 700,
                                }}
                              >
                                {conversation.patientName || conversation.patientEmail}
                              </div>
                              <div
                                className="truncate"
                                style={{
                                  fontFamily: 'var(--font-body)',
                                  color: isSelected ? 'rgba(255,255,255,0.72)' : '#6B7A99',
                                  fontSize: '0.74rem',
                                  marginTop: 2,
                                }}
                              >
                                {conversation.patientEmail}
                              </div>
                            </div>
                            <span
                              className="shrink-0"
                              style={{
                                fontFamily: 'var(--font-body)',
                                color: isSelected ? 'rgba(255,255,255,0.78)' : '#94A3B8',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                              }}
                            >
                              {formatConversationTimestamp(conversation.lastMessageTime)}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            {conversation.escalated && (
                              <span
                                className="rounded-full px-2 py-0.5"
                                style={{
                                  background: isSelected ? 'rgba(255,255,255,0.16)' : '#FEE2E2',
                                  color: isSelected ? '#FFFFFF' : '#DC2626',
                                  fontFamily: 'var(--font-body)',
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                }}
                              >
                                LIVE
                              </span>
                            )}
                            <p
                              className="truncate"
                              style={{
                                fontFamily: 'var(--font-body)',
                                color: isSelected ? 'rgba(255,255,255,0.9)' : conversation.unreadCount > 0 ? '#0A2463' : '#6B7A99',
                                fontSize: '0.8rem',
                                fontWeight: conversation.unreadCount > 0 ? 600 : 400,
                                flex: 1,
                              }}
                            >
                              {cleanPreviewText(conversation.lastMessage)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>

            <div className="border-t px-4 py-3" style={{ borderColor: '#E8F1FF', background: '#F8FBFF' }}>
              <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.76rem' }}>
                Showing {filteredConversations.length} of {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              </span>
            </div>
          </section>

          <section
            className={`${selected ? 'flex' : 'hidden lg:flex'} min-h-[420px] flex-col overflow-hidden rounded-[28px] border bg-white lg:min-h-0`}
            style={{ borderColor: '#DCE8FF', boxShadow: '0 20px 60px rgba(10, 36, 99, 0.08)' }}
          >
            {selected ? (
              <>
                <div className="border-b px-4 py-4 sm:px-6" style={{ borderColor: '#E8F1FF', background: 'linear-gradient(180deg, #FFFFFF 0%, #F7FBFF 100%)' }}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border lg:hidden"
                        style={{ borderColor: '#DCE8FF', color: '#0A2463', background: '#F8FBFF' }}
                        aria-label="Back to conversations"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      <div className="relative">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                          style={{ background: 'linear-gradient(135deg, #F97316, #F59E0B)', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}
                        >
                          {selectedInitials}
                        </div>
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white" style={{ background: '#10B981' }} />
                      </div>

                      <div className="min-w-0">
                        <div style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1.1rem', fontWeight: 700 }}>
                          {selected.patientName || selected.patientEmail}
                        </div>
                        <div className="mt-1 break-all" style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.82rem' }}>
                          {selected.patientEmail}
                        </div>
                      </div>
                    </div>

                    <div className="flex w-full items-center gap-2 sm:w-auto sm:self-start">
                      <motion.button
                        whileHover={{ scale: hasSupabaseSession ? 1.03 : 1 }}
                        whileTap={{ scale: hasSupabaseSession ? 0.97 : 1 }}
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={deletingChat || !hasSupabaseSession}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-3.5 py-2.5 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        style={{
                          background: '#FFF1F2',
                          borderColor: '#FECACA',
                          color: '#DC2626',
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </motion.button>
                    </div>
                  </div>
                </div>

                <div className="relative flex-1 overflow-hidden">
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'radial-gradient(circle at top left, rgba(110, 168, 254, 0.16), transparent 30%), linear-gradient(180deg, #F9FBFF 0%, #EEF5FF 100%)',
                    }}
                  />

                  <div className="relative flex h-full flex-col">
                    <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                      {loadingMsgs ? (
                        <div className="flex h-full min-h-[220px] items-center justify-center">
                          <div className="h-8 w-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-5 text-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: '#E8F1FF' }}>
                            <ArrowUpRight className="h-8 w-8" style={{ color: '#1B4FD8' }} />
                          </div>
                          <p className="mt-4" style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 700 }}>
                            No messages in this thread yet
                          </p>
                          <p className="mt-2" style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.84rem', lineHeight: 1.6 }}>
                            When a patient sends a message, the conversation will appear here.
                          </p>
                        </div>
                      ) : (
                        <>
                          {firstMsgTime && (
                            <div className="mb-5 text-center">
                              <span className="inline-flex rounded-full px-3.5 py-1.5" style={{ background: '#FFFFFF', color: '#6B7A99', fontFamily: 'var(--font-body)', fontSize: '0.75rem', border: '1px solid #DCE8FF' }}>
                                Conversation started {formatConversationStart(firstMsgTime)}
                              </span>
                            </div>
                          )}
                          <AnimatePresence initial={false}>
                            {messages.map((chatMessage) => (
                              <MessageBubble key={chatMessage.id} msg={chatMessage} adminName={adminName} />
                            ))}
                          </AnimatePresence>
                        </>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className="border-t px-4 py-4 sm:px-6" style={{ borderColor: '#DCE8FF', background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)' }}>
                      <div className="rounded-[26px] border p-3 sm:p-4" style={{ background: '#FFFFFF', borderColor: '#DCE8FF', boxShadow: '0 18px 40px rgba(10, 36, 99, 0.08)' }}>
                        <textarea
                          value={message}
                          onChange={(event) => setMessage(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              handleSend();
                            }
                          }}
                          disabled={!hasSupabaseSession}
                          placeholder={
                            hasSupabaseSession
                              ? `Reply to ${selected.patientName || selected.patientEmail}...`
                              : 'Supabase sign-in required before replies can be sent'
                          }
                          rows={1}
                          className="w-full resize-none bg-transparent outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.86rem', lineHeight: 1.4, minHeight: 36, maxHeight: 72 }}
                        />

                        <div className="mt-3 flex justify-end">
                          <motion.button
                            whileHover={{ scale: message.trim() && !sending && hasSupabaseSession ? 1.03 : 1 }}
                            whileTap={{ scale: message.trim() && !sending && hasSupabaseSession ? 0.97 : 1 }}
                            onClick={handleSend}
                            disabled={!message.trim() || sending || !hasSupabaseSession}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
                            style={{
                              background: message.trim() && !sending && hasSupabaseSession
                                ? 'linear-gradient(135deg, #0A2463, #1B4FD8 58%, #3A86FF)'
                                : '#CBD5E1',
                              fontFamily: 'var(--font-body)',
                              fontSize: '0.88rem',
                              fontWeight: 700,
                            }}
                          >
                            <Send className="h-4 w-4" />
                            {sending ? 'Sending...' : 'Send reply'}
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[28px]" style={{ background: 'linear-gradient(135deg, #E8F1FF, #D8E7FF)' }}>
                  <ArrowUpRight className="h-9 w-9" style={{ color: '#1B4FD8' }} />
                </div>
                <h3 className="mt-5" style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1.25rem', fontWeight: 700 }}>
                  Choose a conversation to begin
                </h3>
                <p className="mt-3 max-w-md" style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.9rem', lineHeight: 1.7 }}>
                  Select a patient thread from the inbox to review messages, reply in real time, or remove outdated conversations.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
