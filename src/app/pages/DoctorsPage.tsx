import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Edit, X, Phone, Mail, CheckCircle, AlertCircle, Coffee, Loader2, Trash2, RotateCcw } from 'lucide-react';
import { Doctor, DoctorStatus } from '../data/mockData';
import { useDoctors } from '../hooks/useDoctors';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import {
  formatPhilippineMobileForDisplay,
  formatPhilippineMobileInput,
  isValidPhilippineMobile,
  toInternationalPhilippineMobile,
} from '../lib/philippinePhone';
import {
  buildDoctorScheduleFromClinicSettings,
  DEFAULT_DOCTOR_SCHEDULE,
  DOCTOR_SCHEDULE_DAYS,
  formatDoctorScheduleRange,
  type DoctorScheduleDay,
} from '../lib/doctorSchedule';

const statusConfig = {
  active: { bg: '#D1FAE5', text: '#059669', icon: CheckCircle, label: 'Active' },
  inactive: { bg: '#F3F4F6', text: '#6B7280', icon: AlertCircle, label: 'Inactive' },
  on_leave: { bg: '#FEF3C7', text: '#D97706', icon: Coffee, label: 'On Leave' },
};

function resolveDoctorSchedule(doctor: Partial<Doctor> | undefined, clinicSchedule: DoctorScheduleDay[]) {
  return doctor?.schedule && doctor.schedule.length > 0 ? doctor.schedule : clinicSchedule;
}

function createDoctorForm(doctor: Doctor | undefined, clinicSchedule: DoctorScheduleDay[]): Partial<Doctor> {
  const resolvedSchedule = resolveDoctorSchedule(doctor, clinicSchedule).map(schedule => ({ ...schedule }));

  return doctor
    ? { ...doctor, phone: formatPhilippineMobileForDisplay(doctor.phone), schedule: resolvedSchedule }
    : {
      name: '',
      specialization: '',
      email: '',
      phone: '',
      status: 'active',
      bio: '',
      photo: '',
      schedule: resolvedSchedule,
      consultationsToday: 0,
      totalPatients: 0,
    };
}

function DoctorModal({ doctor, clinicSchedule, onClose, onSave }: {
  doctor?: Doctor;
  clinicSchedule: DoctorScheduleDay[];
  onClose: () => void;
  onSave: (d: Doctor) => void;
}) {
  const isNew = !doctor;
  const [form, setForm] = useState<Partial<Doctor>>(createDoctorForm(doctor, clinicSchedule));

  useEffect(() => {
    setForm(createDoctorForm(doctor, clinicSchedule));
  }, [doctor, clinicSchedule]);

  const handleScheduleToggle = (day: string) => {
    const exists = form.schedule?.find(s => s.day === day);
    if (exists) {
      setForm(f => ({ ...f, schedule: f.schedule?.filter(s => s.day !== day) }));
    } else {
      const clinicDaySchedule = clinicSchedule.find(schedule => schedule.day === day) || DEFAULT_DOCTOR_SCHEDULE.find(schedule => schedule.day === day);
      if (!clinicDaySchedule) return;
      setForm(f => ({ ...f, schedule: [...(f.schedule || []), { ...clinicDaySchedule }] }));
    }
  };

  const handleSave = () => {
    if (!form.name?.trim() || !form.specialization?.trim()) {
      toast.error('Please fill in required fields.');
      return;
    }
    if (form.phone && !isValidPhilippineMobile(form.phone)) {
      toast.error('Please enter a valid Philippine mobile number.');
      return;
    }
    onSave({ ...form, id: doctor?.id || `d${Date.now()}` } as Doctor);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10, 36, 99, 0.4)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: '#fff', boxShadow: '0 20px 60px rgba(10, 36, 99, 0.25)' }}
      >
        <div className="px-6 py-5 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: '#E8F1FF', background: '#F4F7FF' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1.2rem', fontWeight: 700 }}>
            {isNew ? 'Add New Doctor' : 'Edit Doctor Profile'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#6B7A99' }}><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          <div>
            <h4 style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>Basic Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'name', label: 'Full Name *', placeholder: 'Dr. Full Name', type: 'text' },
                { key: 'specialization', label: 'Specialization *', placeholder: 'e.g. Internal Medicine', type: 'text' },
                { key: 'email', label: 'Email', placeholder: 'doctor@clinic.ph', type: 'email' },
                { key: 'phone', label: 'Phone', placeholder: '+63 9XX XXX XXXX', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>{f.label}</label>
                  <input
                    type={f.type}
                    inputMode={f.key === 'phone' ? 'numeric' : undefined}
                    maxLength={f.key === 'phone' ? 12 : undefined}
                    placeholder={f.key === 'phone' ? '986-087-9876' : f.placeholder}
                    value={(form as any)[f.key] || ''}
                    onChange={e => setForm(p => ({
                      ...p,
                      [f.key]: f.key === 'phone' ? formatPhilippineMobileInput(e.target.value) : e.target.value,
                    }))}
                    className="w-full px-4 py-2.5 rounded-xl outline-none" style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', border: '2px solid #E8F1FF', background: '#F4F7FF', color: '#0A2463' }} />
                  {f.key === 'phone' && (
                    <div style={{ fontFamily: 'var(--font-body)', color: form.phone && !isValidPhilippineMobile(form.phone) ? '#B91C1C' : '#6B7A99', fontSize: '0.72rem', marginTop: 6 }}>
                      {form.phone && !isValidPhilippineMobile(form.phone)
                        ? 'Enter a valid PH mobile number starting with 9.'
                        : ''}
                    </div>
                  )}
                </div>
              ))}
              <div>
                <label style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as DoctorStatus }))} className="w-full px-4 py-2.5 rounded-xl outline-none"
                  style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', border: '2px solid #E8F1FF', background: '#F4F7FF', color: '#0A2463' }}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Bio</label>
              <textarea placeholder="Brief professional biography..." rows={3} value={form.bio || ''} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl outline-none resize-none" style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', border: '2px solid #E8F1FF', background: '#F4F7FF', color: '#0A2463' }} />
            </div>
          </div>

          <div>
            <h4 style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>Weekly Schedule</h4>
            <div className="space-y-3">
              {DOCTOR_SCHEDULE_DAYS.map(day => {
                const sched = form.schedule?.find(s => s.day === day);
                const isActive = !!sched;
                return (
                  <motion.div key={day} className="rounded-xl overflow-hidden" style={{ border: `2px solid ${isActive ? '#3A86FF' : '#E8F1FF'}` }}>
                    <button onClick={() => handleScheduleToggle(day)} className="w-full flex items-center justify-between px-4 py-3" style={{ background: isActive ? '#E8F1FF' : '#F4F7FF' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: isActive ? '#1B4FD8' : '#D1D5DB' }}>
                          {isActive && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <span style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem', fontWeight: 600 }}>{day}</span>
                      </div>
                      {isActive && <span style={{ fontFamily: 'var(--font-body)', color: '#1B4FD8', fontSize: '0.8rem', fontWeight: 600 }}>{sched ? formatDoctorScheduleRange(sched) : ''}</span>}
                    </button>
                    <AnimatePresence>
                      {isActive && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                          <div className="px-4 py-3" style={{ background: '#fff' }}>
                            <div className="rounded-xl px-4 py-3" style={{ background: '#F8FAFF', border: '1px solid #E8F1FF' }}>
                              <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Database Schedule
                              </div>
                              <div style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '0.95rem', fontWeight: 700, marginTop: 6 }}>
                                {sched ? formatDoctorScheduleRange(sched) : 'Unavailable'}
                              </div>
                              <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem', marginTop: 4 }}>
                                Clinic hours are synced from the saved clinic schedule. Max patients has been removed from this form.
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3 flex-shrink-0" style={{ borderColor: '#E8F1FF' }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border" style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#6B7A99', borderColor: '#E8F1FF' }}>Cancel</button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSave} className="flex-1 py-3 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #1B4FD8, #3A86FF)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 600 }}>
            {isNew ? 'Add Doctor' : 'Save Changes'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function DoctorsPage() {
  const { data, deletedData, loading, updateStatus, refetch, deleteDoctor, recoverDoctor, permanentlyDeleteDoctor } = useDoctors();
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; doctor?: Doctor } | null>(null);
  const [clinicSchedule, setClinicSchedule] = useState<DoctorScheduleDay[]>(DEFAULT_DOCTOR_SCHEDULE);
  const [doctorToRemove, setDoctorToRemove] = useState<Doctor | null>(null);
  const [doctorToRecover, setDoctorToRecover] = useState<Doctor | null>(null);
  const [doctorToDeletePermanently, setDoctorToDeletePermanently] = useState<Doctor | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    let active = true;

    const fetchClinicSchedule = async () => {
      const { data: settings, error } = await supabase
        .from('clinic_settings')
        .select('*')
        .limit(1)
        .single();

      if (!active || error || !settings) {
        return;
      }

      setClinicSchedule(buildDoctorScheduleFromClinicSettings(settings));
    };

    void fetchClinicSchedule();

    return () => {
      active = false;
    };
  }, []);

  const filtered = data.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.specialization.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || d.status === filterStatus;
    return matchSearch && matchStatus;
  });
  const filteredDeleted = deletedData.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) || d.specialization.toLowerCase().includes(search.toLowerCase()),
  );

  const getDoctorSchedule = (doctor: Doctor) => doctor.schedule.length > 0 ? doctor.schedule : clinicSchedule;

  const handleSave = async (doctor: Doctor) => {
    try {
      if (modal?.type === 'add') {
        const { error } = await supabase.from('doctors').insert([{
          name: doctor.name,
          specialization: doctor.specialization,
          email: doctor.email,
          phone: toInternationalPhilippineMobile(doctor.phone),
          status: doctor.status,
          bio: doctor.bio,
          consultations_today: 0,
          total_patients: 0,
        }]);
        if (error) throw error;
        toast.success('Doctor profile created!');
      } else {
        const { error } = await supabase.from('doctors').update({
          name: doctor.name,
          specialization: doctor.specialization,
          email: doctor.email,
          phone: toInternationalPhilippineMobile(doctor.phone),
          status: doctor.status,
          bio: doctor.bio,
        }).eq('id', doctor.id);
        if (error) throw error;
        toast.success('Doctor profile updated!');
      }
      refetch();
    } catch (err: any) {
      toast.error('Failed to save: ' + (err?.message || 'Unknown error'));
    }
    setModal(null);
  };

  const handleStatusChange = async (doc: Doctor, next: DoctorStatus) => {
    const ok = await updateStatus(doc.id, next);
    if (ok) toast.success(`${doc.name} status set to ${next.replace('_', ' ')}.`);
    else toast.error('Failed to update status.');
  };

  const handleRemoveDoctor = async () => {
    if (!doctorToRemove) return;

    const doctorName = doctorToRemove.name;
    try {
      await deleteDoctor(doctorToRemove.id);
    } catch {
      toast.error(`Failed to remove ${doctorName}.`);
      return;
    }

    toast.success(`${doctorName} was moved to Recently Deleted.`);
    setDoctorToRemove(null);
  };

  const handleRecoverDoctor = async () => {
    if (!doctorToRecover) return;

    try {
      await recoverDoctor(doctorToRecover.id);
      toast.success(`${doctorToRecover.name} was recovered.`);
      setDoctorToRecover(null);
    } catch {
      toast.error(`Failed to recover ${doctorToRecover.name}.`);
    }
  };

  const handlePermanentDeleteDoctor = async () => {
    if (!doctorToDeletePermanently) return;

    try {
      await permanentlyDeleteDoctor(doctorToDeletePermanently.id);
      toast.success(`${doctorToDeletePermanently.name} was permanently deleted.`);
      setDoctorToDeletePermanently(null);
    } catch {
      toast.error(`Failed to permanently delete ${doctorToDeletePermanently.name}.`);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

   <div className="flex items-center justify-between gap-4 w-full">
  {/* Tabs — LEFT */}
  <div className="flex flex-wrap gap-2">
    {[
      { key: 'active', label: 'Doctors', count: data.length },
      { key: 'deleted', label: 'Recently Deleted', count: deletedData.length },
    ].map((tab) => (
      <button
        key={tab.key}
        onClick={() => setActiveTab(tab.key as 'active' | 'deleted')}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.82rem',
          fontWeight: activeTab === tab.key ? 700 : 500,
          background: activeTab === tab.key ? '#0A2463' : '#fff',
          color: activeTab === tab.key ? '#fff' : '#6B7A99',
          border: `1px solid ${activeTab === tab.key ? 'transparent' : '#E8F1FF'}`,
        }}
      >
        {tab.label}
        <span className="px-1.5 py-0.5 rounded-md" style={{ background: activeTab === tab.key ? 'rgba(255,255,255,0.18)' : '#F4F7FF', fontSize: '0.7rem', fontWeight: 700 }}>
          {tab.count}
        </span>
      </button>
    ))}
  </div>

  {/* Add Doctor — RIGHT */}
  <motion.button
    whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(27, 79, 216, 0.3)' }}
    whileTap={{ scale: 0.97 }}
    onClick={() => setModal({ type: 'add' })}
    className="flex items-center gap-2 px-8 py-2.5 rounded-xl text-white flex-shrink-0"
    style={{ background: 'linear-gradient(135deg, #1B4FD8, #3A86FF)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600 }}
  >
    <Plus className="w-4 h-4" /> Add Doctor
  </motion.button>
</div>
</div>
      {/* Stats */}
      {activeTab === 'active' && (
      <div className="grid grid-cols-2 gap-4">
        {(['active', 'on_leave'] as DoctorStatus[]).map(s => {
          const sc = statusConfig[s];
          const Icon = sc.icon;
          const count = data.filter(d => d.status === s).length;
          return (
            <motion.div key={s} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: sc.bg }}>
                <Icon className="w-5 h-5" style={{ color: sc.text }} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{count}</div>
                <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.78rem' }}>{sc.label}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border" style={{ background: '#fff', borderColor: '#E8F1FF' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#6B7A99' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or specialization..." className="bg-transparent outline-none flex-1"
            style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#0A2463' }} />
        </div>
        {activeTab === 'active' && (
        <div className="flex gap-2">
          {(['all', 'active', 'on_leave'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className="px-4 py-2.5 rounded-xl capitalize"
              style={{
                fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: filterStatus === s ? 600 : 400,
                background: filterStatus === s ? '#0A2463' : '#fff', color: filterStatus === s ? '#fff' : '#6B7A99',
                border: `1px solid ${filterStatus === s ? 'transparent' : '#E8F1FF'}`
              }}>
              {s === 'all' ? 'All' : s === 'on_leave' ? 'On Leave' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#3A86FF' }} />
            <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.875rem' }}>Loading doctors...</span>
          </div>
        </div>
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
          <AnimatePresence>
            {(activeTab === 'active' ? filtered : filteredDeleted).map((doc, i) => {
              const sc = statusConfig[doc.status];
              const Icon = sc.icon;
              const doctorSchedule = getDoctorSchedule(doc);
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4, boxShadow: '0 16px 48px rgba(10, 36, 99, 0.12)' }}
                  className="rounded-2xl overflow-hidden transition-all"
                  style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}
                >
                  {/* Card Header Banner */}
                  <div className="relative h-28" style={{ background: 'linear-gradient(135deg, #0A2463, #1B4FD8)' }}>
                    <div className="absolute inset-0 opacity-10">
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className="absolute rounded-full border border-white" style={{ width: `${100 + j * 60}px`, height: `${100 + j * 60}px`, top: '-30%', right: `${-10 + j * 20}%` }} />
                      ))}
                    </div>
                    {/* Action buttons top-right */}
                    <div className="absolute top-3 right-3 flex gap-2">
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setModal({ type: 'edit', doctor: doc })}
                        className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
                        <Edit className="w-3.5 h-3.5 text-white" />
                      </motion.button>
                    </div>
                    {/* Avatar pinned to bottom-left of banner */}
                    <div className="absolute -bottom-10 left-5">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 flex-shrink-0"
                        style={{ borderColor: '#fff', boxShadow: '0 4px 16px rgba(10, 36, 99, 0.2)' }}>
                        {doc.photo ? (
                          <img src={doc.photo} alt={doc.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold"
                            style={{ background: 'linear-gradient(135deg, #1B4FD8, #3A86FF)' }}>
                            {doc.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Doctor Info */}
                  <div className="px-5 pt-12 pb-5">
                    {/* Name & specialization */}
                    <div className="mb-3">
                      <h3 style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1rem', fontWeight: 700, lineHeight: 1.2 }}>{doc.name}</h3>
                      <p style={{ fontFamily: 'var(--font-body)', color: '#1B4FD8', fontSize: '0.8rem', fontWeight: 600, marginTop: 2 }}>{doc.specialization}</p>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: sc.bg, color: sc.text }}>
                        <Icon className="w-3 h-3" />
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{sc.label}</span>
                      </span>
                    </div>

                    {doc.bio && <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem', lineHeight: 1.6, marginBottom: 16 }}>{doc.bio}</p>}

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {[
                        { icon: Mail, value: doc.email },
                        { icon: Phone, value: formatPhilippineMobileForDisplay(doc.phone) },
                      ].map((item, idx) => {
                        const IIcon = item.icon;
                        return (
                          <div key={idx} className="flex items-center gap-2 min-w-0">
                            <IIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#6B7A99' }} />
                            <span style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-4 border-t" style={{ borderColor: '#F4F7FF' }}>
                      {[

                      ].map(stat => {
                        const SIcon = stat.icon;
                        return (
                          <div key={stat.label} className="text-center">
                            <div className="w-7 h-7 rounded-lg mx-auto mb-1 flex items-center justify-center" style={{ background: '#E8F1FF' }}>
                              <SIcon className="w-3.5 h-3.5" style={{ color: '#1B4FD8' }} />
                            </div>
                            <div style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1.1rem', fontWeight: 700, lineHeight: 1 }}>{stat.value}</div>
                            <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.65rem', marginTop: 2 }}>{stat.label}</div>
                          </div>
                        );
                      })}
                    </div>

                    {doctorSchedule.length > 0 && (
                      <div className="mt-4 pt-4 border-t" style={{ borderColor: '#F4F7FF' }}>
                        <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Schedule</p>
                        <div className="flex flex-wrap gap-1">
                          {doctorSchedule.map(s => (
                            <span key={s.day} className="px-2 py-1 rounded-lg" style={{ background: '#E8F1FF', color: '#1B4FD8', fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 600 }}>
                              {s.day.slice(0, 3)} {formatDoctorScheduleRange(s)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {activeTab === 'active' ? (
                      <>
                      <button
                        onClick={() => void handleStatusChange(doc, doc.status === 'on_leave' ? 'active' : 'on_leave')}
                        className="flex-1 min-w-[140px] rounded-xl px-4 py-2.5"
                        style={{
                          background: doc.status === 'on_leave' ? '#D1FAE5' : '#FEF3C7',
                          color: doc.status === 'on_leave' ? '#059669' : '#D97706',
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                        }}
                      >
                        {doc.status === 'on_leave' ? 'Set Active' : 'On Leave'}
                      </button>
                      <button
                        onClick={() => setDoctorToRemove(doc)}
                        className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5"
                        style={{
                          background: '#FEE2E2',
                          color: '#DC2626',
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                      </>
                      ) : (
                      <>
                      <button
                        onClick={() => setDoctorToRecover(doc)}
                        className="flex-1 min-w-[140px] rounded-xl px-4 py-2.5"
                        style={{
                          background: '#D1FAE5',
                          color: '#059669',
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                        }}
                      >      
                        <span className="inline-flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Recover</span>
                      </button>
                      <button
                        onClick={() => setDoctorToDeletePermanently(doc)}
                        className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5"
                        style={{
                          background: '#FEE2E2',
                          color: '#e42f2fff',
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        Permanently Delete
                      </button>
                      </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modal && (
          <DoctorModal
            doctor={modal.doctor}
            clinicSchedule={clinicSchedule}
            onClose={() => setModal(null)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!doctorToRemove}
        title={`Remove ${doctorToRemove?.name || 'doctor'}?`}
        description="Are you sure do you want to remove this item?"
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleRemoveDoctor}
        onCancel={() => setDoctorToRemove(null)}
      />
      <ConfirmModal
        open={!!doctorToRecover}
        title={`Recover ${doctorToRecover?.name || 'doctor'}?`}
        description="This doctor will return to the main doctors list."
        confirmLabel="Recover"
        onConfirm={handleRecoverDoctor}
        onCancel={() => setDoctorToRecover(null)}
      />
      <ConfirmModal
        open={!!doctorToDeletePermanently}
        title={`Permanently delete ${doctorToDeletePermanently?.name || 'doctor'}?`}
        description="This will permanently delete the doctor record."
        confirmLabel="Permanently Delete"
        variant="danger"
        onConfirm={handlePermanentDeleteDoctor}
        onCancel={() => setDoctorToDeletePermanently(null)}
      />
    </div>
  );
}
