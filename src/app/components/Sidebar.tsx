import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, Calendar, UserCog, Users, BarChart3, 
  MessageSquare, Bell, LogOut, Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  countUnreadAppointmentNotifications,
  countUnreadMessageNotifications,
  getDismissedNotificationIds,
  getReadNotificationIds,
  subscribeToNotificationStateSync,
} from '../lib/notificationState';
import { supabase } from '../lib/supabase';
import { ConfirmModal } from './ui/ConfirmModal';

// ── Reuse the same localStorage keys as NotificationsPage ──────────────────────
const logoImg = "/logo.png";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'doctors', label: 'Doctors', icon: UserCog },
  { id: 'patients', label: 'Patient Records', icon: Users },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

const settingsItems = [
  { id: 'clinic-settings', label: 'Clinic Information', icon: Settings },
  { id: 'patient-accounts', label: 'Patient Accounts', icon: Users },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Dynamic badge counts
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingAppointments, setPendingAppointments] = useState(0);

  // ── Fetch badge counts ──────────────────────────────────────────────────────
  const fetchCounts = async () => {
    const dismissed = getDismissedNotificationIds();
    const readIds = getReadNotificationIds();

    const [msgRes, apptRes] = await Promise.all([
      // Unread patient messages
      supabase
        .from('chat_messages')
        .select('id, read')
        .eq('sender_type', 'patient'),
      // All appointments — we'll compute unread count client-side
      supabase
        .from('appointments')
        .select('id, status')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    const messageRows = msgRes.data || [];
    const appointmentRows = apptRes.data || [];

    setUnreadMessages(messageRows.filter((message) => message.read !== true).length);
    setUnreadNotifications(
      countUnreadAppointmentNotifications(appointmentRows, dismissed, readIds) +
      countUnreadMessageNotifications(messageRows, dismissed, readIds)
    );
    // Pending appointments badge
    setPendingAppointments(appointmentRows.filter((a) => a.status === 'pending').length);
  };

  useEffect(() => {
    fetchCounts();

    // Subscribe to realtime changes for both tables
    const channel = supabase
      .channel('sidebar-badge-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        fetchCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchCounts();
      })
      .subscribe();

    const unsubscribeNotificationSync = subscribeToNotificationStateSync(() => {
      fetchCounts();
    });

    return () => {
      unsubscribeNotificationSync();
      supabase.removeChannel(channel);
    };
  }, []);

  const renderNavButton = (item: { id: string; label: string; icon: React.ElementType }) => {
    const Icon = item.icon;
    const isActive = currentPage === item.id;

    const badge =
      item.id === 'appointments' ? pendingAppointments :
      item.id === 'chat' ? unreadMessages :
      item.id === 'notifications' ? unreadNotifications :
      0;

    return (
      <motion.button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left transition-all duration-200 group relative"
        style={{
          background: isActive ? 'rgba(58, 134, 255, 0.25)' : 'transparent',
          color: isActive ? '#fff' : '#93BCFF',
          border: isActive ? '1px solid rgba(58, 134, 255, 0.4)' : '1px solid transparent',
        }}
      >
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-1/2 w-1 h-6 rounded-r-full"
            style={{ background: '#3A86FF', transform: 'translateY(-50%)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        )}
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: isActive ? 600 : 400 }}>
          {item.label}
        </span>
        {badge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="ml-auto flex items-center justify-center rounded-full text-white"
            style={{
              background: item.id === 'chat' ? '#F59E0B' : '#EF4444',
              fontSize: '0.65rem',
              fontWeight: 700,
              fontFamily: 'var(--font-body)',
              minWidth: 18,
              height: 18,
              paddingLeft: badge > 9 ? 4 : 0,
              paddingRight: badge > 9 ? 4 : 0,
            }}
          >
            {badge > 9 ? '9+' : badge}
          </motion.span>
        )}
      </motion.button>
    );
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'linear-gradient(180deg, #0A2463 0%, #0d2d73 60%, #0c2460 100%)' }}
    >
      <ConfirmModal
        open={showLogoutConfirm}
        title="Sign Out?"
        description="Are you sure you want to sign out of the admin portal?"
        confirmLabel="Sign Out"
        variant="danger"
        onConfirm={() => { setShowLogoutConfirm(false); logout(); }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
            <img src={logoImg} alt="Manalo Medical Clinic Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: '1rem', fontWeight: 600, lineHeight: 1.2 }}>
              Manalo Medical
            </div>
            <div style={{ color: '#93BCFF', fontSize: '0.7rem', fontFamily: 'var(--font-body)', letterSpacing: '0.05em' }}>
              CLINIC PORTAL
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* Main Menu */}
        <div style={{ color: '#93BCFF', fontSize: '0.65rem', letterSpacing: '0.1em', padding: '0 12px', marginBottom: '8px', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
          MAIN MENU
        </div>
        {navItems.map(renderNavButton)}

        {/* Clinic Settings Section */}
        <div style={{ color: '#93BCFF', fontSize: '0.65rem', letterSpacing: '0.1em', padding: '0 12px', marginBottom: '8px', marginTop: '16px', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
          CLINIC SETTINGS
        </div>
        {settingsItems.map(renderNavButton)}
      </nav>

      {/* User Profile */}
      <div className="px-3 pb-4 border-t border-white/10 pt-4">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl mb-2" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3A86FF, #1B4FD8)', fontSize: '0.875rem', fontFamily: 'var(--font-body)' }}>
            {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </div>
            <div style={{ color: '#93BCFF', fontSize: '0.7rem', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {user?.role}
            </div>
          </div>
        </div>
        <motion.button
          onClick={() => setShowLogoutConfirm(true)}
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
          style={{ color: '#FF8B8B' }}
        >
          <LogOut className="w-4 h-4" />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>Sign Out</span>
        </motion.button>
      </div>
    </div>
  );
}
