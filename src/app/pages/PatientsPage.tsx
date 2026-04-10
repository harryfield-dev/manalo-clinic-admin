import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronDown, User, Phone, Mail, MapPin, Pill, AlertCircle, FileText, Calendar, Stethoscope, X, Eye, Shield, Loader2, Trash2, Star, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Patient, Consultation } from '../data/mockData';
import { formatPhilippineMobileForDisplay } from '../lib/philippinePhone';
import { getPatientIdentityKey, inferRegistrationSource } from '../lib/patientIdentity';
import { supabase } from '../lib/supabase';

// Extended patient type with consultation date
interface PatientWithConsultDate extends Patient {
  lastConsultationDate?: string;
  identityKey?: string;
  recordOrigin?: 'patients' | 'appointments' | 'patient_walkin';
  avgRating?: number | null;
  ratingCount?: number;
  deletedAt?: string | null;
}

interface AppointmentRating {
  id: string;
  rating: number;
  review_text?: string;
  doctor_name?: string;
  created_at: string;
  appointment_date?: string;
}

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          style={{
            width: size,
            height: size,
            fill: s <= rating ? '#F59E0B' : 'none',
            color: s <= rating ? '#F59E0B' : '#D1D5DB',
            flexShrink: 0,
          }}
        />
      ))}
    </span>
  );
}

const sourceConfig = {
  online: { bg: '#DBEAFE', text: '#1D4ED8', label: 'Online' },
  'walk-in': { bg: '#FEF3C7', text: '#B45309', label: 'Walk-In' },
} as const;

function formatRegisteredDate(value: string) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ConsultationCard({ consultation, index }: { consultation: Consultation; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl overflow-hidden border"
      style={{ borderColor: '#E8F1FF' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors"
        style={{ background: expanded ? '#E8F1FF' : '#F4F7FF' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: expanded ? '#1B4FD8' : '#D1D5DB' }}>
            <Stethoscope className="w-4 h-4" style={{ color: expanded ? '#fff' : '#6B7A99' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem', fontWeight: 600 }}>{consultation.diagnosis}</div>
            <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem' }}>
              {new Date(consultation.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} · {consultation.doctorName}
            </div>
          </div>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4" style={{ color: '#6B7A99' }} />
        </motion.div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4" style={{ background: '#fff' }}>
              <div className="space-y-3">
                {[
                  { label: 'Prescription', value: consultation.prescription, icon: Pill, color: '#7C3AED', bg: '#EDE9FE' },
                  { label: 'Clinical Notes', value: consultation.notes, icon: FileText, color: '#1B4FD8', bg: '#E8F1FF' },
                  ...(consultation.followUpDate ? [{ label: 'Follow-up Date', value: new Date(consultation.followUpDate).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), icon: Calendar, color: '#059669', bg: '#D1FAE5' }] : []),
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex gap-3 p-3 rounded-xl" style={{ background: '#F4F7FF' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: item.bg }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                      </div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{item.label}</div>
                        <div style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.85rem', lineHeight: 1.5 }}>{item.value}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PatientDetailModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [showIdLightbox, setShowIdLightbox] = useState(false);
  const [ratings, setRatings] = useState<AppointmentRating[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);

  useEffect(() => {
    const fetchRatings = async () => {
      setRatingsLoading(true);
      try {
        if (!patient.email) { setRatings([]); return; }
        const { data, error } = await supabase
          .from('appointment_ratings')
          .select('id, rating, review, doctor_name, created_at, appointment_date')
          .eq('patient_email', patient.email)
          .order('created_at', { ascending: false });
        if (error) {
          // Try without appointment_date in case the column doesn't exist
          const { data: fallbackData } = await supabase
            .from('appointment_ratings')
            .select('id, rating, review, doctor_name, created_at')
            .eq('patient_email', patient.email)
            .order('created_at', { ascending: false });
          setRatings(((fallbackData || []) as any[]).map(r => ({ ...r, review_text: r.review })) as AppointmentRating[]);
          return;
        }
        // Map `review` column to `review_text` field for display compatibility
        setRatings(((data || []) as any[]).map(r => ({ ...r, review_text: r.review })) as AppointmentRating[]);
      } finally {
        setRatingsLoading(false);
      }
    };
    fetchRatings();
  }, [patient.email]);

  return (
    <>
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
          {/* Header */}
          <div className="relative flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0A2463, #1B4FD8)', padding: '24px 24px 60px' }}>
            <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <X className="w-4 h-4 text-white" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white border-4 border-white/20"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                {patient.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: '1.3rem', fontWeight: 700 }}>{patient.name}</h3>
                <p style={{ fontFamily: 'var(--font-body)', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                  Patient ID: #{patient.id.slice(0, 8).toUpperCase()} · {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                  {patient.dateOfBirth ? ` · ${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} yrs old` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-6 pt-6 pb-6 space-y-6">
            {/* Info Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Gender', value: patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1), icon: User, color: '#1B4FD8', bg: '#E8F1FF' },
                { label: 'Age', value: patient.dateOfBirth ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} years` : 'N/A', icon: Calendar, color: '#059669', bg: '#D1FAE5' },
                { label: 'Consultations', value: patient.consultations.length, icon: Stethoscope, color: '#7C3AED', bg: '#EDE9FE' },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 8px rgba(10, 36, 99, 0.06)' }}>
                    <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ background: item.bg }}>
                      <Icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <div style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '0.95rem', fontWeight: 700 }}>{item.value}</div>
                    <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.7rem' }}>{item.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Contact Info */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#F4F7FF' }}>
              <h4 style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contact Information</h4>
              {[
                { icon: Mail, value: patient.email || 'N/A' },
                { icon: Phone, value: formatPhilippineMobileForDisplay(patient.phone) || patient.phone || 'N/A' },
                { icon: MapPin, value: patient.address || 'N/A' },
                { icon: AlertCircle, value: `Emergency: ${patient.emergencyContact || 'N/A'}` },
              ].map((item, i) => {
                const IIcon = item.icon;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <IIcon className="w-4 h-4 flex-shrink-0" style={{ color: '#6B7A99' }} />
                    <span style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem' }}>{item.value}</span>
                  </div>
                );
              })}
            </div>

            {/* Identity Verification */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#E8F1FF' }}>
                  <Shield className="w-3.5 h-3.5" style={{ color: '#1B4FD8' }} />
                </div>
                <h4 style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Identity Verification
                </h4>
              </div>
              {patient.validIdUrl ? (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#F4F7FF', border: '1px solid #E8F1FF' }}>
                  <div className="rounded-lg overflow-hidden flex-shrink-0" style={{ width: 72, height: 48, border: '1px solid #E8F1FF' }}>
                    <img src={patient.validIdUrl} alt="Valid ID" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.82rem', fontWeight: 600 }}>valid-id.jpg</div>
                    <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.72rem', marginTop: 2 }}>Uploaded on registration</div>
                  </div>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setShowIdLightbox(true)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#E8F1FF' }}>
                    <Eye className="w-4 h-4" style={{ color: '#1B4FD8' }} />
                  </motion.button>
                </div>
              ) : (
                <div className="p-3 rounded-xl" style={{ background: '#F4F7FF', border: '1px solid #E8F1FF' }}>
                  <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.82rem' }}>No valid ID uploaded.</p>
                </div>
              )}
            </div>

            {/* Consultations */}
            <div>
              <h4 style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Consultation History ({patient.consultations.length})
              </h4>
              {patient.consultations.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.85rem' }}>No consultations recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {patient.consultations.map((c, i) => (
                    <ConsultationCard key={c.id} consultation={c} index={i} />
                  ))}
                </div>
              )}
            </div>

            {/* Patient Reviews */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FEF3C7' }}>
                  <Star className="w-3.5 h-3.5" style={{ color: '#D97706' }} />
                </div>
                <h4 style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Clinic Reviews by Patient
                </h4>
                {!ratingsLoading && ratings.length > 0 && (() => {
                  const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
                  return (
                    <div className="ml-auto flex items-center gap-2">
                      <StarDisplay rating={Math.round(avg)} />
                      <span style={{ fontFamily: 'var(--font-body)', color: '#D97706', fontSize: '0.82rem', fontWeight: 700 }}>
                        {avg.toFixed(1)}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem' }}>
                        ({ratings.length} review{ratings.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  );
                })()}
              </div>

              {ratingsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#3A86FF' }} />
                </div>
              ) : ratings.length === 0 ? (
                <div className="rounded-xl p-5 text-center" style={{ background: '#F9FBFF', border: '1.5px dashed #C7D7F8' }}>
                  <Star className="w-8 h-8 mx-auto mb-2" style={{ color: '#C7D7F8' }} />
                  <p style={{ fontFamily: 'var(--font-body)', color: '#9CA3AF', fontSize: '0.82rem' }}>No reviews yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ratings.map((r) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl p-4"
                      style={{ background: '#F9FBFF', border: '1px solid #E8F1FF' }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <StarDisplay rating={r.rating} size={15} />
                        <span style={{ fontFamily: 'var(--font-body)', color: '#9CA3AF', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                          {new Date((r as any).appointment_date || r.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#E8F1FF' }}>
                          <span style={{ fontFamily: 'var(--font-body)', color: '#1B4FD8', fontSize: '0.6rem', fontWeight: 700 }}>MC</span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-body)', color: '#1B4FD8', fontSize: '0.75rem', fontWeight: 600 }}>
                          Clinic Review
                          {r.doctor_name ? ` · Visit with ${r.doctor_name}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span style={{ fontFamily: 'var(--font-body)', color: '#9CA3AF', fontSize: '0.7rem' }}>
                          Rating: {r.rating}/5 stars
                        </span>
                      </div>
                      {r.review_text ? (
                        <p style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.85rem', lineHeight: 1.55 }}>"{r.review_text}"</p>
                      ) : (
                        <p style={{ fontFamily: 'var(--font-body)', color: '#9CA3AF', fontSize: '0.82rem', fontStyle: 'italic' }}>No written review provided.</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ID Lightbox */}
      <AnimatePresence>
        {showIdLightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-6"
            style={{ background: 'rgba(10, 36, 99, 0.85)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowIdLightbox(false)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl"
            >
              <button onClick={() => setShowIdLightbox(false)}
                className="absolute -top-4 -right-4 w-9 h-9 rounded-full flex items-center justify-center z-10"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
                <X className="w-4 h-4" />
              </button>
              <p className="text-center mb-3" style={{ fontFamily: 'var(--font-body)', color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem', fontWeight: 600 }}>
                Valid ID — {patient.name}
              </p>
              <img src={patient.validIdUrl || 'https://placehold.co/400x250'} alt={`Valid ID — ${patient.name}`} className="w-full rounded-2xl"
                style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.55)', display: 'block' }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function PatientsPage() {
  const [patients, setPatients] = useState<PatientWithConsultDate[]>([]);
  const [deletedPatients, setDeletedPatients] = useState<PatientWithConsultDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGender, setFilterGender] = useState('all');
  const [filterSource, setFilterSource] = useState<'all' | 'online' | 'walk-in'>('all');
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active');
  const [selectedPatient, setSelectedPatient] = useState<PatientWithConsultDate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatientWithConsultDate | null>(null);
  const [recoverTarget, setRecoverTarget] = useState<PatientWithConsultDate | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<PatientWithConsultDate | null>(null);

  useEffect(() => {
    const mapRowsToPatients = async ({
      patientRows,
      walkinRows,
      appointmentRows,
      includeAppointmentOnly,
    }: {
      patientRows: any[];
      walkinRows: any[];
      appointmentRows: any[];
      includeAppointmentOnly: boolean;
    }) => {
      const { data: allRatings } = await supabase.from('appointment_ratings').select('patient_email, rating');
      const ratingMap = new Map<string, { count: number; sum: number }>();

      for (const rating of allRatings || []) {
        const email = (rating.patient_email || '').toLowerCase();
        if (!email) continue;
        if (!ratingMap.has(email)) ratingMap.set(email, { count: 0, sum: 0 });
        const entry = ratingMap.get(email)!;
        entry.count += 1;
        entry.sum += rating.rating;
      }

      const apptMap = new Map<string, any>();
      for (const appointment of appointmentRows || []) {
        const key = getPatientIdentityKey({
          email: appointment.patient_email,
          phone: appointment.patient_phone,
          name: appointment.patient_name,
          fallbackId: appointment.id,
        });

        if (!apptMap.has(key)) {
          apptMap.set(key, appointment);
        }
      }

      const patientKeys = new Set(
        patientRows.map((patient: any) =>
          getPatientIdentityKey({
            email: patient.email,
            phone: patient.contact_number,
            name: patient.full_name,
            fallbackId: patient.id,
          }),
        ),
      );

      const walkinKeys = new Set(
        walkinRows.map((patient: any) =>
          getPatientIdentityKey({
            email: patient.email,
            phone: patient.contact_number,
            name: patient.full_name,
            fallbackId: patient.id,
          }),
        ),
      );

      const mergedRows = [
        ...patientRows,
        ...walkinRows
          .filter((patient: any) => {
            const key = getPatientIdentityKey({
              email: patient.email,
              phone: patient.contact_number,
              name: patient.full_name,
              fallbackId: patient.id,
            });

            return !patientKeys.has(key);
          })
          .map((patient: any) => ({ ...patient, _fromWalkinTable: true, registration_source: 'walk-in' })),
      ];

      if (includeAppointmentOnly) {
        for (const [key, appointment] of apptMap.entries()) {
          if (!patientKeys.has(key) && !walkinKeys.has(key)) {
            mergedRows.push({
              id: appointment.id,
              full_name: appointment.patient_name || 'Walk-in Patient',
              email: appointment.patient_email || '',
              contact_number: appointment.patient_phone || '',
              date_of_birth: '',
              gender: 'other',
              address: '',
              emergency_contact_name: '',
              emergency_contact_number: '',
              valid_id_url: appointment.valid_id_url || '',
              created_at: appointment.created_at,
              identity_key: key,
              _fromAppointment: true,
              _apptDate: appointment.date,
              registration_source: 'walk-in',
              deleted_at: null,
            });
          }
        }
      }

      return Promise.all(mergedRows.map(async (patient: any) => {
        let consultations: Consultation[] = [];

        if (patient.email) {
          const { data: consultData } = await supabase
            .from('consultations')
            .select('*')
            .eq('patient_email', patient.email)
            .order('date', { ascending: false });

          consultations = (consultData || []).map((consultation: any) => ({
            id: consultation.id,
            date: consultation.date,
            doctorName: consultation.doctor_name,
            diagnosis: consultation.diagnosis,
            prescription: consultation.prescription,
            notes: consultation.notes,
            followUpDate: consultation.follow_up_date || undefined,
            vitals: { bp: '', temp: '', weight: '', height: '' },
          }));
        }

        const identityKey = patient.identity_key || getPatientIdentityKey({
          email: patient.email,
          phone: patient.contact_number,
          name: patient.full_name,
          fallbackId: patient.id,
        });
        const latestAppt = apptMap.get(identityKey);
        const emailLower = (patient.email || '').toLowerCase();
        const ratingInfo = emailLower ? ratingMap.get(emailLower) : null;

        return {
          id: patient.id,
          name: patient.full_name || 'Unnamed Patient',
          email: patient.email || '',
          phone: patient.contact_number || '',
          dateOfBirth: patient.date_of_birth || '',
          gender: (patient.gender?.toLowerCase() || 'other') as 'male' | 'female' | 'other',
          address: patient.address || '',
          bloodType: '',
          allergies: [],
          emergencyContact: `${patient.emergency_contact_name || ''} - ${patient.emergency_contact_number || ''}`,
          createdAt: patient.created_at,
          consultations,
          validIdUrl: patient.valid_id_url || latestAppt?.valid_id_url || '',
          lastConsultationDate: latestAppt?.date || patient._apptDate || undefined,
          identityKey,
          avgRating: ratingInfo ? ratingInfo.sum / ratingInfo.count : null,
          ratingCount: ratingInfo ? ratingInfo.count : 0,
          deletedAt: patient.deleted_at || null,
          registrationSource: inferRegistrationSource({
            email: patient.email,
            registrationSource: patient._fromWalkinTable ? 'walk-in' : patient.registration_source,
          }),
          // AFTER
recordOrigin: (patient._fromAppointment ? 'appointments' : patient._fromWalkinTable ? 'patient_walkin' : 'patients') as 'patients' | 'appointments' | 'patient_walkin',
        };
      }));
    };

    const loadPatients = async () => {
      setLoading(true);
      try {
        const [patientsRes, appointmentsRes, walkinsRes, deletedPatientsRes, deletedWalkinsRes] = await Promise.all([
          supabase.from('patients').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
          supabase.from('appointments').select('*').is('deleted_at', null).in('status', ['approved', 'completed']).order('created_at', { ascending: false }),
          supabase.from('patient_walkin').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
          supabase.from('patients').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
          supabase.from('patient_walkin').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
        ]);

        if (patientsRes.error) throw patientsRes.error;
        if (appointmentsRes.error) throw appointmentsRes.error;
        if (walkinsRes.error) throw walkinsRes.error;
        if (deletedPatientsRes.error) throw deletedPatientsRes.error;
        if (deletedWalkinsRes.error) throw deletedWalkinsRes.error;

        const [activeRows, deletedRows] = await Promise.all([
          mapRowsToPatients({
            patientRows: patientsRes.data || [],
            walkinRows: walkinsRes.data || [],
            appointmentRows: appointmentsRes.data || [],
            includeAppointmentOnly: true,
          }),
          mapRowsToPatients({
            patientRows: deletedPatientsRes.data || [],
            walkinRows: deletedWalkinsRes.data || [],
            appointmentRows: [],
            includeAppointmentOnly: false,
          }),
        ]);

        setPatients(activeRows);
        setDeletedPatients(deletedRows);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load patients.');
      } finally {
        setLoading(false);
      }
    };

    void loadPatients();

    const channel = supabase
      .channel('patients-page-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        void loadPatients();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => {
        void loadPatients();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_walkin' }, () => {
        void loadPatients();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = patients.filter((patient) => {
    const registrationSource = patient.registrationSource || inferRegistrationSource({ email: patient.email });
    const matchSearch =
      patient.name.toLowerCase().includes(search.toLowerCase()) ||
      (patient.email || '').toLowerCase().includes(search.toLowerCase());
    const matchGender = filterGender === 'all' || patient.gender === filterGender;
    const matchSource = filterSource === 'all' || registrationSource === filterSource;
    return matchSearch && matchGender && matchSource;
  });

  const filteredDeleted = deletedPatients.filter((patient) => {
    const registrationSource = patient.registrationSource || inferRegistrationSource({ email: patient.email });
    const matchSearch =
      patient.name.toLowerCase().includes(search.toLowerCase()) ||
      (patient.email || '').toLowerCase().includes(search.toLowerCase());
    const matchGender = filterGender === 'all' || patient.gender === filterGender;
    const matchSource = filterSource === 'all' || registrationSource === filterSource;
    return matchSearch && matchGender && matchSource;
  });

  const updatePatientDeletionState = async (patient: PatientWithConsultDate, deletedAt: string | null) => {
    const table = patient.recordOrigin === 'patient_walkin' ? 'patient_walkin' : 'patients';
    const query = deletedAt === null
      ? supabase.from(table).update({ deleted_at: null }).eq('id', patient.id)
      : supabase.from(table).update({ deleted_at: deletedAt }).eq('id', patient.id);

    const { error } = await query;
    if (error) throw error;
  };

  const handleRemovePatient = async () => {
    if (!deleteTarget) return;

    try {
      await updatePatientDeletionState(deleteTarget, new Date().toISOString());
      toast.success(`${deleteTarget.name} was moved to Recently Deleted.`);
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove patient record.');
    }
  };

  const handleRecoverPatient = async () => {
    if (!recoverTarget) return;

    try {
      await updatePatientDeletionState(recoverTarget, null);
      toast.success(`${recoverTarget.name} was recovered.`);
      setRecoverTarget(null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to recover patient record.');
    }
  };

  const handlePermanentDeletePatient = async () => {
    if (!permanentDeleteTarget) return;

    try {
      const table = permanentDeleteTarget.recordOrigin === 'patient_walkin' ? 'patient_walkin' : 'patients';
      const { error } = await supabase.from(table).delete().eq('id', permanentDeleteTarget.id);
      if (error) throw error;
      toast.success(`${permanentDeleteTarget.name} was permanently deleted.`);
      setPermanentDeleteTarget(null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to permanently delete patient record.');
    }
  };

  const visibleRows = activeTab === 'active' ? filtered : filteredDeleted;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'active', label: 'Patient Records', count: patients.length },
          { key: 'deleted', label: 'Recently Deleted', count: deletedPatients.length },
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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border" style={{ background: '#fff', borderColor: '#E8F1FF' }}>
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: '#6B7A99' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." className="bg-transparent outline-none flex-1"
            style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#0A2463' }} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {([
            ['all', 'All Sources'],
            ['online', 'Online'],
            ['walk-in', 'Walk-In'],
          ] as const).map(([sourceKey, label]) => (
            <button key={sourceKey} onClick={() => setFilterSource(sourceKey)} className="px-4 py-2.5 rounded-xl"
              style={{
                fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: filterSource === sourceKey ? 600 : 400,
                background: filterSource === sourceKey ? '#1B4FD8' : '#fff', color: filterSource === sourceKey ? '#fff' : '#6B7A99',
                border: `1px solid ${filterSource === sourceKey ? 'transparent' : '#E8F1FF'}`
              }}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'male', 'female'] as const).map(g => (
            <button key={g} onClick={() => setFilterGender(g)} className="px-4 py-2.5 rounded-xl capitalize"
              style={{
                fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: filterGender === g ? 600 : 400,
                background: filterGender === g ? '#0A2463' : '#fff', color: filterGender === g ? '#fff' : '#6B7A99',
                border: `1px solid ${filterGender === g ? 'transparent' : '#E8F1FF'}`
              }}>
              {g === 'all' ? 'All Patients' : g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#3A86FF' }} />
            <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.875rem' }}>Loading patients...</span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E8F1FF', boxShadow: '0 2px 12px rgba(10, 36, 99, 0.06)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F4F7FF', borderBottom: '1px solid #E8F1FF' }}>
                  {['Patient', 'Contact', activeTab === 'active' ? 'Date Registered' : 'Deleted', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3.5" style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10" style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.875rem' }}>
                      {activeTab === 'active' ? 'No patients found.' : 'No recently deleted patients found.'}
                    </td>
                  </tr>
                ) : visibleRows.map((patient, index) => {
                  const registrationSource = patient.registrationSource || inferRegistrationSource({ email: patient.email });
                  const sourceBadge = sourceConfig[registrationSource];
                  const canDelete = patient.recordOrigin === 'patients' || patient.recordOrigin === 'patient_walkin';

                  return (
                    <motion.tr key={patient.identityKey || patient.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
                      className="border-b transition-colors cursor-pointer" style={{ borderColor: '#F4F7FF' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F9FBFF'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                      onClick={() => setSelectedPatient(patient)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0"
                            style={{ background: patient.gender === 'female' ? 'linear-gradient(135deg, #EC4899, #F43F5E)' : 'linear-gradient(135deg, #1B4FD8, #3A86FF)', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                            {patient.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem', fontWeight: 600 }}>{patient.name}</div>
                            <div className="flex items-center gap-2 flex-wrap mt-1">
                              <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem', textTransform: 'capitalize' }}>{patient.gender}</div>
                              <span className="px-2 py-0.5 rounded-md" style={{ background: sourceBadge.bg, color: sourceBadge.text, fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700 }}>
                                {sourceBadge.label}
                              </span>
                              {(patient.ratingCount || 0) > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                                  <Star className="w-2.5 h-2.5" style={{ fill: '#F59E0B', color: '#F59E0B' }} />
                                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: 700, color: '#D97706' }}>
                                    {patient.avgRating?.toFixed(1)} ({patient.ratingCount})
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.8rem' }}>{patient.phone || '�'}</div>
                        <div style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.75rem' }}>{patient.email || '�'}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        {activeTab === 'active' ? (
                          patient.createdAt ? (
                            <>
                              <div style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem' }}>
                                {formatRegisteredDate(patient.createdAt)}
                              </div>
                              <div style={{ fontFamily: 'var(--font-body)', color: '#059669', fontSize: '0.72rem', fontWeight: 600 }}>
                                Registered
                              </div>
                            </>
                          ) : <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem' }}>�</span>
                        ) : (
                          patient.deletedAt ? (
                            <>
                              <div style={{ fontFamily: 'var(--font-body)', color: '#0A2463', fontSize: '0.875rem' }}>
                                {formatRegisteredDate(patient.deletedAt)}
                              </div>
                              <div style={{ fontFamily: 'var(--font-body)', color: '#DC2626', fontSize: '0.72rem', fontWeight: 600 }}>
                                Recently Deleted
                              </div>
                            </>
                          ) : <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem' }}>�</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={e => { e.stopPropagation(); setSelectedPatient(patient); }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#E8F1FF' }}>
                            <Eye className="w-4 h-4" style={{ color: '#1B4FD8' }} />
                          </motion.button>
                          {activeTab === 'active' ? (
                            canDelete && (
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={e => { e.stopPropagation(); setDeleteTarget(patient); }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FEE2E2' }}>
                                <Trash2 className="w-4 h-4" style={{ color: '#DC2626' }} />
                              </motion.button>
                            )
                          ) : (
                            <>
                              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={e => { e.stopPropagation(); setRecoverTarget(patient); }}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-2" style={{ background: '#D1FAE5', color: '#059669' }}>
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700 }}>Recover</span>
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={e => { e.stopPropagation(); setPermanentDeleteTarget(patient); }}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-2" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700 }}>Delete</span>
                              </motion.button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t" style={{ borderColor: '#F4F7FF' }}>
            <span style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem' }}>
              Showing {visibleRows.length} of {activeTab === 'active' ? patients.length : deletedPatients.length} {activeTab === 'active' ? 'patients' : 'deleted records'}
            </span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedPatient && (
          <PatientDetailModal patient={selectedPatient} onClose={() => setSelectedPatient(null)} />
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!deleteTarget}
        title={`Remove ${deleteTarget?.name || 'patient record'}?`}
        description="This patient will be hidden from the main list and moved to Recently Deleted."
        confirmLabel="Move to Recently Deleted"
        variant="danger"
        onConfirm={handleRemovePatient}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        open={!!recoverTarget}
        title={`Recover ${recoverTarget?.name || 'patient record'}?`}
        description="This patient record will return to the main list."
        confirmLabel="Recover"
        onConfirm={handleRecoverPatient}
        onCancel={() => setRecoverTarget(null)}
      />
      <ConfirmModal
        open={!!permanentDeleteTarget}
        title={`Permanently delete ${permanentDeleteTarget?.name || 'patient record'}?`}
        description="This will permanently delete the patient record from the database."
        confirmLabel="Permanently Delete"
        variant="danger"
        onConfirm={handlePermanentDeletePatient}
        onCancel={() => setPermanentDeleteTarget(null)}
      />
    </div>
  );
}
