import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, CheckCircle, XCircle, Users, Calendar,
  ChevronRight, Check, X,
  ArrowUpRight, Activity, Loader2, BadgeCheck
} from 'lucide-react';
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppointments } from '../hooks/useAppointments';
import type { Appointment } from '../data/mockData';
import { fetchChatConversations } from '../lib/chat';
import type { ChatConversationSummary } from '../lib/chat';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

type TimePeriod = 'today' | 'week' | 'month' | 'year';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ACTIVE_APPOINTMENT_STATUSES: Appointment['status'][] = ['pending', 'approved', 'completed', 'cancelled', 'rejected'];

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStartOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function getEndOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date: Date, amount: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
}

function getWeekStart(date = new Date()) {
  const start = getStartOfDay(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
}

function isWithinRange(value: string, start: Date, end: Date) {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed >= start && parsed <= end;
}

function getPeriodRange(period: TimePeriod, now: Date) {
  const start = getStartOfDay(now);
  const end = getEndOfDay(now);

  if (period === 'today') {
    return { start, end };
  }

  if (period === 'week') {
    return { start: getWeekStart(now), end };
  }

  if (period === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    return { start: monthStart, end };
  }

  const yearStart = new Date(now.getFullYear(), 0, 1);
  yearStart.setHours(0, 0, 0, 0);
  return { start: yearStart, end };
}

function timeToMinutes(value: string) {
  const trimmed = value.trim();
  const meridiemMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (meridiemMatch) {
    let hours = Number(meridiemMatch[1]);
    const minutes = Number(meridiemMatch[2]);
    const period = meridiemMatch[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  const [hours = '0', minutes = '0'] = trimmed.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function getGreeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}


function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 600;
    const steps = 20;
    const step = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += step;
      if (current >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display}</span>;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl animate-pulse" style={{ background: '#F4F7FF' }}>
      <div className="w-8 h-8 rounded-full" style={{ background: '#E8F1FF' }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded w-32" style={{ background: '#E8F1FF' }} />
        <div className="h-2 rounded w-24" style={{ background: '#E8F1FF' }} />
      </div>
      <div className="h-6 w-16 rounded-full" style={{ background: '#E8F1FF' }} />
    </div>
  );
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: '#FEF3C7', text: '#D97706', label: 'Pending' },
  approved: { bg: '#D1FAE5', text: '#059669', label: 'Approved' },
  rejected: { bg: '#FEE2E2', text: '#DC2626', label: 'Rejected' },
  completed: { bg: '#DBEAFE', text: '#1D4ED8', label: 'Completed' },
  cancelled: { bg: '#F3F4F6', text: '#6B7280', label: 'Cancelled' },
};

export function DashboardPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<TimePeriod>('today');
  const { data: appointmentsData, loading: aptsLoading, approveAppointment, rejectAppointment } = useAppointments();
  const [patientCount, setPatientCount] = useState(0);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [inboxConvs, setInboxConvs] = useState<ChatConversationSummary[]>([]);

  const now = new Date();
  const today = getLocalDateString(now);
  const greeting = getGreeting(now);
  const displayName = user?.name?.split(' ')[0] || 'there';

  useEffect(() => {
    const loadDashboardData = async () => {
      setPatientsLoading(true);

      const [patientCountRes, chatRows] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        fetchChatConversations(),
      ]);

      if (patientCountRes.error) {
        console.error('Failed to load patient count:', patientCountRes.error);
        setPatientCount(0);
      } else {
        setPatientCount(patientCountRes.count ?? 0);
      }

      setPatientsLoading(false);
      setInboxConvs(chatRows);
    };

    loadDashboardData();

    const channel = supabase
      .channel('dashboard-live-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, async () => {
        setInboxConvs(await fetchChatConversations());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, async () => {
        const { count, error } = await supabase.from('patients').select('id', { count: 'exact', head: true }).is('deleted_at', null);
        if (!error) {
          setPatientCount(count ?? 0);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loading = aptsLoading || patientsLoading;
  const appointments = appointmentsData || [];

  // ── KPI calculations ── ALL-TIME totals from ALL appointments ──────────
  const countByStatus = (list: Appointment[], status: string) =>
    list.filter(a => a.status === status).length;

  // KPI cards always show ALL-TIME counts (not period-filtered)
  const kpi = {
    pending:   countByStatus(appointments, 'pending'),
    approved:  countByStatus(appointments, 'approved'),
    rejected:  countByStatus(appointments, 'rejected'),
    completed: countByStatus(appointments, 'completed'),
    total:     appointments.length,
  };

  // "+X today" badge — count appointments whose date is today
  const todayApts = appointments.filter(a => a.date === today);
  const kpiTodayCounts = {
    pending:   countByStatus(todayApts, 'pending'),
    approved:  countByStatus(todayApts, 'approved'),
    rejected:  countByStatus(todayApts, 'rejected'),
    completed: countByStatus(todayApts, 'completed'),
  };

  // Banner pending count
  const pendingAttentionCount = kpi.pending;

  // ── Today's Queue ──────────────────────────────────────────────────────
  const todaysQueue = appointments
    .filter((appointment) => appointment.date === today && ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status))
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  // ── Chart data — adapts to selected period ─────────────────────────────
  const weekStart = getWeekStart(now);

  // Build chart series based on period
  const chartData = (() => {
    if (period === 'today') {
      // Hourly buckets for today: 8 AM – 6 PM
      const hours = [8,9,10,11,12,13,14,15,16,17,18];
      return hours.map(h => {
        const label = h <= 12 ? `${h}AM` : `${h - 12}PM`;
        const dayApts = appointments.filter(apt => {
          if (apt.date !== today) return false;
          const mins = timeToMinutes(apt.time);
          return mins >= h * 60 && mins < (h + 1) * 60;
        });
        return {
          day: label,
          appointments: dayApts.length,
          completed: dayApts.filter(a => a.status === 'completed').length,
          pending: dayApts.filter(a => a.status === 'pending').length,
        };
      });
    }
    if (period === 'week') {
      return WEEK_DAYS.map((day, index) => {
        const dayDate = addDays(weekStart, index);
        const dateKey = getLocalDateString(dayDate);
        const dayApts = appointments.filter(
          apt => apt.date === dateKey && ACTIVE_APPOINTMENT_STATUSES.includes(apt.status)
        );
        return {
          day,
          date: dateKey,
          appointments: dayApts.length,
          completed: dayApts.filter(a => a.status === 'completed').length,
          pending: dayApts.filter(a => a.status === 'pending').length,
        };
      });
    }
    if (period === 'month') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dayApts = appointments.filter(apt => apt.date === dateKey && ACTIVE_APPOINTMENT_STATUSES.includes(apt.status));
        return {
          day: String(d),
          date: dateKey,
          appointments: dayApts.length,
          completed: dayApts.filter(a => a.status === 'completed').length,
          pending: dayApts.filter(a => a.status === 'pending').length,
        };
      });
    }
    // year — monthly buckets
    return MONTH_SHORT.map((mon, idx) => {
      const monthKey = `${now.getFullYear()}-${String(idx + 1).padStart(2,'0')}`;
      const dayApts = appointments.filter(
        apt => apt.date.startsWith(monthKey) && ACTIVE_APPOINTMENT_STATUSES.includes(apt.status)
      );
      return {
        day: mon,
        appointments: dayApts.length,
        completed: dayApts.filter(a => a.status === 'completed').length,
        pending: dayApts.filter(a => a.status === 'pending').length,
      };
    });
  })();

  const chartMeta = {
    today: { title: "Today's Appointment Breakdown", sub: `Hourly view — ${now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}` },
    week:  { title: 'Weekly Appointment Trends',    sub: 'Scheduled appointments this week' },
    month: { title: 'Monthly Appointment Trends',   sub: `Daily appointments — ${now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}` },
    year:  { title: 'Yearly Appointment Trends',    sub: `Monthly overview — ${now.getFullYear()}` },
  };

  // Keep weeklyData alias for todaysQueue (still week-based)
  const weeklyData = chartData;


  const elapsedDaysInMonth = now.getDate();
  const monthVisits = appointments.filter((appointment) => {
    const appointmentDate = new Date(`${appointment.date}T00:00:00`);
    return (
      appointmentDate.getMonth() === now.getMonth() &&
      appointmentDate.getFullYear() === now.getFullYear() &&
      appointment.date <= today &&
      ['approved', 'completed'].includes(appointment.status)
    );
  });
  const avgDaily = monthVisits.length > 0 ? Math.round(monthVisits.length / elapsedDaysInMonth) : 0;

  const handleApprove = async (id: string) => {
    try { await approveAppointment(id); toast.success('Appointment approved!'); } catch {}
  };
  const handleReject = async (id: string) => {
    try { await rejectAppointment(id); toast.error('Appointment rejected.'); } catch {}
  };

  const kpiCards = [
    { label: 'Pending',   value: kpi.pending,   icon: Clock,        color: '#D97706', bg: '#FEF3C7', todayCount: kpiTodayCounts.pending   },
    { label: 'Approved',  value: kpi.approved,  icon: CheckCircle,  color: '#059669', bg: '#D1FAE5', todayCount: kpiTodayCounts.approved  },
    { label: 'Rejected',  value: kpi.rejected,  icon: XCircle,      color: '#DC2626', bg: '#FEE2E2', todayCount: kpiTodayCounts.rejected  },
    { label: 'Completed', value: kpi.completed, icon: BadgeCheck,   color: '#1B4FD8', bg: '#E8F1FF', todayCount: kpiTodayCounts.completed },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 overflow-x-hidden">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 flex items-center justify-between overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #0A2463 0%, #1B4FD8 60%, #3A86FF 100%)' }}
      >
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-10">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="absolute rounded-full" style={{ width: `${180 + i * 60}px`, height: `${180 + i * 60}px`, border: '1px solid #fff', top: '-20%', right: `${-20 + i * 30}%`, borderRadius: '50%' }} />
          ))}
        </div>
        <div className="relative z-10">
          <p style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', marginBottom: 4 }}>
            {now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <h2 style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: '1.6rem', fontWeight: 700, marginBottom: 8 }}>
            {greeting}, {displayName}! 👋
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
            You have <strong>{pendingAttentionCount} pending</strong> appointments requiring your attention right now.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-4 relative z-10">
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={() => onNavigate('appointments')}
            className="px-5 py-2.5 rounded-xl text-white"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600 }}
          >
            View Appointments
          </motion.button>
        </div>
      </motion.div>

      {/* Period Toggle + KPI Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1.1rem', fontWeight: 600 }}>
            Key Performance Indicators
          </h3>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#E8F1FF' }}>
            {(['today', 'week', 'month', 'year'] as TimePeriod[]).map(p => (
              <motion.button
                key={p}
                onClick={() => setPeriod(p)}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-1.5 rounded-lg capitalize transition-all"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8rem',
                  fontWeight: period === p ? 600 : 400,
                  background: period === p ? '#fff' : 'transparent',
                  color: period === p ? '#1B4FD8' : '#6B7A99',
                  boxShadow: period === p ? '0 2px 8px rgba(27, 79, 216, 0.1)' : 'none',
                }}
              >
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'This Year'}
              </motion.button>
            ))}
          </div>
        </div>

        {aptsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl p-5 animate-pulse" style={{ background: '#F4F7FF', border: '1px solid #E8F1FF', height: 130 }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {kpiCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(10, 36, 99, 0.12)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onNavigate('appointments')}
                  className="rounded-2xl p-5 cursor-pointer relative overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)', transition: 'all 0.3s ease' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                      <Icon className="w-5 h-5" style={{ color: card.color }} />
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: card.bg }}>
                      <ArrowUpRight className="w-3 h-3" style={{ color: card.color }} />
                      <span style={{ color: card.color, fontSize: '0.68rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>+{card.todayCount} today</span>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
                    <AnimatedCounter value={card.value} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.78rem', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    {card.label}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="space-y-6">
        {/* Weekly Chart — full width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-6"
          style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 600 }}>
                {chartMeta[period].title}
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem' }}>{chartMeta[period].sub}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: '#3A86FF' }} /><span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#6B7A99' }}>Total</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} /><span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#6B7A99' }}>Completed</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }} /><span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#6B7A99' }}>Pending</span></div>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3A86FF' }} /></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="dashGradBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3A86FF" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#3A86FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashGradGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashGradAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8F1FF" />
                <XAxis dataKey="day" tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: '#6B7A99' }} axisLine={false} tickLine={false} interval={period === 'month' ? 4 : 0} />
                <YAxis allowDecimals={false} tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: '#6B7A99' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontFamily: 'var(--font-body)', borderRadius: 12, border: '1px solid #E8F1FF', fontSize: '0.8rem' }} />
                <Area type="monotone" dataKey="appointments" name="Total" stroke="#3A86FF" strokeWidth={2.5} fill="url(#dashGradBlue)" />
                <Area type="monotone" dataKey="completed" name="Completed" stroke="#10B981" strokeWidth={2} fill="url(#dashGradGreen)" />
                <Area type="monotone" dataKey="pending" name="Pending" stroke="#F59E0B" strokeWidth={2} fill="url(#dashGradAmber)" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Bottom Row: Patient Queue + Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Queue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E8F1FF' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 600 }}>
                Today's Patient Queue
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.78rem' }}>
                {todaysQueue.length} patients scheduled for {new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => onNavigate('appointments')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
              style={{ background: '#E8F1FF', color: '#1B4FD8', fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 600 }}
            >
              View All <ChevronRight className="w-3 h-3" />
            </motion.button>
          </div>
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            <AnimatePresence>
              {aptsLoading ? (
                [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
              ) : todaysQueue.length === 0 ? (
                <div className="text-center py-8" style={{ color: '#6B7A99', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                  No appointments scheduled for today.
                </div>
              ) : (
                todaysQueue.map((apt, i) => {
                  const s = statusColors[apt.status];
                  return (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl group transition-all"
                      style={{ border: '1px solid transparent' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F4F7FF'; (e.currentTarget as HTMLElement).style.borderColor = '#E8F1FF'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #1B4FD8, #3A86FF)', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                        {apt.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {apt.patientName}
                        </div>
                        <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem' }}>
                          {apt.time} · {apt.type} · {apt.doctorName.split(' ').slice(-1)[0]}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.text, fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {s.label}
                        </span>
                        {apt.status === 'pending' && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleApprove(apt.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#D1FAE5' }}>
                              <Check className="w-3.5 h-3.5" style={{ color: '#059669' }} />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleReject(apt.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#FEE2E2' }}>
                              <X className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Live Inbox */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E8F1FF' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 600 }}>
                Live Inbox
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.78rem' }}>
                Patient messages & AI escalations
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => onNavigate('chat')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
              style={{ background: '#E8F1FF', color: '#1B4FD8', fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 600 }}
            >
              Open Chat <ChevronRight className="w-3 h-3" />
            </motion.button>
          </div>
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {inboxConvs.length === 0 ? (
              <div className="text-center py-8" style={{ color: '#6B7A99', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                No patient messages yet.
              </div>
            ) : (
              inboxConvs.map((conv, i) => (
                <motion.div
                  key={conv.patientEmail}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  onClick={() => onNavigate('chat')}
                  className="flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all"
                  style={{ border: '1px solid transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F4F7FF'; (e.currentTarget as HTMLElement).style.borderColor = '#E8F1FF'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white"
                      style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                      {(conv.patientName || conv.patientEmail).slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                        {conv.patientName || conv.patientEmail}
                      </span>
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.lastMessage}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.7rem' }}>
                      {new Date(conv.lastMessageTime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ background: '#3A86FF', fontSize: '0.65rem', fontWeight: 700 }}>
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Patients', value: patientsLoading ? '—' : patientCount.toString(), sub: 'From patient records', icon: Users, color: '#059669', bg: '#D1FAE5' },
          { label: 'Total Appointments', value: aptsLoading ? '—' : appointments.length.toString(), sub: 'All time', icon: Calendar, color: '#1B4FD8', bg: '#E8F1FF' },
          { label: 'Avg. Daily Visits', value: aptsLoading ? '—' : avgDaily.toString(), sub: 'This month', icon: Activity, color: '#D97706', bg: '#FEF3C7' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.1 }}
              whileHover={{ y: -2 }}
              className="flex items-center gap-4 rounded-2xl p-5"
              style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: stat.bg }}>
                <Icon className="w-6 h-6" style={{ color: stat.color }} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.85rem', fontWeight: 600, marginTop: 2 }}>{stat.label}</div>
                <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem' }}>{stat.sub}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
