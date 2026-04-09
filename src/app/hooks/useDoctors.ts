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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const { data: doctors, error } = await supabase
        .from('doctors')
        .select('*')
        .order('name');

      if (error) throw error;
      setData((doctors || []).map(mapRow));
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

  return {
    data,
    loading,
    error,
    refetch: fetchDoctors,
    updateStatus,
  };
}
