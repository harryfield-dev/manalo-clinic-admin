import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { FileDown, Calendar, TrendingUp, Users, Activity, Printer, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { fetchAppointments, fetchPatients, Appointment, Patient } from '../data/mockData';
import jsPDF from 'jspdf';

type ReportType = 'daily' | 'weekly' | 'monthly' | 'yearly';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_INDEX = [1, 2, 3, 4, 5, 6];

// All appointment statuses tracked in reports
const ACTIVE_STATUSES = ['pending', 'approved', 'completed', 'rejected'] as const;

const STATUS_META: Record<string, { label: string; r: number; g: number; b: number; bgHex: string; barHex: string; textHex: string }> = {
  pending: { label: 'Pending', r: 245, g: 158, b: 11, bgHex: '#FEF3C7', barHex: '#F59E0B', textHex: '#D97706' },
  approved: { label: 'Approved', r: 16, g: 185, b: 129, bgHex: '#D1FAE5', barHex: '#10B981', textHex: '#059669' },
  completed: { label: 'Completed', r: 27, g: 79, b: 216, bgHex: '#DBEAFE', barHex: '#3B82F6', textHex: '#1D4ED8' },
  rejected: { label: 'Rejected', r: 239, g: 68, b: 68, bgHex: '#FEE2E2', barHex: '#EF4444', textHex: '#DC2626' },
};

function StatCard({ label, value, sub, icon, color, bg }: any) {
  const Icon = icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="rounded-2xl p-5"
      style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.85rem', fontWeight: 600, marginTop: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.78rem', marginTop: 2 }}>{sub}</div>
    </motion.div>
  );
}

function VisitPatternTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.96)',
        border: '1px solid #D8E7FF',
        borderRadius: 18,
        boxShadow: '0 16px 36px rgba(10, 36, 99, 0.12)',
        padding: '12px 14px',
        minWidth: 120,
      }}
    >
      <div style={{ fontFamily: 'var(--font-heading)', color: '#334155', fontSize: '0.86rem', fontWeight: 700, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', color: '#3B82F6', fontSize: '0.82rem', fontWeight: 700, marginBottom: 6 }}>
        Total : {point.total}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', color: '#10B981', fontSize: '0.82rem', fontWeight: 700, marginBottom: 6 }}>
        Completed : {point.completed}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', color: '#F59E0B', fontSize: '0.82rem', fontWeight: 700, marginBottom: 6 }}>
        Pending : {point.pending}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', color: '#059669', fontSize: '0.82rem', fontWeight: 700, marginBottom: 6 }}>
        Approved : {point.approved}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', color: '#EF4444', fontSize: '0.82rem', fontWeight: 700 }}>
        Rejected : {point.rejected}
      </div>
    </div>
  );
}

// ── Pure jsPDF helper ──────────────────────────────────────────────────────
function buildPDF(opts: {
  reportType: string;
  dateFrom: string;
  dateTo: string;
  totalAppointments: number;
  approved: number;
  completed: number;
  pending: number;
  rejected: number;
  newPatients: number;
  avgDaily: string;
  appointments: Appointment[];
  now: Date;
}) {
  const { reportType, dateFrom, dateTo, totalAppointments, approved, completed, pending, rejected, newPatients, avgDaily, appointments, now } = opts;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();   // 595.28
  const margin = 40;
  let y = margin;

  const hex2rgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b] as [number, number, number];
  };

  const setHex = (hex: string) => { const [r, g, b] = hex2rgb(hex); pdf.setTextColor(r, g, b); };
  const fillHex = (hex: string) => { const [r, g, b] = hex2rgb(hex); pdf.setFillColor(r, g, b); };
  const drawHex = (hex: string) => { const [r, g, b] = hex2rgb(hex); pdf.setDrawColor(r, g, b); };

  // ── Header bar ─────────────────────────────────────────────────────────
  fillHex('#0A2463');
  pdf.rect(0, 0, W, 64, 'F');
  fillHex('#1B4FD8');
  pdf.rect(W - 180, 0, 180, 64, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  setHex('#FFFFFF');
  pdf.text('Manalo Medical Clinic', margin, 26);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  setHex('#93C5FD');
  pdf.text('Official Clinic Report  ·  Auto-generated by Admin Portal', margin, 42);

  // Report type badge (top-right)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  setHex('#FFFFFF');
  const badge = `${reportType.toUpperCase()} REPORT`;
  pdf.text(badge, W - margin, 28, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  setHex('#BFDBFE');
  pdf.text(`${dateFrom}  →  ${dateTo}`, W - margin, 42, { align: 'right' });
  pdf.text(`Generated: ${now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`, W - margin, 54, { align: 'right' });

  y = 88;

  // ── Section title helper ────────────────────────────────────────────────
  const sectionTitle = (title: string) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    setHex('#0A2463');
    pdf.text(title, margin, y);
    drawHex('#E8F1FF');
    pdf.setLineWidth(0.5);
    pdf.line(margin, y + 4, W - margin, y + 4);
    y += 18;
  };

  // ── KPI Cards ──────────────────────────────────────────────────────────
  sectionTitle('Summary Statistics');

  const kpis = [
    { label: 'Total Appointments', value: String(totalAppointments), hex: '#1B4FD8', bghex: '#EEF4FF' },
    { label: 'Approved', value: String(approved), hex: '#059669', bghex: '#F0FDF4' },
    { label: 'Completed', value: String(completed), hex: '#1D4ED8', bghex: '#DBEAFE' },
    { label: 'New Patients', value: String(newPatients), hex: '#7C3AED', bghex: '#F5F3FF' },
  ];

  const cardW = (W - margin * 2 - 12 * 3) / 4;
  kpis.forEach((k, i) => {
    const x = margin + i * (cardW + 12);
    fillHex(k.bghex);
    drawHex('#E8F1FF');
    pdf.setLineWidth(0.5);
    pdf.roundedRect(x, y, cardW, 56, 6, 6, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    setHex(k.hex);
    pdf.text(k.value, x + cardW / 2, y + 28, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    setHex('#6B7A99');
    pdf.text(k.label, x + cardW / 2, y + 42, { align: 'center' });
  });
  y += 70;

  // ── Appointment Status Table ────────────────────────────────────────────
  sectionTitle('Appointment Status Breakdown');

  // Table header
  const cols = [margin, margin + 160, margin + 280, margin + 380];
  const rowH = 26;

  fillHex('#F4F7FF');
  drawHex('#E8F1FF');
  pdf.setLineWidth(0.4);
  pdf.roundedRect(margin, y, W - margin * 2, rowH, 3, 3, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  setHex('#6B7A99');
  ['STATUS', 'COUNT', 'PERCENTAGE', 'BAR'].forEach((h, i) => {
    pdf.text(h, cols[i] + 6, y + 17);
  });
  y += rowH;

  ACTIVE_STATUSES.forEach((status, idx) => {
    const meta = STATUS_META[status];
    const count = appointments.filter(a => a.status === status).length;
    const pct = totalAppointments > 0 ? Math.round((count / totalAppointments) * 100) : 0;

    // Row background alternating
    if (idx % 2 === 1) {
      fillHex('#FAFBFF');
      drawHex('#F0F4FF');
      pdf.rect(margin, y, W - margin * 2, rowH, 'F');
    }

    // Bottom border
    drawHex('#E8F1FF');
    pdf.setLineWidth(0.3);
    pdf.line(margin, y + rowH, W - margin * 2 + margin, y + rowH);

    // Status badge pill
    const [br, bg2, bb] = [meta.r, meta.g, meta.b];
    pdf.setFillColor(br, bg2, bb, 0.15);
    fillHex(meta.bgHex);
    pdf.roundedRect(cols[0] + 4, y + 6, 70, 14, 4, 4, 'F');
    setHex(meta.textHex);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(meta.label, cols[0] + 39, y + 16, { align: 'center' });

    // Count
    setHex('#0A2463');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(String(count), cols[1] + 6, y + 17);

    // Percentage
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    setHex('#6B7A99');
    pdf.text(`${pct}%`, cols[2] + 6, y + 17);

    // Bar
    const barMaxW = 110;
    fillHex('#E8F1FF');
    pdf.roundedRect(cols[3] + 6, y + 9, barMaxW, 8, 3, 3, 'F');
    if (pct > 0) {
      fillHex(meta.barHex);
      pdf.roundedRect(cols[3] + 6, y + 9, (barMaxW * pct) / 100, 8, 3, 3, 'F');
    }

    y += rowH;
  });

  y += 20;

  // ── Monthly Summary (text list) ─────────────────────────────────────────
  sectionTitle('Monthly Appointment Trend (Last 6 Months)');

  const sixMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const m = d.getMonth();
    const yr = d.getFullYear();
    const cnt = appointments.filter(a => {
      const ad = new Date(a.date);
      return ad.getMonth() === m && ad.getFullYear() === yr;
    }).length;
    return { label: `${MONTHS[m]} ${yr}`, count: cnt };
  });

  const maxMonthCount = Math.max(...sixMonths.map(s => s.count), 1);
  const barW2 = W - margin * 2 - 120;

  sixMonths.forEach(({ label, count }) => {
    const barFill = (barW2 * count) / maxMonthCount;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    setHex('#0A2463');
    pdf.text(label, margin, y + 10);

    fillHex('#E8F1FF');
    pdf.roundedRect(margin + 80, y + 2, barW2, 12, 3, 3, 'F');
    if (count > 0) {
      fillHex('#1B4FD8');
      pdf.roundedRect(margin + 80, y + 2, barFill, 12, 3, 3, 'F');
    }

    setHex('#6B7A99');
    pdf.setFontSize(8);
    pdf.text(String(count), margin + 80 + barW2 + 8, y + 10);

    y += 20;
  });

  y += 16;

  // ── Footer ─────────────────────────────────────────────────────────────
  fillHex('#F4F7FF');
  pdf.rect(0, pdf.internal.pageSize.getHeight() - 36, W, 36, 'F');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  setHex('#9CA3AF');
  pdf.text(
    `Manalo Medical Clinic  ·  Confidential  ·  ${now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
    W / 2,
    pdf.internal.pageSize.getHeight() - 14,
    { align: 'center' }
  );

  return pdf;
}

export function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('monthly');
  const [exported, setExported] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [apts, pts] = await Promise.all([fetchAppointments(), fetchPatients()]);
      setAppointments(apts);
      setPatients(pts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const today = now.toISOString().split('T')[0];
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    setDateRange({ from: firstOfMonth, to: today });
    loadData();
  }, []);

  // ── KPIs ──────────────────────────────────────────────────────────────
  const totalAppointments = appointments.length;
  const approved = appointments.filter(a => a.status === 'approved').length;
  const completed = appointments.filter(a => a.status === 'completed').length;
  const pending = appointments.filter(a => a.status === 'pending').length;
  const rejected = appointments.filter(a => a.status === 'rejected').length;
  const completionRate = totalAppointments > 0 ? Math.round(((approved + completed) / totalAppointments) * 100) : 0;

  const newPatientsThisMonth = patients.filter(p => {
    const d = new Date(p.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const avgDaily = totalAppointments > 0 ? (totalAppointments / daysInMonth).toFixed(1) : '0';

  // ── Charts data ────────────────────────────────────────────────────────
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const m = d.getMonth(); const y2 = d.getFullYear();
    const count = appointments.filter(a => {
      const ad = new Date(a.date);
      return ad.getMonth() === m && ad.getFullYear() === y2;
    }).length;
    return { month: MONTHS[m], count };
  });

  const weeklyVisits = DAYS_SHORT.map((day, i) => {
    const dayAppointments = appointments.filter(a => new Date(a.date).getDay() === DAYS_INDEX[i]);

    return {
      day,
      pending: dayAppointments.filter(a => a.status === 'pending').length,
      approved: dayAppointments.filter(a => a.status === 'approved').length,
      completed: dayAppointments.filter(a => a.status === 'completed').length,
      rejected: dayAppointments.filter(a => a.status === 'rejected').length,
      total: dayAppointments.length,
    };
  });

  // ── Export PDF (pure jsPDF, no html2canvas) ────────────────────────────
  const exportToPDF = async () => {
    try {
      const pdf = buildPDF({
        reportType, dateFrom: dateRange.from, dateTo: dateRange.to,
        totalAppointments, approved, completed, pending, rejected,
        newPatients: newPatientsThisMonth, avgDaily, appointments, now,
      });
      const fileName = `Manalo-Clinic-Report-${now.toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      setExported(true);
      setTimeout(() => setExported(false), 2000);
      toast.success('PDF exported!', { description: fileName });
    } catch (err: any) {
      toast.error('Export failed: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleExport = async () => {
    if (loading) { toast.error('Data is still loading. Please wait.'); return; }
    await exportToPDF();
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
  {/* Header */}
  <div className="flex justify-end">
    <motion.button
      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-white"
      style={{ background: loading ? '#6B7A99' : 'linear-gradient(135deg, #1B4FD8, #3A86FF)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
    >
      {exported ? <CheckCircle className="w-4 h-4" /> : <FileDown className="w-4 h-4" />}
      <span className="hidden sm:inline">Export PDF</span>
    </motion.button>
  </div>
      {/* Report Config */}
      <div className="rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center"
        style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}>
        <div>
          <label style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Report Type</label>
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly', 'yearly'] as ReportType[]).map(t => (
              <button key={t} onClick={() => setReportType(t)} className="px-4 py-2 rounded-xl capitalize"
                style={{
                  fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: reportType === t ? 600 : 400,
                  background: reportType === t ? '#0A2463' : '#F4F7FF', color: reportType === t ? '#fff' : '#6B7A99',
                  border: `1px solid ${reportType === t ? 'transparent' : '#E8F1FF'}`
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:ml-auto">
          {[{ label: 'From', key: 'from' }, { label: 'To', key: 'to' }].map(f => (
            <div key={f.key}>
              <label style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>{f.label}</label>
              <input type="date" value={(dateRange as any)[f.key]} onChange={e => setDateRange(p => ({ ...p, [f.key]: e.target.value }))}
                className="px-3 py-2 rounded-xl outline-none" style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', border: '1px solid #E8F1FF', background: '#F4F7FF', color: '#0A2463' }} />
            </div>
          ))}
        </div>
      </div>


      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3A86FF' }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Appointments" value={totalAppointments} sub="All time" icon={Calendar} color="#1B4FD8" bg="#E8F1FF" />
          <StatCard label="Approved" value={approved} sub={`${completionRate}% done`} icon={Activity} color="#059669" bg="#D1FAE5" />
          <StatCard label="Completed" value={completed} sub="Fully completed" icon={CheckCircle} color="#1D4ED8" bg="#DBEAFE" />
          <StatCard label="New Patients" value={newPatientsThisMonth} sub="Registered this month" icon={Users} color="#7C3AED" bg="#EDE9FE" />
          <StatCard label="Avg Daily Visits" value={avgDaily} sub="This month" icon={TrendingUp} color="#D97706" bg="#FEF3C7" />
        </div>
      )}

      {/* Monthly Overview Chart */}
      <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>Monthly Appointment Overview</h3>
        <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem', marginBottom: 20 }}>Last 6 months — all appointments</p>
        {loading ? (
          <div className="flex items-center justify-center h-52"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3A86FF' }} /></div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8F1FF" />
              <XAxis dataKey="month" tick={{ fontFamily: 'var(--font-body)', fontSize: 12, fill: '#6B7A99' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'var(--font-body)', fontSize: 12, fill: '#6B7A99' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontFamily: 'var(--font-body)', borderRadius: 12, border: '1px solid #E8F1FF' }} />
              <Bar dataKey="count" name="Appointments" fill="#1B4FD8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Visit Pattern */}
        <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>Daily Visit Pattern</h3>
          <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem', marginBottom: 20 }}>Appointments by day of week</p>
          {loading ? (
            <div className="flex items-center justify-center h-44"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3A86FF' }} /></div>
          ) : (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FBFF 100%)',
                border: '1px solid #EEF4FF',
              }}
            >
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={weeklyVisits} margin={{ top: 18, right: 10, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="visitPatternFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.24} />
                      <stop offset="70%" stopColor="#14B8A6" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#14B8A6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#DCEBFF" strokeDasharray="3 3" vertical />
                  <XAxis
                    dataKey="day"
                    tick={{ fontFamily: 'var(--font-body)', fontSize: 12, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontFamily: 'var(--font-body)', fontSize: 12, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip cursor={{ stroke: '#C7D2FE', strokeDasharray: '4 4' }} content={<VisitPatternTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#14B8A6"
                    strokeWidth={2.5}
                    fill="url(#visitPatternFill)"
                    dot={{ r: 0 }}
                    activeDot={{ r: 4, fill: '#F59E0B', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Status Distribution — only pending, approved, rejected */}
        <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>Status Distribution</h3>
          <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem', marginBottom: 20 }}>Appointments by status</p>
          {loading ? (
            <div className="flex items-center justify-center h-44"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3A86FF' }} /></div>
          ) : (
            <div className="space-y-4 mt-2">
              {ACTIVE_STATUSES.map(status => {
                const meta = STATUS_META[status];
                const count = appointments.filter(a => a.status === status).length;
                const pct = totalAppointments > 0 ? Math.round((count / totalAppointments) * 100) : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: meta.barHex }} />
                        <span style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.82rem', fontWeight: 600 }}>{meta.label}</span>
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', color: meta.textHex, fontSize: '0.82rem', fontWeight: 700 }}>{count} ({pct}%)</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: meta.bgHex }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.2 }}
                        className="h-full rounded-full" style={{ background: meta.barHex }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Report Summary Preview */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E8F1FF' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 600 }}>Report Summary</h3>
            <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem' }}>Preview of exported PDF content</p>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border"
            style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#0A2463', borderColor: '#E8F1FF' }}>
            <Printer className="w-4 h-4" style={{ color: '#6B7A99' }} /> Print
          </motion.button>
        </div>
        <div className="p-8">
          {/* Letterhead */}
          <div className="flex items-center justify-between pb-6 border-b mb-6" style={{ borderColor: '#E8F1FF' }}>
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Manalo Medical Clinic logo"
                className="w-12 h-12 rounded-xl object-contain"
              />
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1.1rem', fontWeight: 700 }}>Manalo Medical Clinic</div>
                <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem' }}>Official Report · Clinic Letterhead</div>
              </div>
            </div>
            <div className="text-right">
              <div style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem', fontWeight: 600, textTransform: 'capitalize' }}>{reportType} Report</div>
              <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem' }}>{dateRange.from} → {dateRange.to}</div>
              <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem' }}>Generated: {now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </div>
          </div>

          {/* Summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Total Appointments', value: loading ? '—' : String(totalAppointments), color: '#1B4FD8', bg: '#EEF4FF' },
              { label: 'Approved', value: loading ? '—' : String(approved), color: '#059669', bg: '#F0FDF4' },
              { label: 'Completed', value: loading ? '—' : String(completed), color: '#1D4ED8', bg: '#DBEAFE' },
              { label: 'New Patients', value: loading ? '—' : String(newPatientsThisMonth), color: '#7C3AED', bg: '#F5F3FF' },
              { label: 'Avg Daily', value: loading ? '—' : avgDaily, color: '#D97706', bg: '#FFFBEB' },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-4" style={{ background: item.bg }}>
                <div style={{ fontFamily: 'var(--font-heading)', color: item.color, fontSize: '1.4rem', fontWeight: 700 }}>{item.value}</div>
                <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.78rem', marginTop: 4 }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Status breakdown table — only pending, approved, rejected */}
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#E8F1FF' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F4F7FF' }}>
                  {['Status', 'Count', 'Percentage'].map(h => (
                    <th key={h} className="px-4 py-3 text-left" style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACTIVE_STATUSES.map((status, i) => {
                  const meta = STATUS_META[status];
                  const count = appointments.filter(a => a.status === status).length;
                  const pct = totalAppointments > 0 ? Math.round((count / totalAppointments) * 100) : 0;
                  return (
                    <tr key={status} style={{ borderTop: '1px solid #F4F7FF', background: i % 2 === 0 ? '#fff' : '#FAFBFF' }}>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: meta.bgHex, color: meta.textHex, fontFamily: 'var(--font-body)' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.barHex }} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontWeight: 600 }}>{loading ? '—' : count}</td>
                      <td className="px-4 py-3" style={{ fontFamily: 'var(--font-body)', color: '#6B7A99' }}>{loading ? '—' : `${pct}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 pt-4 border-t text-center" style={{ borderColor: '#E8F1FF' }}>
            <p style={{ fontFamily: 'var(--font-body)', color: '#9CA3AF', fontSize: '0.72rem' }}>
              This report is auto-generated by the Manalo Clinic Admin Portal · {now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
