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
import { ConfirmModal } from '../components/ui/ConfirmModal';

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

export interface Notification {
  id: string;
  type: 'appointment' | 'message';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  sourceId?: string;
}

interface DeletedNotification extends Notification {
  deletedAt: string;
}

const DELETED_NOTIFICATIONS_STORAGE_KEY = 'admin-deleted-notifications';

function getDeletedNotifications(): DeletedNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DELETED_NOTIFICATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) as DeletedNotification[] : [];
  } catch {
    return [];
  }
}

function saveDeletedNotifications(notifications: DeletedNotification[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DELETED_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
}

const typeConfig = {
  appointment: { icon: Calendar, bg: '#E8F1FF', color: '#1B4FD8', label: 'Appointment', border: '#BFDBFE' },
  message: { icon: MessageCircle, bg: '#D1FAE5', color: '#059669', label: 'Message', border: '#A7F3D0' },
};

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
      className="group relative flex cursor-pointer gap-4 rounded-2xl p-4 transition-all"
      onClick={onClick}
      style={{
        background: notif.read ? '#fff' : '#F4F7FF',
        border: `1px solid ${notif.read ? '#E8F1FF' : tc.border}`,
        boxShadow: notif.read ? 'none' : '0 2px 12px rgba(10, 36, 99, 0.06)',
      }}
    >
      {!notif.read && (
        <div className="absolute left-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full" style={{ background: tc.color }} />
      )}
      <div className="ml-2 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: tc.bg }}>
        <Icon className="w-5 h-5" style={{ color: tc.color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="mb-0.5 flex items-center gap-2">
              <span style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem', fontWeight: notif.read ? 500 : 700 }}>
                {notif.title}
              </span>
              <span className="rounded-full px-2 py-0.5" style={{ background: tc.bg, color: tc.color, fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {tc.label}
              </span>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem', lineHeight: 1.5 }}>{notif.description}</p>
            <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.72rem', marginTop: 4, display: 'block' }}>
              {time.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {timeAgo}
            </span>
          </div>
          <div className="flex flex-shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {!notif.read && (
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={(event) => { event.stopPropagation(); onRead(notif.id); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: '#E8F1FF' }}>
                <CheckCheck className="w-3.5 h-3.5" style={{ color: '#1B4FD8' }} />
              </motion.button>
            )}
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={(event) => { event.stopPropagation(); onDelete(notif.id); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: '#FEE2E2' }}>
              <Trash2 className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

NotificationCard.displayName = 'NotificationCard';

function apptToNotif(a: any, readIds: Set<string>): Notification {
  const id = getAppointmentNotificationId(a.id);
  return {
    id,
    type: 'appointment',
    title: `New Appointment Request - ${a.patient_name || 'Patient'}`,
    description: `${a.patient_name || 'A patient'} requested a ${a.type?.replace(/-/g, ' ') || 'general'} appointment on ${a.date || '(date TBD)'}${a.doctor_name ? ` with ${a.doctor_name}` : ''}.`,
    timestamp: a.created_at,
    read: ['approved', 'rejected', 'completed'].includes(a.status) || readIds.has(id),
    sourceId: a.id,
  };
}

function msgToNotif(m: any, readIds: Set<string>): Notification {
  const id = getMessageNotificationId(m.id);
  return {
    id,
    type: 'message',
    title: `New Message - ${m.patient_name || m.patient_email}`,
    description: m.message?.length > 100 ? `${m.message.slice(0, 100)}...` : m.message,
    timestamp: m.created_at,
    read: m.read === true || readIds.has(id),
    sourceId: m.id,
  };
}

export function NotificationsPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [deletedNotifications, setDeletedNotifications] = useState<DeletedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active');
  const [filter, setFilter] = useState<'all' | 'unread' | Notification['type']>('all');
  const [deleteTarget, setDeleteTarget] = useState<Notification | null>(null);
  const [recoverTarget, setRecoverTarget] = useState<DeletedNotification | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<DeletedNotification | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const dismissed = getDismissed();
      const readIds = getReadIds();

      const [apptRes, msgRes] = await Promise.all([
        supabase.from('appointments').select('id, patient_name, type, date, doctor_name, status, reason, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(100),
        supabase.from('chat_messages').select('id, patient_name, patient_email, message, read, created_at').eq('sender_type', 'patient').order('created_at', { ascending: false }).limit(100),
      ]);

      const apptNotifs: Notification[] = (apptRes.data || []).map((a) => apptToNotif(a, readIds)).filter((n) => !dismissed.has(n.id));
      const msgNotifs: Notification[] = (msgRes.data || []).map((m) => msgToNotif(m, readIds)).filter((n) => !dismissed.has(n.id));
      const allNotifs = [...apptNotifs, ...msgNotifs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const storedDeleted = getDeletedNotifications();
      const deletedIds = new Set(storedDeleted.map((notification) => notification.id));

      setNotifications(allNotifs.filter((notification) => !deletedIds.has(notification.id)));
      setDeletedNotifications(
        storedDeleted
          .map((stored) => {
            const latest = allNotifs.find((notification) => notification.id === stored.id);
            return latest ? { ...latest, deletedAt: stored.deletedAt } : stored;
          })
          .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
      );
    } catch (err) {
      console.error('fetchData error:', err);
      toast.error('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments' }, (payload) => {
        const dismissed = getDismissed();
        const readIds = getReadIds();
        const notif = apptToNotif(payload.new, readIds);
        if (dismissed.has(notif.id)) return;
        if (getDeletedNotifications().some((notification) => notification.id === notif.id)) return;
        setNotifications((prev) => [notif, ...prev]);
        toast.info(`New appointment: ${payload.new.patient_name || 'Patient'}`);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appointments' }, (payload) => {
        const dismissed = getDismissed();
        const readIds = getReadIds();
        const notif = apptToNotif(payload.new, readIds);
        if (dismissed.has(notif.id)) return;

        if (getDeletedNotifications().some((notification) => notification.id === notif.id)) {
          setDeletedNotifications((prev) => {
            const next = prev.map((notification) => notification.id === notif.id ? { ...notif, deletedAt: notification.deletedAt } : notification);
            saveDeletedNotifications(next);
            return next;
          });
          return;
        }

        setNotifications((prev) => {
          const exists = prev.some((notification) => notification.id === notif.id);
          return exists ? prev.map((notification) => notification.id === notif.id ? notif : notification) : [notif, ...prev];
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        if (payload.new.sender_type !== 'patient') return;
        const dismissed = getDismissed();
        const readIds = getReadIds();
        const notif = msgToNotif(payload.new, readIds);
        if (dismissed.has(notif.id)) return;
        if (getDeletedNotifications().some((notification) => notification.id === notif.id)) return;
        setNotifications((prev) => [notif, ...prev]);
        toast.info(`New message from ${payload.new.patient_name || payload.new.patient_email}`);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleRead = async (id: string) => {
    setNotifications((prev) => prev.map((notification) => notification.id === id ? { ...notification, read: true } : notification));
    const readIds = getReadIds();
    readIds.add(id);
    saveReadIds(readIds);

    const notif = notifications.find((notification) => notification.id === id);
    if (notif?.type === 'message' && notif.sourceId) {
      await supabase.from('chat_messages').update({ read: true }).eq('id', notif.sourceId);
    }
  };

  const handleNotifClick = async (notif: Notification) => {
    await handleRead(notif.id);
    if (!onNavigate) return;
    if (notif.type === 'appointment') onNavigate('appointments');
    if (notif.type === 'message') onNavigate('chat');
  };

  const handleMarkAllRead = async () => {
    const readIds = getReadIds();
    const msgIds: string[] = [];

    setNotifications((prev) => prev.map((notification) => {
      if (!notification.read) {
        readIds.add(notification.id);
        if (notification.type === 'message' && notification.sourceId) msgIds.push(notification.sourceId);
      }
      return { ...notification, read: true };
    }));

    saveReadIds(readIds);
    if (msgIds.length > 0) {
      await supabase.from('chat_messages').update({ read: true }).in('id', msgIds);
    }
    toast.success('All notifications marked as read.');
  };

  const handleDelete = (id: string) => {
    const notification = notifications.find((item) => item.id === id);
    if (!notification) return;

    const deletedNotification: DeletedNotification = { ...notification, deletedAt: new Date().toISOString() };
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    setDeletedNotifications((prev) => {
      const next = [deletedNotification, ...prev.filter((item) => item.id !== id)];
      saveDeletedNotifications(next);
      return next;
    });
    setActiveTab('deleted');
    toast.success('Notification moved to Recently Deleted.');
  };

  const handleClearAll = () => {
    const deletedAt = new Date().toISOString();
    const movedNotifications = notifications.map((notification) => ({ ...notification, deletedAt }));

    setDeletedNotifications((prev) => {
      const next = [...movedNotifications, ...prev.filter((item) => !movedNotifications.some((moved) => moved.id === item.id))];
      saveDeletedNotifications(next);
      return next;
    });
    setNotifications([]);
    setActiveTab('deleted');
    toast.success('All notifications moved to Recently Deleted.');
  };

  const handleRecover = (notification: DeletedNotification) => {
    const restored: Notification = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      description: notification.description,
      timestamp: notification.timestamp,
      read: notification.read,
      sourceId: notification.sourceId,
    };

    setDeletedNotifications((prev) => {
      const next = prev.filter((item) => item.id !== notification.id);
      saveDeletedNotifications(next);
      return next;
    });
    setNotifications((prev) => [restored, ...prev.filter((item) => item.id !== notification.id)]);
    setActiveTab('active');
    toast.success('Notification recovered.');
  };

  const handlePermanentDelete = (notification: DeletedNotification) => {
    setDeletedNotifications((prev) => {
      const next = prev.filter((item) => item.id !== notification.id);
      saveDeletedNotifications(next);
      return next;
    });

    const dismissed = getDismissed();
    dismissed.add(notification.id);
    saveDismissed(dismissed);
    toast.success('Notification permanently deleted.');
  };

  const handleDeleteAll = () => {
    deletedNotifications.forEach((n) => {
      const dismissed = getDismissed();
      dismissed.add(n.id);
      saveDismissed(dismissed);
    });
    setDeletedNotifications([]);
    saveDeletedNotifications([]);
    setConfirmDeleteAll(false);
    toast.success('All deleted notifications permanently removed.');
  };

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const visibleNotifications = activeTab === 'active' ? notifications : deletedNotifications;
  const filtered = visibleNotifications.filter((notification) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.read;
    return notification.type === filter;
  });

  const filterOptions = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'appointment', label: 'Appointments' },
    { key: 'message', label: 'Messages' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6">

      {/* Confirm Modals */}
      <ConfirmModal
        open={!!deleteTarget}
        title={`Remove ${deleteTarget?.type === 'message' ? 'message' : 'notification'}?`}
        description="Are you sure you want to remove this notification?"
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        open={!!recoverTarget}
        title={`Recover ${recoverTarget?.type === 'message' ? 'message' : 'notification'}?`}
        description="This notification will return to the main list."
        confirmLabel="Recover"
        onConfirm={() => {
          if (recoverTarget) handleRecover(recoverTarget);
          setRecoverTarget(null);
        }}
        onCancel={() => setRecoverTarget(null)}
      />
      <ConfirmModal
        open={!!permanentDeleteTarget}
        title={`Permanently delete ${permanentDeleteTarget?.type === 'message' ? 'message' : 'notification'}?`}
        description="This will permanently delete the notification."
        confirmLabel="Permanently Delete"
        variant="danger"
        onConfirm={() => {
          if (permanentDeleteTarget) handlePermanentDelete(permanentDeleteTarget);
          setPermanentDeleteTarget(null);
        }}
        onCancel={() => setPermanentDeleteTarget(null)}
      />
      <ConfirmModal
        open={confirmDeleteAll}
        title="Permanently delete all?"
        description="This will permanently delete all notifications in Recently Deleted. This cannot be undone."
        confirmLabel="Delete All"
        variant="danger"
        onConfirm={handleDeleteAll}
        onCancel={() => setConfirmDeleteAll(false)}
      />

      {/* Tabs + Filters + Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'active', label: 'Notifications', count: notifications.length },
          { key: 'deleted', label: 'Recently Deleted', count: deletedNotifications.length },
        ].map((tab) => (
          <motion.button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'active' | 'deleted')}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.8rem',
              fontWeight: activeTab === tab.key ? 700 : 500,
              background: activeTab === tab.key ? '#0A2463' : '#fff',
              color: activeTab === tab.key ? '#fff' : '#6B7A99',
              border: `1px solid ${activeTab === tab.key ? 'transparent' : '#E8F1FF'}`,
            }}
          >
            {tab.label}
            <span className="px-1.5 py-0.5 rounded-md" style={{ background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : '#F4F7FF', fontSize: '0.7rem', fontWeight: 700, color: activeTab === tab.key ? '#fff' : '#6B7A99' }}>
              {tab.count}
            </span>
          </motion.button>
        ))}

        <div className="w-px h-6 mx-1" style={{ background: '#E8F1FF' }} />

        {filterOptions.map((opt) => {
          const count = opt.key === 'all' ? visibleNotifications.length : opt.key === 'unread' ? visibleNotifications.filter((n) => !n.read).length : visibleNotifications.filter((n) => n.type === opt.key).length;
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

        <div className="ml-auto flex gap-2">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
            style={{ background: '#fff', borderColor: '#E8F1FF', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6B7A99' }}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </motion.button>
          {activeTab === 'active' && unreadCount > 0 && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
              style={{ background: '#fff', borderColor: '#E8F1FF', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#0A2463' }}>
              <CheckCheck className="w-4 h-4" style={{ color: '#1B4FD8' }} /> Mark all read
            </motion.button>
          )}
          {activeTab === 'active' && notifications.length > 0 && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
              style={{ background: '#fff', borderColor: '#E8F1FF', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#DC2626' }}>
              <Trash2 className="w-4 h-4" /> Clear all
            </motion.button>
          )}
          {activeTab === 'deleted' && deletedNotifications.length > 0 && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={() => setConfirmDeleteAll(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
              style={{ background: '#FEE2E2', borderColor: '#FECACA', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#DC2626' }}>
              <Trash2 className="w-4 h-4" /> Delete all
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
                <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.875rem' }}>
                  {activeTab === 'active' ? "You're all caught up! Check back later." : 'No recently deleted notifications.'}
                </p>
              </motion.div>
            ) : (
              filtered.map((notif) => (
                activeTab === 'active' ? (
                  <NotificationCard
                    key={notif.id}
                    notif={notif}
                    onRead={handleRead}
                    onDelete={() => setDeleteTarget(notif)}
                    onClick={() => handleNotifClick(notif)}
                  />
                ) : (
                  <motion.div
                    key={notif.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-start justify-between gap-4 rounded-2xl border p-4"
                    style={{ background: '#fff', borderColor: '#E8F1FF' }}
                  >
                    <div className="min-w-0">
                      <div style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem', fontWeight: 700 }}>
                        {notif.title}
                      </div>
                      <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem', lineHeight: 1.5, marginTop: 4 }}>
                        {notif.description}
                      </p>
                      <span style={{ fontFamily: 'var(--font-body)', color: '#9CA3AF', fontSize: '0.72rem', marginTop: 6, display: 'block' }}>
                        Deleted {new Date((notif as DeletedNotification).deletedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={() => setRecoverTarget(notif as DeletedNotification)}
                        className="rounded-xl px-3 py-2"
                        style={{ background: '#D1FAE5', color: '#059669', fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700 }}>
                        Recover
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={() => setPermanentDeleteTarget(notif as DeletedNotification)}
                        className="rounded-xl px-3 py-2"
                        style={{ background: '#FEE2E2', color: '#DC2626', fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700 }}>
                        Delete
                      </motion.button>
                    </div>
                  </motion.div>
                )
              ))
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}