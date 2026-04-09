import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MapPin, Clock, Save, ExternalLink, CheckCircle, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

const defaultSchedule = [
  { day: 'Monday', col: 'monday', open: true, from: '07:00', to: '15:00' },
  { day: 'Tuesday', col: 'tuesday', open: true, from: '07:00', to: '15:00' },
  { day: 'Wednesday', col: 'wednesday', open: true, from: '07:00', to: '15:00' },
  { day: 'Thursday', col: 'thursday', open: true, from: '07:00', to: '15:00' },
  { day: 'Friday', col: 'friday', open: true, from: '07:00', to: '15:00' },
  { day: 'Saturday', col: 'saturday', open: true, from: '07:00', to: '15:00' },
  { day: 'Sunday', col: 'sunday', open: false, from: '', to: '' },
];

function formatTime(val: string) {
  if (!val) return '';
  const [h, m] = val.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function parseTimeRange(str: string) {
  if (!str || str === 'Closed') return { open: false, from: '', to: '' };
  const parts = str.split('–').map(s => s.trim());
  if (parts.length < 2) return { open: true, from: '07:00', to: '15:00' };
  const toTime24 = (t: string) => {
    const [time, period] = t.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  return { open: true, from: toTime24(parts[0]), to: toTime24(parts[1]) };
}

export function ClinicSettingsPage() {
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // ── Fetch from Supabase on mount ──
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('clinic_settings')
        .select('*')
        .limit(1)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      setSettingsId(data.id);
      setAddress(data.address || '');
      setPhone(data.phone || '');
      setMapsLink(data.maps_link || '');

      setSchedule(defaultSchedule.map(s => {
        const val = data[s.col];
        const parsed = parseTimeRange(val);
        return { ...s, ...parsed };
      }));

      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleScheduleChange = (index: number, field: string, value: string | boolean) => {
    setSchedule(prev =>
      prev.map((s, i) => i === index ? { ...s, [field]: value } : s)
    );
  };

  // ── Save to Supabase ──
  const handleSave = async () => {
    setSaving(true);

    const scheduleData: Record<string, string> = {};
    schedule.forEach(s => {
      scheduleData[s.col] = s.open
        ? `${formatTime(s.from)} – ${formatTime(s.to)}`
        : 'Closed';
    });

    const payload = {
      address,
      phone,
      maps_link: mapsLink,
      updated_at: new Date().toISOString(),
      ...scheduleData,
    };

    let error;
    if (settingsId) {
      ({ error } = await supabase
        .from('clinic_settings')
        .update(payload)
        .eq('id', settingsId));
    } else {
      ({ error } = await supabase
        .from('clinic_settings')
        .insert(payload));
    }

    setSaving(false);

    if (error) {
      toast.error('Failed to save. Please try again.');
      return;
    }

    setSaved(true);
    toast.success('Clinic information saved successfully! Patient website updated.');
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1B4FD8' }} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <motion.button
          whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(27, 79, 216, 0.3)' }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white ml-auto"
          style={{
            background: saved ? 'linear-gradient(135deg, #059669, #10B981)' : 'linear-gradient(135deg, #1B4FD8, #3A86FF)',
            fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600,
            transition: 'background 0.4s ease',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </motion.button>
      </div>

      {/* Clinic Location */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl p-6 space-y-5"
        style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}
      >
        <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: '#E8F1FF' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#E8F1FF' }}>
            <MapPin className="w-5 h-5" style={{ color: '#1B4FD8' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 600 }}>Location & Address</div>
            <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.78rem' }}>Clinic address and Google Maps link</div>
          </div>
        </div>

        {/* Address */}
        <div>
          <label style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
            Clinic Address
          </label>
          <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
            className="w-full px-4 py-3 rounded-xl outline-none resize-none transition-all"
            style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#0A2463', border: '1px solid #E8F1FF', background: '#F4F7FF' }}
            onFocus={e => (e.target.style.borderColor = '#3A86FF')}
            onBlur={e => (e.target.style.borderColor = '#E8F1FF')}
          />
        </div>

        {/* Phone */}
        <div>
          <label style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
            Phone Number
          </label>
          <input type="text" value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full px-4 py-3 rounded-xl outline-none transition-all"
            style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#0A2463', border: '1px solid #E8F1FF', background: '#F4F7FF' }}
            onFocus={e => (e.target.style.borderColor = '#3A86FF')}
            onBlur={e => (e.target.style.borderColor = '#E8F1FF')}
          />
        </div>

        {/* Google Maps Link */}
        <div>
          <label style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
            Google Maps Link
          </label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border" style={{ background: '#F4F7FF', borderColor: '#E8F1FF' }}>
              <Globe className="w-4 h-4 flex-shrink-0" style={{ color: '#6B7A99' }} />
              <input type="url" value={mapsLink} onChange={e => setMapsLink(e.target.value)}
                className="flex-1 bg-transparent outline-none"
                style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#0A2463' }}
              />
            </div>
            <motion.a href={mapsLink} target="_blank" rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border"
              style={{ background: '#E8F1FF', borderColor: '#E8F1FF', color: '#1B4FD8', fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none' }}>
              <ExternalLink className="w-4 h-4" /> View Map
            </motion.a>
          </div>
        </div>
      </motion.div>

      {/* Operating Hours */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl p-6"
        style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}
      >
        <div className="flex items-center gap-3 pb-4 border-b mb-5" style={{ borderColor: '#E8F1FF' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#E8F1FF' }}>
            <Clock className="w-5 h-5" style={{ color: '#1B4FD8' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 600 }}>Operating Hours</div>
            <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.78rem' }}>Set opening and closing times for each day</div>
          </div>
        </div>

        <div className="space-y-3">
          {schedule.map((s, i) => (
            <motion.div key={s.day}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.04 }}
              className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl"
              style={{ background: s.open ? '#F4F7FF' : '#FAFAFA', border: `1px solid ${s.open ? '#E8F1FF' : '#F0F0F0'}` }}>
              <button onClick={() => handleScheduleChange(i, 'open', !s.open)}
                className="relative flex-shrink-0 w-10 h-6 rounded-full transition-all duration-300"
                style={{ background: s.open ? '#1B4FD8' : '#D1D5DB' }}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300"
                  style={{ left: s.open ? '18px' : '2px' }} />
              </button>
              <div className="w-24 flex-shrink-0"
                style={{ fontFamily: 'var(--font-body)', color: s.open ? '#0A2463' : '#9CA3AF', fontSize: '0.875rem', fontWeight: s.open ? 600 : 400 }}>
                {s.day}
              </div>
              {s.open ? (
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                  <input type="time" value={s.from} onChange={e => handleScheduleChange(i, 'from', e.target.value)}
                    className="px-3 py-1.5 rounded-lg outline-none border transition-all"
                    style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0A2463', borderColor: '#E8F1FF', background: '#fff' }}
                    onFocus={e => (e.target.style.borderColor = '#3A86FF')}
                    onBlur={e => (e.target.style.borderColor = '#E8F1FF')}
                  />
                  <span style={{ color: '#6B7A99', fontFamily: 'var(--font-body)', fontSize: '0.8rem' }}>to</span>
                  <input type="time" value={s.to} onChange={e => handleScheduleChange(i, 'to', e.target.value)}
                    className="px-3 py-1.5 rounded-lg outline-none border transition-all"
                    style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0A2463', borderColor: '#E8F1FF', background: '#fff' }}
                    onFocus={e => (e.target.style.borderColor = '#3A86FF')}
                    onBlur={e => (e.target.style.borderColor = '#E8F1FF')}
                  />
                  <span className="hidden sm:inline" style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.78rem' }}>
                    ({formatTime(s.from)} – {formatTime(s.to)})
                  </span>
                </div>
              ) : (
                <div className="flex-1">
                  <span className="px-3 py-1.5 rounded-lg inline-block"
                    style={{ background: '#F3F4F6', color: '#9CA3AF', fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600 }}>
                    Closed
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Preview */}
        <div className="mt-6 pt-5 border-t" style={{ borderColor: '#E8F1FF' }}>
          <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Preview (as seen by patients)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {schedule.map(s => (
              <div key={s.day} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#F4F7FF' }}>
                <span style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.82rem', fontWeight: 600 }}>{s.day}</span>
                <span style={{ fontFamily: 'var(--font-body)', color: s.open ? '#059669' : '#DC2626', fontSize: '0.82rem', fontWeight: 500 }}>
                  {s.open ? `${formatTime(s.from)} – ${formatTime(s.to)}` : 'Closed'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}