import { useState, forwardRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, MessageCircle, Calendar, CheckCheck, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAppointmentNotificationId,
  getDismissedNotificationIds,
  getMessageNotificationId,
  getReadNotificationIds,
  saveDismissedNotificationIds,
  saveReadNotificationIds,
} from '../lib/notificationState';
import { supabase } from '../lib/supabase';

// ── Persistence keys ────────────────────────────────────────────────────────────
function getDismissed(): Set<string> {
  return getDismissedNotificationIds();
}
function saveDismissed(ids: Set<string>) {
  saveDismissedNotificationIds(ids);
}
function getReadIds(): Set<string> {
  return getReadNotificationIds();
}
function saveReadIds(ids: Set<string>) {
  saveReadNotificationIds(ids);
}

// ── Types ───────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: 'appointment' | 'message';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  sourceId?: string;
}

const typeConfig = {
  appointment: { icon: Calendar, bg: '#E8F1FF', color: '#1B4FD8', label: 'Appointment', border: '#BFDBFE' },
  message: { icon: MessageCircle, bg: '#D1FAE5', color: '#059669', label: 'Message', border: '#A7F3D0' },
};

// ── Notification Card ───────────────────────────────────────────────────────────

const NotificationCard = forwardRef<HTMLDivElement, {
  notif: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick?: () => void;
}>(function NotificationCard({ notif, onRead, onDelete, onClick }, ref) {
  const tc = typeConfig[notif.type];
  const Icon = tc.icon;
  const time = new Date(notif.timestamp);
  const now = new Date();
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const timeAgo = diffDays > 0 ? `${diffDays}d ago` : diffHours > 0 ? `${diffHours}h ago` : diffMins <= 0 ? 'just now' : `${diffMins}m ago`;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="flex gap-4 p-4 rounded-2xl group transition-all relative cursor-pointer"
      onClick={onClick}
      style={{
        background: notif.read ? '#fff' : '#F4F7FF',
        border: `1px solid ${notif.read ? '#E8F1FF' : tc.border}`,
        boxShadow: notif.read ? 'none' : '0 2px 12px rgba(10, 36, 99, 0.06)',
      }}
    >
      {!notif.read && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: tc.color }} />
      )}
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ml-2" style={{ background: tc.bg }}>
        <Icon className="w-5 h-5" style={{ color: tc.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem', fontWeight: notif.read ? 500 : 700 }}>
                {notif.title}
              </span>
              <span className="px-2 py-0.5 rounded-full" style={{ background: tc.bg, color: tc.color, fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {tc.label}
              </span>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem', lineHeight: 1.5 }}>{notif.description}</p>
            <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.72rem', marginTop: 4, display: 'block' }}>
              {time.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {timeAgo}
            </span>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {!notif.read && (
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => onRead(notif.id)}
                className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#E8F1FF' }}>
                <CheckCheck className="w-3.5 h-3.5" style={{ color: '#1B4FD8' }} />
              </motion.button>
            )}
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => onDelete(notif.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#FEE2E2' }}>
              <Trash2 className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
NotificationCard.displayName = 'NotificationCard';

// ── Helpers ─────────────────────────────────────────────────────────────────────

function apptToNotif(a: any, readIds: Set<string>): Notification {
  const id = getAppointmentNotificationId(a.id);
  return {
    id,
    type: 'appointment',
    title: `New Appointment Request — ${a.patient_name || 'Patient'}`,
    description: `${a.patient_name || 'A patient'} requested a ${a.type?.replace(/-/g, ' ') || 'general'} appointment on ${a.date || '(date TBD)'}${a.doctor_name ? ` with ${a.doctor_name}` : ''}.`,
    timestamp: a.created_at,
    // read if: DB status is concluded OR admin marked it read locally
    read: ['approved', 'rejected', 'completed'].includes(a.status) || readIds.has(id),
    sourceId: a.id,
  };
}

function msgToNotif(m: any, readIds: Set<string>): Notification {
  const id = getMessageNotificationId(m.id);
  return {
    id,
    type: 'message',
    title: `New Message — ${m.patient_name || m.patient_email}`,
    description: m.message?.length > 100 ? m.message.slice(0, 100) + '…' : m.message,
    timestamp: m.created_at,
    read: m.read === true || readIds.has(id),
    sourceId: m.id,
  };
}

// ── Main Page ────────────────────────────────────────────────────────────────────

export function NotificationsPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | Notification['type']>('all');

  // ── Fetch — always filter out dismissed IDs ──────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const dismissed = getDismissed();
      const readIds = getReadIds();

      const [apptRes, msgRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, patient_name, type, date, doctor_name, status, reason, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('chat_messages')
          .select('id, patient_name, patient_email, message, read, created_at')
          .eq('sender_type', 'patient')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      const apptNotifs: Notification[] = (apptRes.data || [])
        .map(a => apptToNotif(a, readIds))
        .filter(n => !dismissed.has(n.id));

      const msgNotifs: Notification[] = (msgRes.data || [])
        .map(m => msgToNotif(m, readIds))
        .filter(n => !dismissed.has(n.id));

      const allNotifs = [...apptNotifs, ...msgNotifs].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setNotifications(allNotifs);
    } catch (err) {
      console.error('fetchData error:', err);
      toast.error('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Realtime ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments' }, (payload) => {
        const dismissed = getDismissed();
        const readIds = getReadIds();
        const notif = apptToNotif(payload.new, readIds);
        if (dismissed.has(notif.id)) return;
        setNotifications(prev => [notif, ...prev]);
        toast.info(`New appointment: ${payload.new.patient_name || 'Patient'}`);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appointments' }, (payload) => {
        const dismissed = getDismissed();
        const readIds = getReadIds();
        const notif = apptToNotif(payload.new, readIds);
        if (dismissed.has(notif.id)) return;
        setNotifications(prev => {
          const exists = prev.some(n => n.id === notif.id);
          if (exists) return prev.map(n => n.id === notif.id ? notif : n);
          return [notif, ...prev];
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        if (payload.new.sender_type !== 'patient') return;
        const dismissed = getDismissed();
        const readIds = getReadIds();
        const notif = msgToNotif(payload.new, readIds);
        if (dismissed.has(notif.id)) return;
        setNotifications(prev => [notif, ...prev]);
        toast.info(`New message from ${payload.new.patient_name || payload.new.patient_email}`);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Handlers — all persist to localStorage ────────────────────────────────────

  const handleRead = async (id: string) => {
    // Update local state
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

    // Persist read state to localStorage
    const readIds = getReadIds();
    readIds.add(id);
    saveReadIds(readIds);

    // Also sync read=true to Supabase for chat messages
    const notif = notifications.find(n => n.id === id);
    if (notif?.type === 'message' && notif.sourceId) {
      await supabase.from('chat_messages').update({ read: true }).eq('id', notif.sourceId);
    }
  };

  const handleNotifClick = async (notif: Notification) => {
    // Mark as read first
    await handleRead(notif.id);
    // Navigate to the relevant module
    if (onNavigate) {
      if (notif.type === 'appointment') onNavigate('appointments');
      else if (notif.type === 'message') onNavigate('chat');
    }
  };

  const handleMarkAllRead = async () => {
    const readIds = getReadIds();
    const msgIds: string[] = [];

    setNotifications(prev => prev.map(n => {
      if (!n.read) {
        readIds.add(n.id);
        if (n.type === 'message' && n.sourceId) msgIds.push(n.sourceId);
      }
      return { ...n, read: true };
    }));

    saveReadIds(readIds);

    // Bulk update chat messages in Supabase
    if (msgIds.length > 0) {
      await supabase.from('chat_messages').update({ read: true }).in('id', msgIds);
    }

    toast.success('All notifications marked as read.');
  };

  const handleDelete = (id: string) => {
    // Remove from state
    setNotifications(prev => prev.filter(n => n.id !== id));

    // Persist dismissed ID to localStorage
    const dismissed = getDismissed();
    dismissed.add(id);
    saveDismissed(dismissed);

    toast.success('Notification dismissed.');
  };

  const handleClearAll = () => {
    // Persist all current notification IDs as dismissed
    const dismissed = getDismissed();
    notifications.forEach(n => dismissed.add(n.id));
    saveDismissed(dismissed);

    setNotifications([]);
    toast.success('All notifications cleared.');
  };

  // Unread count derived from visible (non-dismissed) notifications
  const unreadCount = notifications.filter(n => !n.read).length;

  const filtered = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    return n.type === filter;
  });

  const filterOptions = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'appointment', label: 'Appointments' },
    { key: 'message', label: 'Messages' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">

          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 700 }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">

        {/* Filter Tabs — LEFT */}
        <div className="flex flex-wrap gap-2">
          {filterOptions.map(opt => {
            const count = opt.key === 'all' ? notifications.length
              : opt.key === 'unread' ? notifications.filter(n => !n.read).length
                : notifications.filter(n => n.type === opt.key).length;
            return (
              <motion.button
                key={opt.key}
                onClick={() => setFilter(opt.key as any)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8rem',
                  fontWeight: filter === opt.key ? 700 : 500,
                  background: filter === opt.key ? '#0A2463' : '#fff',
                  color: filter === opt.key ? '#fff' : '#6B7A99',
                  border: `1px solid ${filter === opt.key ? 'transparent' : '#E8F1FF'}`,
                }}
              >
                {opt.label}
                <span className="px-1.5 py-0.5 rounded-md" style={{ background: filter === opt.key ? 'rgba(255,255,255,0.2)' : '#F4F7FF', fontSize: '0.7rem', fontWeight: 700, color: filter === opt.key ? '#fff' : '#6B7A99' }}>
                  {count}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Action Buttons — RIGHT */}
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
            style={{ background: '#fff', borderColor: '#E8F1FF', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6B7A99' }}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </motion.button>
          {unreadCount > 0 && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
              style={{ background: '#fff', borderColor: '#E8F1FF', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#0A2463' }}>
              <CheckCheck className="w-4 h-4" style={{ color: '#1B4FD8' }} /> Mark all read
            </motion.button>
          )}
          {notifications.length > 0 && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
              style={{ background: '#fff', borderColor: '#E8F1FF', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#DC2626' }}>
              <Trash2 className="w-4 h-4" /> Clear all
            </motion.button>
          )}
        </div>

      </div>
      {/* Notifications List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl" style={{ background: '#fff', border: '1px solid #E8F1FF' }}>
            <div className="w-8 h-8 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin mb-4" />
            <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.875rem' }}>Loading notifications...</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 rounded-2xl"
                style={{ background: '#fff', border: '1px solid #E8F1FF' }}
              >
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#E8F1FF' }}>
                  <Bell className="w-8 h-8" style={{ color: '#1B4FD8' }} />
                </div>
                <p style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>No notifications</p>
                <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.875rem' }}>You're all caught up! Check back later.</p>
              </motion.div>
            ) : (
              filtered.map(notif => (
                <NotificationCard
                  key={notif.id}
                  notif={notif}
                  onRead={handleRead}
                  onDelete={handleDelete}
                  onClick={() => handleNotifClick(notif)}
                />
              ))
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
