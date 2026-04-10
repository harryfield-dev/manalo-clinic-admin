import { supabase } from '../lib/supabase';
import { inferRegistrationSource, type RegistrationSource } from '../lib/patientIdentity';
import { type DoctorScheduleDay, normalizeDoctorSchedule } from '../lib/doctorSchedule';

export type AppointmentStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
export type DoctorStatus = 'active' | 'inactive' | 'on_leave';

export interface Appointment {
  id: string;
  patientId?: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  doctorName: string;
  date: string;
  time: string;
  type: string;
  status: AppointmentStatus;
  reason: string;
  validIdUrl?: string;
  createdAt: string;
  registrationSource?: RegistrationSource;
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  email: string;
  phone: string;
  photo: string;
  status: DoctorStatus;
  licenseNo: string;
  bio: string;
  schedule: DoctorScheduleDay[];
  consultationsToday: number;
  totalPatients: number;
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  address: string;
  bloodType: string;
  allergies: string[];
  emergencyContact: string;
  createdAt: string;
  consultations: Consultation[];
  validIdUrl?: string;
  registrationSource?: RegistrationSource;
}

export interface Consultation {
  id: string;
  date: string;
  doctorName: string;
  diagnosis: string;
  prescription: string;
  notes: string;
  followUpDate?: string;
  vitals: {
    bp: string;
    temp: string;
    weight: string;
    height: string;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'patient' | 'staff' | 'ai';
  content: string;
  timestamp: string;
  read: boolean;
}

export interface ChatConversation {
  id: string;
  patientId: string;
  patientName: string;
  patientAvatar?: string;
  online: boolean;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  escalated: boolean;
  messages: ChatMessage[];
}

export interface Notification {
  id: string;
  type: 'appointment' | 'message' | 'cancellation' | 'system' | 'urgent';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
}

export interface AuditLog {
  id: string;
  action: string;
  user: string;
  target: string;
  timestamp: string;
  ip: string;
}

// ── Fetch functions ──────────────────────────────────────────────────

export async function fetchAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((a: any) => ({
    id: a.id,
    patientId: a.patient_id || undefined,
    patientName: a.patient_name || '',
    patientEmail: a.patient_email || '',
    patientPhone: a.patient_phone || '',
    doctorName: a.doctor_name || '',
    date: a.date,
    time: a.time,
    type: a.type || 'general-checkup',
    status: (a.status || 'pending') as AppointmentStatus,
    reason: a.reason || '',
    validIdUrl: a.valid_id_url || '',
    createdAt: a.created_at,
    registrationSource: inferRegistrationSource({
      email: a.patient_email,
      registrationSource: a.registration_source,
    }),
  }));
}

export async function fetchDoctors(): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((d: any) => ({
    id: d.id,
    name: d.name,
    specialization: d.specialization,
    email: d.email,
    phone: d.phone,
    photo: d.photo,
    status: d.status as DoctorStatus,
    licenseNo: d.license_no,
    bio: d.bio,
    schedule: normalizeDoctorSchedule(d.schedule),
    consultationsToday: d.consultations_today || 0,
    totalPatients: d.total_patients || 0,
  }));
}

export async function fetchPatients(): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  const patients: Patient[] = await Promise.all(data.map(async (p: any) => {
    const { data: consultData } = await supabase
      .from('consultations')
      .select('*')
      .eq('patient_email', p.email)
      .order('date', { ascending: false });

    const consultations: Consultation[] = (consultData || []).map((c: any) => ({
      id: c.id,
      date: c.date,
      doctorName: c.doctor_name,
      diagnosis: c.diagnosis,
      prescription: c.prescription,
      notes: c.notes,
      followUpDate: c.follow_up_date || undefined,
      vitals: { bp: '', temp: '', weight: '', height: '' },
    }));

    return {
      id: p.id,
      name: p.full_name,
      email: p.email,
      phone: p.contact_number || '',
      dateOfBirth: p.date_of_birth || '',
      gender: (p.gender?.toLowerCase() || 'other') as 'male' | 'female' | 'other',
      address: p.address || '',
      bloodType: '',
      allergies: [],
      emergencyContact: `${p.emergency_contact_name || ''} - ${p.emergency_contact_number || ''}`,
      createdAt: p.created_at,
      consultations,
      registrationSource: inferRegistrationSource({
        email: p.email,
        registrationSource: p.registration_source,
      }),
    };
  }));

  return patients;
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((l: any): AuditLog => ({
    id: l.id,
    action: l.action,
    user: l.performed_by,
    target: l.target,
    timestamp: l.created_at,
    ip: l.ip_address,
  }));
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id);
  return !error;
}

export async function updateDoctorStatus(id: string, status: DoctorStatus) {
  const { error } = await supabase
    .from('doctors')
    .update({ status })
    .eq('id', id);
  return !error;
}

export async function insertAuditLog(action: string, performedBy: string, target: string) {
  await supabase.from('audit_logs').insert({
    action,
    performed_by: performedBy,
    target,
  });
}

// ── Chat helpers ─────────────────────────────────────────────────────

export interface ChatConversationSummary {
  patientEmail: string;
  patientName: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
}

/**
 * Fetches all distinct patient conversations from `chat_messages`,
 * grouped by patient_email, sorted by most recent message first.
 */
export async function fetchChatConversations(): Promise<ChatConversationSummary[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('patient_email, patient_name, message, created_at, sender_type, read')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const map = new Map<string, ChatConversationSummary>();
  for (const row of data as any[]) {
    const email = row.patient_email as string;
    if (!map.has(email)) {
      map.set(email, {
        patientEmail: email,
        patientName: row.patient_name || email,
        unreadCount: 0,
        lastMessage: row.message,
        lastMessageTime: row.created_at,
      });
    }
    const entry = map.get(email)!;
    if (row.sender_type === 'patient' && !row.read) {
      entry.unreadCount += 1;
    }
  }

  return Array.from(map.values());
}

// Keep empty arrays for backward compatibility
export const appointments: Appointment[] = [];
export const doctors: Doctor[] = [];
export const patients: Patient[] = [];
export const auditLogs: AuditLog[] = [];
