import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Search, ArrowUpRight, Bot, CheckCheck, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/ui/ConfirmModal';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DbMessage {
  id: string;
  patient_email: string;
  patient_name: string;
  sender_type: 'patient' | 'bot' | 'admin';
  message: string;
  created_at: string;
  read: boolean;
}

interface ConversationSummary {
  patientEmail: string;
  patientName: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
  escalated: boolean;
}

type ConversationRow = Pick<
  DbMessage,
  'patient_email' | 'patient_name' | 'message' | 'created_at' | 'sender_type' | 'read'
>;

function normalizePatientEmail(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

function summarizeConversations(rows: ConversationRow[]): ConversationSummary[] {
  const map = new Map<string, ConversationSummary>();

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
        escalated: false,
      });
    }

    const conversation = map.get(normalizedEmail)!;
    if (row.sender_type === 'patient' && !row.read) {
      conversation.unreadCount += 1;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg, adminName }: { msg: DbMessage; adminName: string }) {
  const isAdmin = msg.sender_type === 'admin';
  const isBot = msg.sender_type === 'bot';
  const time = new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  if (isAdmin) {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex justify-end mb-3">
        <div className="max-w-[75%]">
          <div className="rounded-2xl rounded-br-sm px-4 py-3 text-white" style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', lineHeight: 1.5 }}>{msg.message}</p>
          </div>
          <div className="flex items-center justify-end gap-1 mt-1 px-1">
            <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.7rem' }}>{adminName} · {time}</span>
            <CheckCheck className="w-3 h-3" style={{ color: msg.read ? '#059669' : '#6B7A99' }} />
          </div>
        </div>
      </motion.div>
    );
  }

  if (isBot) {
    return (
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 mb-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1" style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="max-w-[75%]">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontFamily: 'var(--font-body)', color: '#7C3AED', fontSize: '0.7rem', fontWeight: 700 }}>AI Assistant</span>
          </div>
          <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ background: '#EDE9FE', border: '1px solid #DDD6FE' }}>
            <p style={{ fontFamily: 'var(--font-body)', color: '#4C1D95', fontSize: '0.875rem', lineHeight: 1.5 }}>{msg.message}</p>
          </div>
          <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.7rem', marginTop: 4, display: 'block', paddingLeft: 4 }}>{time}</span>
        </div>
      </motion.div>
    );
  }

  // patient
  const initials = (msg.patient_name || msg.patient_email).slice(0, 2).toUpperCase();
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 mb-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0 mt-1"
        style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', fontSize: '0.6rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
        {initials}
      </div>
      <div className="max-w-[75%]">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.7rem', fontWeight: 700 }}>
            {msg.patient_name || msg.patient_email}
          </span>
        </div>
        <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ background: '#F4F7FF', border: '1px solid #E8F1FF' }}>
          <p style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem', lineHeight: 1.5 }}>{msg.message}</p>
        </div>
        <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.7rem', marginTop: 4, display: 'block', paddingLeft: 4 }}>{time}</span>
      </div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function LiveChatPage() {
  const { user } = useAuth();
  const adminName = user?.name ?? 'Admin';

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use a ref to track the currently selected conversation in realtime callbacks
  const selectedRef = useRef<ConversationSummary | null>(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

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

  // ── Fetch conversation list ────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    setLoadingConvs(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('patient_email, patient_name, message, created_at, sender_type, read')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchConversations error:', error.message);
      toast.error('Failed to load conversations: ' + error.message);
      setLoadingConvs(false);
      return;
    }
    if (!data) { setLoadingConvs(false); return; }

    // Group by patient_email — keep only the most recent row per patient
    const map = new Map<string, ConversationSummary>();
    for (const row of data) {
      const email = row.patient_email as string;
      if (!map.has(email)) {
        map.set(email, {
          patientEmail: email,
          patientName: row.patient_name || email,
          unreadCount: 0,
          lastMessage: row.message,
          lastMessageTime: row.created_at,
          escalated: false,
        });
      }
      const conv = map.get(email)!;
      // Count unread patient messages
      if (row.sender_type === 'patient' && !row.read) {
        conv.unreadCount += 1;
      }
    }

    setConversations(Array.from(map.values()));
    setLoadingConvs(false);
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ── Load messages for selected conversation ────────────────────────────────
  const loadMessages = useCallback(async (patientEmail: string) => {
    setLoadingMsgs(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('patient_email', patientEmail)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as DbMessage[]);
    } else if (error) {
      console.error('loadMessages error:', error.message);
      toast.error('Failed to load messages.');
    }
    setLoadingMsgs(false);

    // Mark all patient messages as read
    await supabase
      .from('chat_messages')
      .update({ read: true })
      .eq('patient_email', patientEmail)
      .eq('sender_type', 'patient')
      .eq('read', false);

    // Clear unread count locally
    setConversations(prev =>
      prev.map(c => c.patientEmail === patientEmail ? { ...c, unreadCount: 0 } : c)
    );
  }, []);

  const handleSelectConversation = useCallback((conv: ConversationSummary) => {
    setSelected(conv);
    loadMessages(conv.patientEmail);
  }, [loadMessages]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('admin-chat-realtime-v2')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newRow = payload.new as DbMessage;
          const currentSelected = selectedRef.current;

          // Append to open conversation if it matches
          if (currentSelected && currentSelected.patientEmail === newRow.patient_email) {
            setMessages(msgs => [...msgs, newRow]);
            // Auto-mark as read since admin is viewing it
            if (newRow.sender_type === 'patient') {
              supabase
                .from('chat_messages')
                .update({ read: true })
                .eq('id', newRow.id)
                .then(() => { });
            }
          }

          // Update conversation list
          setConversations(prev => {
            const isCurrentlyViewed = currentSelected?.patientEmail === newRow.patient_email;
            const exists = prev.find(c => c.patientEmail === newRow.patient_email);
            if (exists) {
              return prev.map(c => {
                if (c.patientEmail !== newRow.patient_email) return c;
                const addUnread = newRow.sender_type === 'patient' && !isCurrentlyViewed ? 1 : 0;
                return {
                  ...c,
                  lastMessage: newRow.message,
                  lastMessageTime: newRow.created_at,
                  unreadCount: c.unreadCount + addUnread,
                };
              });
            } else {
              // Brand new conversation — prepend to top
              return [
                {
                  patientEmail: newRow.patient_email,
                  patientName: newRow.patient_name || newRow.patient_email,
                  unreadCount: newRow.sender_type === 'patient' && !isCurrentlyViewed ? 1 : 0,
                  lastMessage: newRow.message,
                  lastMessageTime: newRow.created_at,
                  escalated: false,
                },
                ...prev,
              ];
            }
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Send admin reply ───────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!message.trim() || !selected || sending) return;
    setSending(true);
    const text = message.trim();
    setMessage('');

    const { error } = await supabase.from('chat_messages').insert({
      patient_email: selected.patientEmail,
      patient_name: selected.patientName,
      sender_type: 'admin',
      message: text,
      read: false,  // Patient hasn't read this yet — this drives their unread badge
    });

    if (error) {
      toast.error('Failed to send message. ' + error.message);
      setMessage(text);
    }
    setSending(false);
  };

  const handleEscalate = () => {
    if (!selected) return;
    setConversations(prev => prev.map(c => c.patientEmail === selected.patientEmail ? { ...c, escalated: true } : c));
    setSelected(prev => prev ? { ...prev, escalated: true } : prev);
    toast.success('Conversation escalated to live staff mode.');
  };

  const handleDeleteChat = async () => {
    if (!selected) return;
    setDeletingChat(true);
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('patient_email', selected.patientEmail);
    setDeletingChat(false);
    if (error) {
      toast.error('Failed to delete conversation: ' + error.message);
      return;
    }
    setConversations(prev => prev.filter(c => c.patientEmail !== selected.patientEmail));
    setSelected(null);
    setMessages([]);
    toast.success('Conversation deleted successfully.');
  };

  const filteredConvs = conversations.filter(c =>
    c.patientEmail.toLowerCase().includes(search.toLowerCase()) ||
    c.patientName.toLowerCase().includes(search.toLowerCase())
  );

  const selectedInitials = selected ? (selected.patientName || selected.patientEmail).slice(0, 2).toUpperCase() : '';
  const firstMsgTime = messages[0]?.created_at;

  return (
    <div className="p-4 md:p-8 h-full">
      <div className="flex flex-col h-full gap-4">
        {/* Header actions */}
        <div className="flex justify-end">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={fetchConversations}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border"
              style={{ background: '#fff', borderColor: '#E8F1FF', color: '#6B7A99', fontFamily: 'var(--font-body)', fontSize: '0.78rem' }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </motion.button>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex gap-4 flex-1 min-h-0" style={{ height: 'calc(100vh - 240px)' }}>
          {/* Conversation List */}
          <div className="w-72 flex-shrink-0 flex flex-col rounded-2xl overflow-hidden"
            style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}>
            <div className="p-4 border-b flex-shrink-0" style={{ borderColor: '#E8F1FF' }}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ background: '#F4F7FF', borderColor: '#E8F1FF' }}>
                <Search className="w-3.5 h-3.5" style={{ color: '#6B7A99' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..."
                  className="bg-transparent outline-none flex-1"
                  style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#0A2463' }} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loadingConvs ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />
                  <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem' }}>Loading...</span>
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: '#F4F7FF' }}>
                    <Search className="w-5 h-5" style={{ color: '#6B7A99' }} />
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem', fontWeight: 600 }}>No conversations yet</p>
                  <p style={{ fontFamily: 'var(--font-body)', color: '#9CA3AF', fontSize: '0.72rem', marginTop: 4 }}>Patient chats will appear here in real-time</p>
                </div>
              ) : (
                filteredConvs.map(conv => (
                  <motion.button
                    key={conv.patientEmail}
                    onClick={() => handleSelectConversation(conv)}
                    whileHover={{ x: 2 }}
                    className="w-full flex items-start gap-3 p-3 rounded-xl mb-1 text-left transition-all"
                    style={{
                      background: selected?.patientEmail === conv.patientEmail ? '#E8F1FF' : 'transparent',
                      border: `1px solid ${selected?.patientEmail === conv.patientEmail ? '#BFDBFE' : 'transparent'}`,
                    }}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                        style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                        {(conv.patientName || conv.patientEmail).slice(0, 2).toUpperCase()}
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
                          style={{ background: '#EF4444', fontSize: '0.55rem', fontWeight: 700 }}>
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.85rem', fontWeight: conv.unreadCount > 0 ? 700 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {conv.patientName || conv.patientEmail}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {conv.escalated && (
                          <span className="px-1.5 py-0.5 rounded text-white flex-shrink-0" style={{ background: '#EF4444', fontSize: '0.6rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>LIVE</span>
                        )}
                        <p style={{ fontFamily: 'var(--font-body)', color: conv.unreadCount > 0 ? '#0A2463' : '#6B7A99', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, fontWeight: conv.unreadCount > 0 ? 600 : 400 }}>
                          {conv.lastMessage}
                        </p>
                      </div>
                      <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.68rem', marginTop: 2, display: 'block' }}>
                        {new Date(conv.lastMessageTime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </motion.button>
                ))
              )}
            </div>
            <div className="px-3 py-2 border-t" style={{ borderColor: '#E8F1FF', background: '#F9FAFB' }}>
              <span style={{ fontFamily: 'var(--font-body)', color: '#9CA3AF', fontSize: '0.72rem' }}>
                {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} · {conversations.reduce((sum, c) => sum + c.unreadCount, 0)} unread
              </span>
            </div>
          </div>

          {/* Chat Window */}
          {selected ? (
            <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}>
              {/* Delete Confirm Modal */}
              <ConfirmModal
                open={showDeleteConfirm}
                title="Delete Conversation?"
                description={`Are you sure you want to delete this conversation with ${selected.patientName}? All messages will be permanently removed.`}
                confirmLabel={deletingChat ? 'Deleting...' : 'Delete Chat'}
                variant="danger"
                onConfirm={() => { setShowDeleteConfirm(false); handleDeleteChat(); }}
                onCancel={() => setShowDeleteConfirm(false)}
              />
              {/* Chat Header */}
              <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: '#E8F1FF', background: '#F4F7FF' }}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                      style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                      {selectedInitials}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white" style={{ background: '#10B981' }} />
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.9rem', fontWeight: 700 }}>
                      {selected.patientName || selected.patientEmail}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem' }}>{selected.patientEmail}</span>
                      {selected.escalated && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-white" style={{ background: '#EF4444', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                          LIVE STAFF
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-white"
                    style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)', borderColor: '#FECACA', fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 600 }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Chat
                  </motion.button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="w-6 h-6 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />
                  </div>
                ) : (
                  <>
                    {firstMsgTime && (
                      <div className="mb-4 text-center">
                        <span className="px-3 py-1.5 rounded-full" style={{ background: '#F4F7FF', color: '#6B7A99', fontFamily: 'var(--font-body)', fontSize: '0.75rem' }}>
                          Conversation started {new Date(firstMsgTime).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    <AnimatePresence>
                      {messages.map(msg => (
                        <MessageBubble key={msg.id} msg={msg} adminName={adminName} />
                      ))}
                    </AnimatePresence>
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-4 border-t flex-shrink-0" style={{ borderColor: '#E8F1FF', background: '#F4F7FF' }}>
                <div className="flex items-end gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Type a reply... (Enter to send)"
                      rows={1}
                      className="w-full px-4 py-3 rounded-xl outline-none resize-none"
                      style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', border: '2px solid #E8F1FF', background: '#fff', color: '#0A2463', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSend}
                    disabled={!message.trim() || sending}
                    className="p-2.5 rounded-xl text-white flex-shrink-0"
                    style={{ background: message.trim() && !sending ? 'linear-gradient(135deg, #1B4FD8, #3A86FF)' : '#D1D5DB' }}
                  >
                    <Send className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-2xl" style={{ background: '#fff', border: '1px solid #E8F1FF' }}>
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#E8F1FF' }}>
                  <ArrowUpRight className="w-8 h-8" style={{ color: '#1B4FD8' }} />
                </div>
                <p style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>Select deleteonversation</p>
                <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.875rem' }}>Choose a patient from the list to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
