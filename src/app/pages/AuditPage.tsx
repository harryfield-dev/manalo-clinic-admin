import { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Search, Clock, FileText, CheckCircle, XCircle, Eye, Download } from 'lucide-react';
import { auditLogs } from '../data/mockData';
import { toast } from 'sonner';

const actionColors: Record<string, { bg: string; color: string }> = {
  'Appointment Approved': { bg: '#D1FAE5', color: '#059669' },
  'Appointment Rejected': { bg: '#FEE2E2', color: '#DC2626' },
  'Patient Record Viewed': { bg: '#E8F1FF', color: '#1B4FD8' },
  'Report Generated': { bg: '#EDE9FE', color: '#7C3AED' },
  'Doctor Profile Updated': { bg: '#FEF3C7', color: '#D97706' },
};

export function AuditPage() {
  const [search, setSearch] = useState('');

  const filtered = auditLogs.filter(l =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.user.toLowerCase().includes(search.toLowerCase()) ||
    l.target.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1.3rem', fontWeight: 700 }}>Audit Trail</h2>
          <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.85rem' }}>Comprehensive log of all administrative actions</p>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
          onClick={() => toast.success('Audit log exported to CSV.')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border"
          style={{ background: '#fff', borderColor: '#E8F1FF', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#0A2463' }}>
          <Download className="w-4 h-4" style={{ color: '#6B7A99' }} /> Export Log
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Actions', value: auditLogs.length, icon: FileText, color: '#1B4FD8', bg: '#E8F1FF' },
          { label: 'Approvals', value: auditLogs.filter(l => l.action.includes('Approved')).length, icon: CheckCircle, color: '#059669', bg: '#D1FAE5' },
          { label: 'Rejections', value: auditLogs.filter(l => l.action.includes('Rejected')).length, icon: XCircle, color: '#DC2626', bg: '#FEE2E2' },
          { label: 'Record Views', value: auditLogs.filter(l => l.action.includes('Viewed')).length, icon: Eye, color: '#7C3AED', bg: '#EDE9FE' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} whileHover={{ y: -2 }}
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: stat.bg }}>
                <Icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem' }}>{stat.label}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border" style={{ background: '#fff', borderColor: '#E8F1FF' }}>
        <Search className="w-4 h-4 flex-shrink-0" style={{ color: '#6B7A99' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actions, users, targets..."
          className="bg-transparent outline-none flex-1" style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#0A2463' }} />
      </div>

      {/* Log Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F4F7FF', borderBottom: '1px solid #E8F1FF' }}>
                {['Action', 'Performed By', 'Target', 'Timestamp', 'IP Address'].map(h => (
                  <th key={h} className="text-left px-5 py-4" style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => {
                const ac = actionColors[log.action] || { bg: '#F3F4F6', color: '#6B7280' };
                return (
                  <motion.tr key={log.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="border-b transition-colors" style={{ borderColor: '#F4F7FF' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F9FBFF'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: ac.bg, color: ac.color }}>
                        <Shield className="w-3 h-3" />
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600 }}>{log.action}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                          style={{ background: 'linear-gradient(135deg, #1B4FD8, #3A86FF)', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                          {log.user.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem', fontWeight: 500 }}>{log.user}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem' }}>{log.target}</span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" style={{ color: '#6B7A99' }} />
                        <span style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.8rem' }}>
                          {new Date(log.timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem' }}>
                          {new Date(log.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <code style={{ fontFamily: 'monospace', color: '#1B4FD8', fontSize: '0.8rem', background: '#E8F1FF', padding: '2px 8px', borderRadius: 6 }}>
                        {log.ip}
                      </code>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t flex items-center gap-2" style={{ borderColor: '#F4F7FF' }}>
          <Shield className="w-3.5 h-3.5" style={{ color: '#6B7A99' }} />
          <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.78rem' }}>
            Audit trail is tamper-proof. All actions are logged with timestamps and IP addresses.
          </span>
        </div>
      </div>
    </div>
  );
}
