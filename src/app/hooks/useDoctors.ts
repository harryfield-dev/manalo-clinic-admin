import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Doctor, DoctorStatus } from '../data/mockData';
import { normalizeDoctorSchedule } from '../lib/doctorSchedule';

function mapRow(d: any): Doctor {
  return {
    id: d.id,
    name: d.name,
    specialization: d.specialization,
    email: d.email,
    phone: d.phone,
    photo: d.photo || '',
    status: d.status as DoctorStatus,
    licenseNo: d.license_no || '',
    bio: d.bio || '',
    schedule: normalizeDoctorSchedule(d.schedule),
    consultationsToday: d.consultations_today || 0,
    totalPatients: d.total_patients || 0,
  };
}

export function useDoctors() {
  const [data, setData] = useState<Doctor[]>([]);
  const [deletedData, setDeletedData] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const [activeRes, deletedRes] = await Promise.all([
        supabase
          .from('doctors')
          .select('*')
          .is('deleted_at', null)
          .order('name'),
        supabase
          .from('doctors')
          .select('*')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false }),
      ]);

      if (activeRes.error) throw activeRes.error;
      if (deletedRes.error) throw deletedRes.error;

      setData((activeRes.data || []).map(mapRow));
      setDeletedData((deletedRes.data || []).map(mapRow));
    } catch (err: any) {
      console.error('Error fetching doctors:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const updateStatus = async (id: string, status: DoctorStatus) => {
    const { error } = await supabase.from('doctors').update({ status }).eq('id', id);
    if (!error) {
      setData(prev => prev.map(d => d.id === id ? { ...d, status } : d));
    }
    return !error;
  };

  const deleteDoctor = async (id: string) => {
    const { error } = await supabase.from('doctors').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    await fetchDoctors();
  };

  const recoverDoctor = async (id: string) => {
    const { error } = await supabase.from('doctors').update({ deleted_at: null }).eq('id', id);
    if (error) throw error;
    await fetchDoctors();
  };

  const permanentlyDeleteDoctor = async (id: string) => {
    const { error } = await supabase.from('doctors').delete().eq('id', id);
    if (error) throw error;
    await fetchDoctors();
  };

  return {
    data,
    deletedData,
    loading,
    error,
    refetch: fetchDoctors,
    updateStatus,
    deleteDoctor,
    recoverDoctor,
    permanentlyDeleteDoctor,
  };
}
