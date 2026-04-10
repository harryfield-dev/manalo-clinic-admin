import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { Appointment, AppointmentStatus } from '../data/mockData';
import {
  normalizePhilippineMobileDigits,
  toInternationalPhilippineMobile,
} from '../lib/philippinePhone';
import {
  getPatientIdentityKey,
  inferRegistrationSource,
  normalizePatientName,
} from '../lib/patientIdentity';

interface PatientRecordInput {
  full_name: string;
  email?: string;
  contact_number: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_number?: string;
  valid_id_url?: string;
}

interface WalkinPatientRecordInput extends PatientRecordInput {
  notes?: string;
  created_by?: string;
}

function mapRow(a: any): Appointment {
  return {
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
  };
}

export function useAppointments() {
  const [data, setData] = useState<Appointment[]>([]);
  const [deletedData, setDeletedData] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingWalkin, setCreatingWalkin] = useState(false);
  const walkinRequestsRef = useRef(new Set<string>());

  const normalizeName = (value: string) =>
    normalizePatientName(value);

  const normalizeEmail = (value: string) =>
    value.trim().toLowerCase();

  const normalizePhone = (value: string) =>
    normalizePhilippineMobileDigits(value);

  const findMatchingPatient = (rows: any[], payload: PatientRecordInput) => {
    const identityKey = getPatientIdentityKey({
      email: payload.email,
      phone: payload.contact_number,
      name: payload.full_name,
    });

    return rows.find((row) => {
      const rowKey = getPatientIdentityKey({
        email: row.email,
        phone: row.contact_number,
        name: row.full_name,
        fallbackId: row.id,
      });

      return rowKey === identityKey;
    });
  };

  const ensurePatientRecord = async (payload: PatientRecordInput) => {
    const { data: patientRows, error: patientLookupError } = await supabase
      .from('patients')
      .select('id, full_name, email, contact_number, date_of_birth, gender, address, emergency_contact_name, emergency_contact_number, valid_id_url, status')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (patientLookupError) throw patientLookupError;

    const existingPatient = findMatchingPatient(patientRows || [], payload);
    const normalizedEmail = payload.email?.trim().toLowerCase() || '';
    const normalizedPhone = normalizePhone(payload.contact_number || '');

    if (existingPatient) {
      const updatePayload: Record<string, unknown> = {};

      if (!existingPatient.full_name && payload.full_name) updatePayload.full_name = payload.full_name;
      if (!existingPatient.email && normalizedEmail) updatePayload.email = normalizedEmail;
      if (!existingPatient.contact_number && normalizedPhone) updatePayload.contact_number = payload.contact_number;
      if (!existingPatient.date_of_birth && payload.date_of_birth) updatePayload.date_of_birth = payload.date_of_birth;
      if (!existingPatient.gender && payload.gender) updatePayload.gender = payload.gender;
      if (!existingPatient.address && payload.address) updatePayload.address = payload.address;
      if (!existingPatient.emergency_contact_name && payload.emergency_contact_name) {
        updatePayload.emergency_contact_name = payload.emergency_contact_name;
      }
      if (!existingPatient.emergency_contact_number && payload.emergency_contact_number) {
        updatePayload.emergency_contact_number = payload.emergency_contact_number;
      }
      if (!existingPatient.valid_id_url && payload.valid_id_url) updatePayload.valid_id_url = payload.valid_id_url;
      if (!existingPatient.status) updatePayload.status = 'active';

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await supabase
          .from('patients')
          .update(updatePayload)
          .eq('id', existingPatient.id);

        if (updateError) throw updateError;
      }

      return existingPatient.id as string;
    }

    const insertPayload = {
      full_name: payload.full_name,
      email: normalizedEmail || null,
      contact_number: payload.contact_number || null,
      date_of_birth: payload.date_of_birth || null,
      gender: payload.gender || null,
      address: payload.address || null,
      emergency_contact_name: payload.emergency_contact_name || null,
      emergency_contact_number: payload.emergency_contact_number || null,
      valid_id_url: payload.valid_id_url || null,
      status: 'active',
    };

    const { data: insertedPatient, error: insertError } = await supabase
      .from('patients')
      .insert([insertPayload])
      .select('id')
      .single();

    if (insertError) throw insertError;

    return insertedPatient?.id as string;
  };

  const ensureWalkinPatientRecord = async (payload: WalkinPatientRecordInput) => {
    const { data: walkinRows, error: walkinLookupError } = await supabase
      .from('patient_walkin')
      .select('id, full_name, email, contact_number, date_of_birth, gender, address, emergency_contact_name, emergency_contact_number, valid_id_url')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (walkinLookupError) throw walkinLookupError;

    const existingWalkin = findMatchingPatient(walkinRows || [], payload);
    const normalizedEmail = payload.email?.trim().toLowerCase() || '';

    if (existingWalkin) {
      return existingWalkin.id as string;
    }

    const insertPayload = {
      full_name: payload.full_name,
      email: normalizedEmail || null,
      contact_number: payload.contact_number || null,
      date_of_birth: payload.date_of_birth || null,
      gender: payload.gender || null,
      address: payload.address || null,
      emergency_contact_name: payload.emergency_contact_name || null,
      emergency_contact_number: payload.emergency_contact_number || null,
      valid_id_url: payload.valid_id_url || null,
      notes: payload.notes || null,
      created_by: payload.created_by || null,
    };

    const { data: insertedWalkin, error: insertError } = await supabase
      .from('patient_walkin')
      .insert([insertPayload])
      .select('id')
      .single();

    if (insertError) throw insertError;

    return insertedWalkin?.id as string;
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const [activeRes, deletedRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('appointments')
          .select('*')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false }),
      ]);

      if (activeRes.error) throw activeRes.error;
      if (deletedRes.error) throw deletedRes.error;

      setData((activeRes.data || []).map(mapRow));
      setDeletedData((deletedRes.data || []).map(mapRow));
    } catch (err: any) {
      console.error('[fetchAppointments] error:', err);
      setError(err.message);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  // Realtime subscription — refetch on any change
  useEffect(() => {
    const channel = supabase
      .channel('appointments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchAppointments();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const approveAppointment = async (id: string) => {
  try {
    toast.loading('Approving appointment...');
    const { data: appointmentRow, error: appointmentLookupError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (appointmentLookupError) throw appointmentLookupError;

    // ── FIX: only create patient record for online appointments ──
    let patientId = appointmentRow.patient_id || null;
    if (appointmentRow.registration_source !== 'walk-in') {
      patientId = await ensurePatientRecord({
        full_name: appointmentRow.patient_name || 'Unnamed Patient',
        email: appointmentRow.patient_email || '',
        contact_number: appointmentRow.patient_phone || '',
        valid_id_url: appointmentRow.valid_id_url || '',
      });
    }

    const { error: err } = await supabase
      .from('appointments')
      .update({ status: 'approved', patient_id: patientId })
      .eq('id', id);
    if (err) throw err;

    // ── Send notification to patient ──
    if (appointmentRow.patient_email) {
      const aptDate = appointmentRow.date
        ? new Date(appointmentRow.date + 'T12:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : 'your scheduled date';
      await supabase.from('notifications').insert({
        id: `notif-approve-${id}-${Date.now()}`,
        patient_id: patientId,
        patient_email: appointmentRow.patient_email,
        type: 'Approved',
        title: 'Appointment Approved! ✅',
        message: `Great news! Your appointment on ${aptDate} at ${appointmentRow.time} with ${appointmentRow.doctor_name || 'the clinic doctor'} has been approved. Please arrive 10 minutes early.`,
        timestamp: new Date().toISOString(),
        read: false,
      });
    }

    toast.dismiss();
    toast.success('Appointment approved!');
    await fetchAppointments();
  } catch (err: any) {
    console.error('[approveAppointment] error:', err);
    toast.dismiss();
    toast.error(`Failed to approve: ${err?.message || 'Unknown error'}`);
  }
};
  const rejectAppointment = async (id: string, remarks?: string) => {
    try {
      toast.loading('Rejecting appointment...');

      // Fetch appointment details for notification
      const { data: aptData } = await supabase.from('appointments').select('*').eq('id', id).is('deleted_at', null).single();

      const { error: err } = await supabase
        .from('appointments')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (err) throw err;

      // ── Always send notification to patient ──
      if (aptData?.patient_email) {
        const { data: patient } = await supabase.from('patients').select('id').eq('email', aptData.patient_email).is('deleted_at', null).maybeSingle();
        const aptDate = aptData.date
          ? new Date(aptData.date + 'T12:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
          : 'your scheduled date';
        const notifMessage = remarks?.trim()
          ? `Your appointment on ${aptDate} has been rejected. Reason: ${remarks.trim()}`
          : `Your appointment request on ${aptDate} was not approved by the clinic. Please contact us for details or book a new appointment.`;
        await supabase.from('notifications').insert({
          id: `notif-reject-${id}-${Date.now()}`,
          patient_id: patient?.id ?? aptData.patient_id ?? null,
          patient_email: aptData.patient_email,
          type: 'Rejected',
          title: 'Appointment Not Approved',
          message: notifMessage,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }

      toast.dismiss();
      toast.success('Appointment rejected.');
      await fetchAppointments();
    } catch (err: any) {
      console.error('[rejectAppointment] error:', err);
      toast.dismiss();
      toast.error(`Failed to reject: ${err?.message || 'Unknown error'}`);
    }
  };

  const completeAppointment = async (id: string) => {
    try {
      toast.loading('Marking as completed...');

      const { data: aptData } = await supabase.from('appointments').select('*').eq('id', id).is('deleted_at', null).single();

      const { error: err } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', id);

      if (err) throw err;

      // ── Send Completed notification to patient ──
      if (aptData?.patient_email) {
        const { data: patient } = await supabase.from('patients').select('id').eq('email', aptData.patient_email).is('deleted_at', null).maybeSingle();
        const aptDate = aptData.date
          ? new Date(aptData.date + 'T12:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
          : 'your appointment';
        await supabase.from('notifications').insert({
          id: `notif-complete-${id}-${Date.now()}`,
          patient_id: patient?.id ?? aptData.patient_id ?? null,
          patient_email: aptData.patient_email,
          type: 'Completed',
          title: 'Appointment Completed ✓',
          message: `Your appointment on ${aptDate} has been marked as completed. We hope your visit went well! You can now leave a review from your appointments page.`,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }

      toast.dismiss();
      toast.success('Appointment marked as completed.');
      await fetchAppointments();
    } catch (err: any) {
      console.error('[completeAppointment] error:', err);
      toast.dismiss();
      toast.error(`Failed to mark as complete: ${err?.message || 'Unknown error'}`);
    }
  };

  const createWalkin = async (form: {
    patient_name: string;
    patient_email: string;
    patient_phone: string;
    doctor_name: string;
    date: string;
    time: string;
    type: string;
    reason: string;
    status: AppointmentStatus;
    patient_record?: PatientRecordInput;
  }) => {
    const normalizedPhoneValue = normalizePhone(form.patient_phone);
    const storedPhone = normalizedPhoneValue
      ? toInternationalPhilippineMobile(normalizedPhoneValue)
      : form.patient_phone;

    const requestKey = [
      normalizeName(form.patient_name),
      normalizeEmail(form.patient_email),
      normalizedPhoneValue,
      form.date,
      form.time,
    ].join('|');

    if (walkinRequestsRef.current.has(requestKey)) {
      toast.error('This walk-in registration is already being submitted.');
      return null;
    }

    walkinRequestsRef.current.add(requestKey);
    setCreatingWalkin(true);

    try {
      toast.loading('Creating walk-in...');

      const normalizedName = normalizeName(form.patient_name);
      const normalizedEmail = normalizeEmail(form.patient_email);
      const normalizedPhone = normalizedPhoneValue;

      const { data: existingRows, error: duplicateError } = await supabase
        .from('appointments')
        .select('id, patient_name, patient_email, patient_phone, status')
        .is('deleted_at', null)
        .eq('date', form.date)
        .eq('time', form.time)
        .in('status', ['pending', 'approved', 'completed']);

      if (duplicateError) throw duplicateError;

      const hasDuplicate = (existingRows || []).some((row: any) => {
        const samePhone =
          !!normalizedPhone &&
          normalizePhone(row.patient_phone || '') === normalizedPhone;
        const sameEmail =
          !!normalizedEmail &&
          normalizeEmail(row.patient_email || '') === normalizedEmail;
        const sameName =
          normalizeName(row.patient_name || '') === normalizedName;

        return samePhone || sameEmail || (!normalizedPhone && !normalizedEmail && sameName);
      });

      if (hasDuplicate) {
        throw new Error('This patient already has an appointment in the selected time slot.');
      }

      await ensureWalkinPatientRecord({
        full_name: form.patient_record?.full_name || form.patient_name,
        email: form.patient_record?.email || form.patient_email,
        contact_number: storedPhone,
        date_of_birth: form.patient_record?.date_of_birth,
        gender: form.patient_record?.gender,
        address: form.patient_record?.address,
        emergency_contact_name: form.patient_record?.emergency_contact_name,
        emergency_contact_number: form.patient_record?.emergency_contact_number,
        valid_id_url: form.patient_record?.valid_id_url,
      });

      const appointmentPayload = {
        patient_name: form.patient_name,
        patient_email: form.patient_email,
        patient_phone: storedPhone,
        patient_id: null,
        doctor_name: form.doctor_name,
        date: form.date,
        time: form.time,
        type: form.type,
        reason: form.reason,
        status: form.status,
        registration_source: 'walk-in',
        valid_id_url: form.patient_record?.valid_id_url || null,
      };

      const { data: insertedRow, error: err } = await supabase
        .from('appointments')
        .insert([appointmentPayload])
        .select('*')
        .single();

      if (err) throw err;
      toast.dismiss();
      toast.success(`Walk-in created for ${form.patient_name}!`);
      await fetchAppointments();
      return insertedRow ? mapRow(insertedRow) : null;
    } catch (err: any) {
      toast.dismiss();
      toast.error(`Failed to create walk-in: ${err?.message || 'Unknown error'}`);
      throw err;
    } finally {
      walkinRequestsRef.current.delete(requestKey);
      setCreatingWalkin(false);
    }
  };

  const deleteAppointment = async (appointment: Appointment) => {
    try {
      toast.loading('Removing appointment...');
      const { error: deleteError } = await supabase
        .from('appointments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', appointment.id);

      if (deleteError) throw deleteError;

      toast.dismiss();
      toast.success(`Moved ${appointment.patientName}'s appointment to Recently Deleted.`);
      await fetchAppointments();
    } catch (err: any) {
      toast.dismiss();
      toast.error(`Failed to remove appointment: ${err?.message || 'Unknown error'}`);
      throw err;
    }
  };

  const recoverAppointment = async (appointment: Appointment) => {
    try {
      toast.loading('Recovering appointment...');
      const { error } = await supabase
        .from('appointments')
        .update({ deleted_at: null })
        .eq('id', appointment.id);

      if (error) throw error;

      toast.dismiss();
      toast.success(`Recovered appointment for ${appointment.patientName}.`);
      await fetchAppointments();
    } catch (err: any) {
      toast.dismiss();
      toast.error(`Failed to recover appointment: ${err?.message || 'Unknown error'}`);
      throw err;
    }
  };

  const permanentlyDeleteAppointment = async (appointment: Appointment) => {
    try {
      toast.loading('Deleting appointment permanently...');
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointment.id);

      if (error) throw error;

      toast.dismiss();
      toast.success(`Permanently deleted ${appointment.patientName}'s appointment.`);
      await fetchAppointments();
    } catch (err: any) {
      toast.dismiss();
      toast.error(`Failed to remove appointment: ${err?.message || 'Unknown error'}`);
      throw err;
    }
  };

  return {
    data,
    deletedData,
    loading,
    error,
    approveAppointment,
    rejectAppointment,
    completeAppointment,
    creatingWalkin,
    createWalkin,
    deleteAppointment,
    recoverAppointment,
    permanentlyDeleteAppointment,
    refetch: fetchAppointments,
  };
}
