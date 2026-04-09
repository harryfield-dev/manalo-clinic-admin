import { useEffect, useState, useMemo, type ChangeEvent, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Filter,
  Plus,
  Check,
  X,
  ChevronDown,
  Eye,
  Calendar,
  Clock,
  User,
  Stethoscope,
  ChevronRight,
  Phone,
  Mail,
  AlertTriangle,
  UserPlus,
  Shield,
  ImageOff,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useAppointments } from "../hooks/useAppointments";
import { useDoctors } from "../hooks/useDoctors";
import type { Appointment, AppointmentStatus, Doctor } from "../data/mockData";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { Calendar as DatePickerCalendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  formatPhilippineMobileForDisplay,
  formatPhilippineMobileInput,
  isValidPhilippineMobile,
  toInternationalPhilippineMobile,
} from "../lib/philippinePhone";
import { formatRegistrationSource, inferRegistrationSource } from "../lib/patientIdentity";

/* ─── config ─────────────────────────────────────────── */
const statusConfig = {
  pending: {
    bg: "#FEF3C7",
    text: "#D97706",
    border: "#FDE68A",
    label: "Pending",
  },
  approved: {
    bg: "#D1FAE5",
    text: "#059669",
    border: "#A7F3D0",
    label: "Approved",
  },
  rejected: {
    bg: "#FEE2E2",
    text: "#DC2626",
    border: "#FECACA",
    label: "Rejected",
  },
  completed: {
    bg: "#E8F1FF",
    text: "#1B4FD8",
    border: "#C7D7F8",
    label: "Completed",
  },
};

const idStatusConfig = {
  pending: { bg: "#FEF3C7", text: "#D97706", label: "Pending Review" },
  verified: { bg: "#D1FAE5", text: "#059669", label: "ID Verified" },
  rejected: { bg: "#FEE2E2", text: "#DC2626", label: "ID Rejected" },
} as const;

const typeConfig: Record<string, { bg: string; text: string; label: string }> = {
  "general-checkup": { bg: "#DBEAFE", text: "#1D4ED8", label: "General Check-up" },
  "follow-up": { bg: "#D1FAE5", text: "#059669", label: "Follow-up" },
  "lab-interpretation": { bg: "#FEF3C7", text: "#D97706", label: "Lab Interpretation" },
};

const WALK_IN_START = "07:00";
const WALK_IN_END = "14:00";
const WALK_IN_SLOT_INTERVAL = 30;
const ACTIVE_SLOT_STATUSES: AppointmentStatus[] = ["pending", "approved", "completed"];
const sourceConfig = {
  online: { bg: "#DBEAFE", text: "#1D4ED8", label: "Online" },
  "walk-in": { bg: "#FEF3C7", text: "#B45309", label: "Walk-In" },
} as const;

interface WalkInSlot {
  value: string;
  label: string;
  bookedCount: number;
  doctorBookedCount: number;
  disabled: boolean;
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTimeValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const meridiemMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (meridiemMatch) {
    let hours = Number(meridiemMatch[1]);
    const minutes = Number(meridiemMatch[2]);
    const period = meridiemMatch[3].toUpperCase();

    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const [hours = "0", minutes = "0"] = trimmed.split(":");
  return `${String(Number(hours)).padStart(2, "0")}:${String(Number(minutes)).padStart(2, "0")}`;
}

function timeToMinutes(time: string) {
  const normalized = normalizeTimeValue(time);
  if (!normalized) return 0;

  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatTimeLabel(time: string) {
  const normalized = normalizeTimeValue(time);
  if (!normalized) return "";

  const [hours, minutes] = normalized.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatRegisteredDate(value: string) {
  if (!value) return "Unknown";

  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isSunday(date: string) {
  if (!date) return false;
  return new Date(`${date}T00:00:00`).getDay() === 0;
}

function getWalkInSlots(selectedDate: string, appointments: Appointment[], doctorName: string): WalkInSlot[] {
  if (!selectedDate || isSunday(selectedDate)) return [];

  const today = getLocalDateString();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(WALK_IN_START);
  const endMinutes = timeToMinutes(WALK_IN_END);

  const activeAppointments = appointments.filter(
    (appointment) =>
      appointment.date === selectedDate &&
      ACTIVE_SLOT_STATUSES.includes(appointment.status),
  );

  const slots: WalkInSlot[] = [];

  for (let current = startMinutes; current <= endMinutes; current += WALK_IN_SLOT_INTERVAL) {
    const value = minutesToTime(current);
    const slotAppointments = activeAppointments.filter(
      (appointment) => normalizeTimeValue(appointment.time) === value,
    );

    slots.push({
      value,
      label: formatTimeLabel(value),
      bookedCount: slotAppointments.length,
      doctorBookedCount: doctorName
        ? slotAppointments.filter((appointment) => appointment.doctorName === doctorName).length
        : 0,
      disabled: selectedDate === today && current <= nowMinutes,
    });
  }

  return slots;
}

/* ─── Field component ────────────────────────────────── */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label
        style={{
          fontFamily: "var(--font-body)",
          color: "#6B7A99",
          fontSize: "0.75rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          display: "block",
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-xl outline-none transition-all";
const inputStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  border: "1.5px solid #E8F1FF",
  background: "#F4F7FF",
  color: "#0A2463",
};

/* ─── Walk-In Form Interface ─────────────────────────── */
interface WalkInForm {
  firstName: string;
  lastName: string;
  phone: string;
  dob: string;
  gender: string;
  address: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  doctorName: string;
  date: string;
  time: string;
  type: string;
  reason: string;
}

const emptyForm: WalkInForm = {
  firstName: "",
  lastName: "",
  phone: "",
  dob: "",
  gender: "",
  address: "",
  emergencyContactName: "",
  emergencyContactNumber: "",
  doctorName: "",
  date: "",
  time: "",
  type: "general-checkup",
  reason: "",
};

/* ─── Helper: filter past times for today ─────────────── */
/* ─── Walk-In Modal ──────────────────────────────────── */
function WalkInModal({
  onClose,
  onSubmit,
  doctors,
  appointments,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (payload: {
    appointment: Appointment;
    patientRecord: {
      full_name: string;
      email: string;
      contact_number: string;
      date_of_birth: string;
      gender: string;
      address: string;
      emergency_contact_name: string;
      emergency_contact_number: string;
    };
  }) => Promise<void>;
  doctors: Doctor[];
  appointments: Appointment[];
  isSubmitting: boolean;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WalkInForm>(emptyForm);
  const [dateError, setDateError] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const set =
    (k: keyof WalkInForm) =>
      (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }));

  const step1Valid =
    form.firstName &&
    form.lastName &&
    isValidPhilippineMobile(form.phone) &&
    form.gender &&
    form.dob &&
    (!form.emergencyContactNumber || isValidPhilippineMobile(form.emergencyContactNumber));
  const step2Valid = form.doctorName && form.date && form.time;
  const availableTimes = useMemo(
    () => getWalkInSlots(form.date, appointments, form.doctorName),
    [appointments, form.date, form.doctorName],
  );
  const selectedDayBookings = useMemo(
    () =>
      form.date
        ? appointments.filter(
          (appointment) =>
            appointment.date === form.date &&
            ACTIVE_SLOT_STATUSES.includes(appointment.status),
        ).length
        : 0,
    [appointments, form.date],
  );
  const selectedDoctorBookings = useMemo(
    () =>
      form.date && form.doctorName
        ? appointments.filter(
          (appointment) =>
            appointment.date === form.date &&
            appointment.doctorName === form.doctorName &&
            ACTIVE_SLOT_STATUSES.includes(appointment.status),
        ).length
        : 0,
    [appointments, form.date, form.doctorName],
  );

  useEffect(() => {
    if (!form.time) return;

    const selectedSlot = availableTimes.find(
      (slot) => slot.value === form.time && !slot.disabled,
    );

    if (!selectedSlot) {
      setForm((current) => ({ ...current, time: "" }));
    }
  }, [availableTimes, form.time]);

  const handleCalendarSelect = (date?: Date) => {
    if (!date) return;

    const nextDate = getLocalDateString(date);
    setForm((current) => ({ ...current, date: nextDate, time: "" }));
    setDateError("");
    setCalendarOpen(false);
  };

  const handlePhoneChange =
    (key: "phone" | "emergencyContactNumber") =>
      (e: ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhilippineMobileInput(e.target.value);
        setForm((current) => ({ ...current, [key]: formatted }));
      };

  const handleSubmit = async () => {
    if (isSubmitting || isSunday(form.date)) return;
    if (!isValidPhilippineMobile(form.phone)) return;
    if (form.emergencyContactNumber && !isValidPhilippineMobile(form.emergencyContactNumber)) return;

    const newApt: Appointment = {
      id: `a-walkin-${Date.now()}`,
      patientName: `${form.firstName} ${form.lastName}`.trim(),
      patientEmail: "",
      patientPhone: toInternationalPhilippineMobile(form.phone),
      doctorName: form.doctorName,
      date: form.date,
      time: form.time,
      type: form.type as Appointment['type'],
      status: 'approved',
      reason: form.reason,
      createdAt: new Date().toISOString(),
    };
    await onSubmit({
      appointment: newApt,
      patientRecord: {
        full_name: `${form.firstName} ${form.lastName}`.trim(),
        email: "",
        contact_number: toInternationalPhilippineMobile(form.phone),
        date_of_birth: form.dob,
        gender: form.gender,
        address: form.address,
        emergency_contact_name: form.emergencyContactName,
        emergency_contact_number: form.emergencyContactNumber
          ? toInternationalPhilippineMobile(form.emergencyContactNumber)
          : "",
      },
    });
  };

  const stepLabel = ["Patient Registration", "Appointment Details"];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10, 36, 99, 0.45)", backdropFilter: "blur(6px)" }}
      onClick={() => !isSubmitting && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "#fff", boxShadow: "0 24px 72px rgba(10, 36, 99, 0.28)", maxHeight: "92vh" }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #0A2463 0%, #1B4FD8 60%, #3A86FF 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 style={{ fontFamily: "var(--font-heading)", color: "#fff", fontSize: "1.1rem", fontWeight: 700 }}>
                Walk-In Registration
              </h3>
              <p style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.7)", fontSize: "0.78rem" }}>
                Step {step} of 2 — {stepLabel[step - 1]}
              </p>
            </div>
          </div>
          <button disabled={isSubmitting} onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "rgba(255,255,255,0.7)", opacity: isSubmitting ? 0.65 : 1 }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div
          className="flex flex-shrink-0"
          style={{ background: "#F4F7FF", borderBottom: "1px solid #E8F1FF" }}
        >
          {stepLabel.map((lbl, idx) => (
            <div key={lbl} className="flex-1 flex items-center gap-2 px-6 py-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: step > idx + 1 ? "#10B981" : step === idx + 1 ? "#1B4FD8" : "#E8F1FF",
                  color: step >= idx + 1 ? "#fff" : "#6B7A99",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-body)",
                }}
              >
                {step > idx + 1 ? <Check className="w-3 h-3" /> : idx + 1}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.8rem",
                  fontWeight: step === idx + 1 ? 600 : 400,
                  color: step === idx + 1 ? "#0A2463" : "#6B7A99",
                }}
              >
                {lbl}
              </span>
              {idx < stepLabel.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 ml-auto" style={{ color: "#C7D7F8" }} />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-5"
              >

                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name *">
                    <input className={inputCls} style={inputStyle} placeholder="e.g. Juan" value={form.firstName} onChange={set("firstName")} />
                  </Field>
                  <Field label="Last Name *">
                    <input className={inputCls} style={inputStyle} placeholder="e.g. dela Cruz" value={form.lastName} onChange={set("lastName")} />
                  </Field>
                </div>

                <Field label="Phone Number *">
                  <input
                    inputMode="numeric"
                    maxLength={12}
                    className={inputCls}
                    style={{
                      ...inputStyle,
                      borderColor: form.phone && !isValidPhilippineMobile(form.phone) ? "#FCA5A5" : "#E8F1FF",
                      background: form.phone && !isValidPhilippineMobile(form.phone) ? "#FFF7F7" : "#F4F7FF",
                    }}
                    placeholder="986-087-9876"
                    value={form.phone}
                    onChange={handlePhoneChange("phone")}
                  />
                  <div style={{ fontFamily: "var(--font-body)", color: form.phone && !isValidPhilippineMobile(form.phone) ? "#B91C1C" : "#6B7A99", fontSize: "0.74rem", marginTop: 6 }}>
                    {form.phone && !isValidPhilippineMobile(form.phone)
                      ? "Enter a valid mobile number starts with 9."
                      : "10 digits only, starts with 9. Saved as +63 format."}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date of Birth *">
                    <input type="date" className={inputCls} style={inputStyle} value={form.dob} onChange={set("dob")} />
                  </Field>
                  <Field label="Gender *">
                    <select className={inputCls} style={inputStyle} value={form.gender} onChange={set("gender")}>
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                </div>

                <Field label="Home Address">
                  <input className={inputCls} style={inputStyle} placeholder="Street, Barangay, City" value={form.address} onChange={set("address")} />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Emergency Contact Name">
                    <input className={inputCls} style={inputStyle} placeholder="e.g. Maria dela Cruz" value={form.emergencyContactName} onChange={set("emergencyContactName")} />
                  </Field>
                  <Field label="Emergency Contact Number">
                    <input
                      inputMode="numeric"
                      maxLength={12}
                      className={inputCls}
                      style={{
                        ...inputStyle,
                        borderColor: form.emergencyContactNumber && !isValidPhilippineMobile(form.emergencyContactNumber) ? "#FCA5A5" : "#E8F1FF",
                        background: form.emergencyContactNumber && !isValidPhilippineMobile(form.emergencyContactNumber) ? "#FFF7F7" : "#F4F7FF",
                      }}
                      placeholder="986-087-9876"
                      value={form.emergencyContactNumber}
                      onChange={handlePhoneChange("emergencyContactNumber")}
                    />
                    {form.emergencyContactNumber && !isValidPhilippineMobile(form.emergencyContactNumber) && (
                      <div style={{ fontFamily: "var(--font-body)", color: "#B91C1C", fontSize: "0.74rem", marginTop: 6 }}>
                        Emergency contact number must also be a valid mobile number.
                      </div>
                    )}
                  </Field>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                {/* Patient Summary */}
                <div
                  className="flex items-center gap-3 p-4 rounded-xl"
                  style={{ background: "#F4F7FF", border: "1px solid #E8F1FF" }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #1B4FD8, #3A86FF)", fontSize: "0.8rem", fontWeight: 700, fontFamily: "var(--font-body)" }}
                  >
                    {`${form.firstName} ${form.lastName}`.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-body)", color: "#0A2463", fontSize: "0.9rem", fontWeight: 700 }}>
                      {form.firstName} {form.lastName}
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem" }}>
                      {form.phone}
                    </div>
                  </div>
                  <span
                    className="ml-auto px-2.5 py-1 rounded-full text-white"
                    style={{ background: "#3A86FF", fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: 700 }}
                  >
                    WALK-IN
                  </span>
                </div>

                <Field label="Attending Doctor * (Active doctors only)">
                  <select className={inputCls} style={inputStyle} value={form.doctorName} onChange={set('doctorName')}>
                    <option value="">Select a doctor</option>
                    {doctors
                      .filter((d: Doctor) => d.status === 'active')
                      .map((d: Doctor) => (
                        <option key={d.id} value={d.name}>{d.name} — {d.specialization}</option>
                      ))}
                  </select>
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Appointment Date *">
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={`${inputCls} flex items-center justify-between text-left`}
                          style={{
                            ...inputStyle,
                            borderColor: dateError ? "#FCA5A5" : "#E8F1FF",
                            background: dateError ? "#FFF7F7" : "#F4F7FF",
                          }}
                        >
                          <span style={{ color: form.date ? "#0A2463" : "#6B7A99" }}>
                            {form.date
                              ? new Date(`${form.date}T00:00:00`).toLocaleDateString("en-PH", {
                                weekday: "long",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                              : "Select appointment date"}
                          </span>
                          <Calendar className="w-4 h-4" style={{ color: "#6B7A99" }} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <DatePickerCalendar
                          mode="single"
                          selected={form.date ? new Date(`${form.date}T00:00:00`) : undefined}
                          onSelect={handleCalendarSelect}
                          disabled={[
                            { before: new Date(`${getLocalDateString()}T00:00:00`) },
                            { dayOfWeek: [0] },
                          ]}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <div
                      className="mt-2 px-3 py-2 rounded-xl"
                      style={{
                        background: dateError ? "#FEF2F2" : "#F4F7FF",
                        border: `1px solid ${dateError ? "#FECACA" : "#E8F1FF"}`,
                      }}
                    >
                      <div style={{ fontFamily: "var(--font-body)", color: dateError ? "#B91C1C" : "#0A2463", fontSize: "0.78rem", fontWeight: 600 }}>
                        {dateError || "Walk-in hours are Monday to Saturday, 7:00 AM to 2:00 PM."}
                      </div>
                      {!dateError && (
                        <div style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.74rem", marginTop: 4 }}>
                          Sunday is closed for walk-in appointments.
                        </div>
                      )}
                    </div>
                  </Field>

                  <div
                    className="rounded-2xl p-4"
                    style={{ background: "#F9FBFF", border: "1px solid #E8F1FF" }}
                  >
                    <div style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Live Schedule Snapshot
                    </div>
                    <div style={{ fontFamily: "var(--font-heading)", color: "#0A2463", fontSize: "1rem", fontWeight: 700, marginTop: 8 }}>
                      {form.date ? new Date(`${form.date}T00:00:00`).toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric" }) : "Select a date first"}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="rounded-xl p-3" style={{ background: "#fff", border: "1px solid #E8F1FF" }}>
                        <div style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.72rem" }}>Booked for the day</div>
                        <div style={{ fontFamily: "var(--font-heading)", color: "#1B4FD8", fontSize: "1.2rem", fontWeight: 700, marginTop: 4 }}>
                          {selectedDayBookings}
                        </div>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "#fff", border: "1px solid #E8F1FF" }}>
                        <div style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.72rem" }}>With selected doctor</div>
                        <div style={{ fontFamily: "var(--font-heading)", color: "#059669", fontSize: "1.2rem", fontWeight: 700, marginTop: 4 }}>
                          {selectedDoctorBookings}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.74rem", marginTop: 10 }}>
                      Counts update from the live appointments database.
                    </div>
                  </div>
                </div>

                <Field label="Preferred Time *">
                  {!form.date ? (
                    <div className="rounded-xl px-4 py-3" style={{ background: "#F9FBFF", border: "1px dashed #C7D7F8", fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "#6B7A99" }}>
                      Select an appointment date to load the available walk-in slots.
                    </div>
                  ) : dateError ? (
                    <div className="rounded-xl px-4 py-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA", fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "#B91C1C" }}>
                      Sunday bookings are disabled. Please choose a Monday to Saturday schedule.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {availableTimes.map((slot) => {
                        const isSelected = form.time === slot.value;
                        return (
                          <button
                            key={slot.value}
                            type="button"
                            disabled={slot.disabled || isSubmitting}
                            onClick={() => !slot.disabled && !isSubmitting && setForm((current) => ({ ...current, time: slot.value }))}
                            className="rounded-2xl p-3 text-left transition-all"
                            style={{
                              background: isSelected ? "#E8F1FF" : slot.disabled ? "#F9FAFB" : "#fff",
                              border: `1.5px solid ${isSelected ? "#1B4FD8" : slot.disabled ? "#E5E7EB" : "#E8F1FF"}`,
                              opacity: slot.disabled ? 0.65 : 1,
                              boxShadow: isSelected ? "0 10px 24px rgba(27, 79, 216, 0.12)" : "none",
                              cursor: slot.disabled || isSubmitting ? "not-allowed" : "pointer",
                            }}
                          >
                            <div style={{ fontFamily: "var(--font-body)", color: isSelected ? "#1B4FD8" : "#0A2463", fontSize: "0.86rem", fontWeight: 700 }}>
                              {slot.label}
                            </div>
                            <div style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.74rem", marginTop: 6 }}>
                              {slot.bookedCount} patient{slot.bookedCount === 1 ? "" : "s"} booked
                            </div>
                            {form.doctorName && (
                              <div style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.72rem", marginTop: 2 }}>
                                {slot.doctorBookedCount} with {form.doctorName}
                              </div>
                            )}
                            <div style={{ fontFamily: "var(--font-body)", color: slot.disabled ? "#B45309" : isSelected ? "#1B4FD8" : "#059669", fontSize: "0.7rem", fontWeight: 700, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              {slot.disabled ? "Passed" : isSelected ? "Selected" : "Available"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Field>

                <Field label="Appointment Type">
                  <div className="grid grid-cols-2 gap-2">
                    {(["general-checkup", "follow-up", "lab-interpretation"] as const).map((t) => {
                      const tc = typeConfig[t];
                      return (
                        <button
                          key={t}
                          onClick={() => setForm((f) => ({ ...f, type: t }))}
                          className="py-2.5 px-3 rounded-xl transition-all text-left"
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: "0.82rem",
                            fontWeight: form.type === t ? 700 : 400,
                            background: form.type === t ? tc.bg : "#F4F7FF",
                            color: form.type === t ? tc.text : "#6B7A99",
                            border: `1.5px solid ${form.type === t ? tc.text + "40" : "#E8F1FF"}`,
                          }}
                        >
                          {tc.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>


                <div
                  className="flex items-start gap-2.5 p-3.5 rounded-xl"
                  style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#D97706" }} />
                  <p style={{ fontFamily: "var(--font-body)", color: "#92400E", fontSize: "0.78rem" }}>
                    Walk-in appointments are automatically set to <strong>Approved</strong>. The patient will be added to today's queue immediately.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex gap-3 flex-shrink-0"
          style={{ borderColor: "#E8F1FF", background: "#F9FBFF" }}
        >
          {step === 1 ? (
            <>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl border"
                style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "#6B7A99", borderColor: "#E8F1FF", opacity: isSubmitting ? 0.7 : 1 }}
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => !isSubmitting && step1Valid && setStep(2)}
                className="flex-1 py-2.5 rounded-xl text-white flex items-center justify-center gap-2"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  background: step1Valid && !isSubmitting ? "linear-gradient(135deg, #1B4FD8, #3A86FF)" : "#C7D7F8",
                  cursor: step1Valid && !isSubmitting ? "pointer" : "not-allowed",
                }}
              >
                Next: Appointment Details <ChevronRight className="w-4 h-4" />
              </motion.button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl border"
                style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "#6B7A99", borderColor: "#E8F1FF", opacity: isSubmitting ? 0.7 : 1 }}
              >
                ← Back
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => step2Valid && !isSubmitting && void handleSubmit()}
                className="flex-1 py-2.5 rounded-xl text-white flex items-center justify-center gap-2"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  background: step2Valid && !isSubmitting ? "linear-gradient(135deg, #059669, #10B981)" : "#C7D7F8",
                  cursor: step2Valid && !isSubmitting ? "pointer" : "not-allowed",
                }}
              >
                <Check className="w-4 h-4" /> {isSubmitting ? "Registering..." : "Register Walk-In"}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Action Modal ───────────────────────────────────── */
function ActionModal({
  type,
  appointment,
  onConfirm,
  onClose,
}: {
  type: "approve" | "reject" | "view";
  appointment: Appointment;
  onConfirm: (remarks?: string) => void;
  onClose: () => void;
}) {
  const [showLightbox, setShowLightbox] = useState(false);
  const [remarks, setRemarks] = useState("");
  const validIdUrl = appointment.validIdUrl || null;
  const registrationSource =
    appointment.registrationSource ||
    inferRegistrationSource({ email: appointment.patientEmail });

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(10, 36, 99, 0.4)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
          style={{ background: "#fff", boxShadow: "0 20px 60px rgba(10, 36, 99, 0.25)", maxHeight: "90vh" }}
        >
          {/* Header */}
          <div
            className="px-6 py-5 border-b flex items-center justify-between flex-shrink-0"
            style={{
              borderColor: "#E8F1FF",
              background: type === "approve" ? "#D1FAE5" : type === "reject" ? "#FEE2E2" : "#E8F1FF",
            }}
          >
            <h3 style={{ fontFamily: "var(--font-heading)", color: "#0A2463", fontSize: "1.1rem", fontWeight: 700 }}>
              {type === "approve" ? "Approve Appointment" : type === "reject" ? "Reject Appointment" : "Appointment Details"}
            </h3>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "#6B7A99" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Appointment details */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: "#F4F7FF" }}>
              {[
                { icon: User, label: "Patient", value: appointment.patientName },
                { icon: Stethoscope, label: "Doctor", value: appointment.doctorName },
                { icon: Mail, label: "Source", value: formatRegistrationSource(registrationSource) },
                {
                  icon: Calendar,
                  label: "Date",
                  value: new Date(appointment.date).toLocaleDateString("en-PH", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                  }),
                },
                { icon: Clock, label: "Time", value: formatTimeLabel(appointment.time) },
                { icon: Calendar, label: "Registered", value: formatRegisteredDate(appointment.createdAt) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#6B7A99" }} />
                  <div>
                    <span style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                      {label}
                    </span>
                    <p style={{ fontFamily: "var(--font-body)", color: "#0A2463", fontSize: "0.875rem", fontWeight: 500 }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Valid ID section (approve + view modes) ── */}
            {(type === "approve" || type === "view") && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "#E8F1FF" }}>
                    <Shield className="w-3.5 h-3.5" style={{ color: "#1B4FD8" }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-body)", color: "#0A2463", fontSize: "0.875rem", fontWeight: 700 }}>
                    Patient Valid ID
                  </span>
                </div>

                {validIdUrl ? (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E8F1FF" }}>
                    <div className="relative cursor-pointer" onClick={() => setShowLightbox(true)}>
                      <img
                        src={validIdUrl}
                        alt="Valid ID"
                        className="w-full object-cover"
                        style={{ maxHeight: 160, display: "block" }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 flex justify-start p-2.5"
                        style={{ background: "linear-gradient(to top, rgba(10,36,99,0.6) 0%, transparent 100%)" }}>
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={(e) => { e.stopPropagation(); setShowLightbox(true); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white"
                          style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)", fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 600, border: "1px solid rgba(255,255,255,0.3)" }}
                        >
                          <Eye className="w-3.5 h-3.5" /> View Full Size
                        </motion.button>
                      </div>
                    </div>
                    <div className="px-3 py-2" style={{ background: "#F4F7FF" }}>
                      <span style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem" }}>Click image to view fullscreen</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl flex flex-col items-center justify-center gap-2 py-6"
                    style={{ background: "#F9FBFF", border: "1.5px dashed #C7D7F8" }}>
                    <ImageOff className="w-8 h-8" style={{ color: "#C7D7F8" }} />
                    <span style={{ fontFamily: "var(--font-body)", color: "#9CA3AF", fontSize: "0.82rem" }}>No ID uploaded by patient</span>
                  </div>
                )}
              </div>
            )}

            {/* Rejection Remarks */}
            {type === "reject" && (
              <div className="pt-2">
                <label style={{ fontFamily: "var(--font-body)", color: "#0A2463", fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: 8 }}>
                  Reason for Rejection (Optional)
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  placeholder="Enter rejection reason to send to the patient..."
                  className="w-full rounded-xl px-4 py-3 outline-none resize-none"
                  style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', border: '1.5px solid #E8F1FF', background: '#F4F7FF', color: '#0A2463' }}
                />
              </div>
            )}
          </div>

          {/* Footer buttons for approve/reject appointment actions */}
          {type !== "view" && (
            <div className="px-6 pb-6 flex gap-3 flex-shrink-0">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border"
                style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "#6B7A99", borderColor: "#E8F1FF" }}
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onConfirm(type === "reject" ? remarks : undefined)}
                className="flex-1 py-3 rounded-xl text-white"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  background: type === "approve"
                    ? "linear-gradient(135deg, #059669, #10B981)"
                    : "linear-gradient(135deg, #DC2626, #EF4444)",
                }}
              >
                {type === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Lightbox overlay */}
      <AnimatePresence>
        {showLightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-6"
            style={{ background: "rgba(10, 36, 99, 0.85)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowLightbox(false)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl"
            >
              <button
                onClick={() => setShowLightbox(false)}
                className="absolute -top-4 -right-4 w-9 h-9 rounded-full flex items-center justify-center z-10"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}
              >
                <X className="w-4 h-4" />
              </button>
              {validIdUrl && (
                <img
                  src={validIdUrl}
                  alt="Valid ID — Full Size"
                  className="w-full rounded-2xl"
                  style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.55)", display: "block" }}
                />
              )}
              <p className="text-center mt-3" style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.65)", fontSize: "0.8rem" }}>
                Valid ID · {appointment.patientName}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Mark Complete Modal ────────────────────────────── */
function MarkCompleteModal({
  appointment,
  onConfirm,
  onClose,
  isLoading,
}: {
  appointment: Appointment;
  onConfirm: () => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10, 36, 99, 0.45)", backdropFilter: "blur(6px)" }}
      onClick={() => !isLoading && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "#fff", boxShadow: "0 24px 72px rgba(10,36,99,0.28)" }}
      >
        <div className="px-6 py-5 border-b" style={{ borderColor: "#E8F1FF", background: "#E8F1FF" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#1B4FD8" }}>
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <h3 style={{ fontFamily: "var(--font-heading)", color: "#0A2463", fontSize: "1.05rem", fontWeight: 700 }}>
                Mark as Completed
              </h3>
            </div>
            <button onClick={onClose} disabled={isLoading} className="p-1.5 rounded-lg" style={{ color: "#6B7A99" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p style={{ fontFamily: "var(--font-body)", color: "#0A2463", fontSize: "0.9rem" }}>
            Are you sure you want to mark <strong>{appointment.patientName}</strong>'s appointment as completed?
            The patient will be notified.
          </p>
          <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#F4F7FF" }}>
            <div style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem" }}>
              <span className="font-semibold text-[#0A2463]">Doctor:</span> {appointment.doctorName}
            </div>
            <div style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem" }}>
              <span className="font-semibold text-[#0A2463]">Date:</span>{" "}
              {new Date(`${appointment.date}T00:00:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl border"
              style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "#6B7A99", borderColor: "#E8F1FF", opacity: isLoading ? 0.7 : 1 }}
            >
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl text-white flex items-center justify-center gap-2"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.9rem",
                fontWeight: 600,
                background: isLoading ? "#C7D7F8" : "linear-gradient(135deg, #1B4FD8, #3A86FF)",
                cursor: isLoading ? "not-allowed" : "pointer",
              }}
            >
              <CheckCircle className="w-4 h-4" />
              {isLoading ? "Marking..." : "Mark Complete"}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main Page ──────────────────────────────────────── */
export function AppointmentsPage() {
  const {
    data: appointmentsData,
    loading,
    error,
    approveAppointment,
    rejectAppointment,
    createWalkin,
    creatingWalkin,
    deleteAppointment,
    refetch,
  } = useAppointments();
  const { data: doctorsData } = useDoctors();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDoctor, setFilterDoctor] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState<{
    type: "approve" | "reject" | "view";
    apt: Appointment;
  } | null>(null);
  const [appointmentToRemove, setAppointmentToRemove] = useState<Appointment | null>(null);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [markCompleteApt, setMarkCompleteApt] = useState<Appointment | null>(null);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const data = appointmentsData || [];
  const doctors = doctorsData || [];


  const handleMarkComplete = async () => {
    if (!markCompleteApt) return;
    setIsMarkingComplete(true);
    try {
      // Update appointment status
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', markCompleteApt.id);
      if (updateError) throw updateError;

      // Notify patient if we have their email
      if (markCompleteApt.patientEmail) {
        const { data: patient } = await supabase
          .from('patients')
          .select('id')
          .eq('email', markCompleteApt.patientEmail)
          .single();
        if (patient) {
          const aptDate = new Date(`${markCompleteApt.date}T00:00:00`).toLocaleDateString('en-PH', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          });
          await supabase.from('notifications').insert({
            patient_id: patient.id,
            patient_email: markCompleteApt.patientEmail,
            type: 'Approved',
            title: 'Appointment Completed',
            message: `Your appointment with ${markCompleteApt.doctorName} on ${aptDate} has been marked as completed. You can now rate your experience.`,
            timestamp: new Date().toISOString(),
            read: false,
          });
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        action: 'Appointment Completed',
        performed_by: 'Admin',
        target: markCompleteApt.patientName,
      });

      toast.success('Appointment marked as completed.');
      await refetch();
    } catch (err: any) {
      toast.error(`Failed to mark complete: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsMarkingComplete(false);
      setMarkCompleteApt(null);
    }
  };

  const filtered = useMemo(() => {
    return data.filter((a) => {
      const matchSearch =
        a.patientName.toLowerCase().includes(search.toLowerCase()) ||
        a.doctorName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || a.status === filterStatus;
      const matchDoctor = filterDoctor === "all" || a.doctorName === filterDoctor;
      const matchDate = !filterDate || a.date === filterDate;
      // "all" shows non-completed; specific status filters show that status
      if (filterStatus === "all") return matchSearch && matchDoctor && matchDate && a.status !== "completed";
      return matchSearch && matchStatus && matchDoctor && matchDate;
    });
  }, [data, search, filterStatus, filterDoctor, filterDate]);

  const handleAction = (type: "approve" | "reject" | "view", apt: Appointment) =>
    setModal({ type, apt });

  const handleConfirm = async (remarks?: string) => {
    if (!modal) return;
    try {
      if (modal.type === "approve") {
        await approveAppointment(modal.apt.id);
      } else {
        await rejectAppointment(modal.apt.id, remarks);
      }
    } catch (err) {
      // Error handled in hooks
    }
    setModal(null);
  };

  const handleRemoveAppointment = async () => {
    if (!appointmentToRemove) return;

    try {
      await deleteAppointment(appointmentToRemove);
    } catch (err) {
      // Error handled in hook
    }

    setAppointmentToRemove(null);
  };

  const statusCounts = Object.keys(statusConfig).reduce(
    (acc, s) => {
      acc[s] = data.filter((a) => a.status === s).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const statPills = [
    { key: 'pending', label: 'Pending', count: statusCounts.pending || 0, color: '#D97706', bg: '#FEF3C7' },
    { key: 'approved', label: 'Approved', count: statusCounts.approved || 0, color: '#059669', bg: '#D1FAE5' },
    { key: 'rejected', label: 'Rejected', count: statusCounts.rejected || 0, color: '#DC2626', bg: '#FEE2E2' },
    { key: 'completed', label: 'Completed', count: statusCounts.completed || 0, color: '#1B4FD8', bg: '#E8F1FF' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>

        </div>

      </div>


      {/* Status Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "All", count: data.filter((a) => a.status !== "completed").length },
          ...Object.entries(statusConfig).map(([k, v]) => ({ key: k, label: v.label, count: statusCounts[k] || 0 })),
        ].map((item) => (
          <motion.button
            key={item.key}
            onClick={() => setFilterStatus(item.key)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8rem",
              fontWeight: filterStatus === item.key ? 700 : 500,
              background:
                filterStatus === item.key
                  ? item.key === "all"
                    ? "#0A2463"
                    : statusConfig[item.key as keyof typeof statusConfig]?.bg || "#E8F1FF"
                  : "#fff",
              color:
                filterStatus === item.key
                  ? item.key === "all"
                    ? "#fff"
                    : statusConfig[item.key as keyof typeof statusConfig]?.text || "#0A2463"
                  : "#6B7A99",
              border: `1px solid ${filterStatus === item.key ? "transparent" : "#E8F1FF"}`,
            }}
          >
            {item.label}
            <span
              className="px-1.5 py-0.5 rounded-md"
              style={{
                background: filterStatus === item.key ? "rgba(255,255,255,0.2)" : "#F4F7FF",
                fontSize: "0.7rem",
                fontWeight: 700,
              }}
            >
              {item.count}
            </span>
          </motion.button>
        ))}
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: "0 8px 24px rgba(27, 79, 216, 0.3)" }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowWalkIn(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white ml-auto"
          style={{ background: "linear-gradient(135deg, #1B4FD8, #3A86FF)", fontFamily: "var(--font-body)", fontSize: "0.875rem", fontWeight: 600 }}
        >
          <Plus className="w-4 h-4" /> Walk-In Appointment
        </motion.button>
      </div>

      {/* Search & Advanced Filters */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "#fff", border: "1px solid #E8F1FF", boxShadow: "0 2px 12px rgba(10, 36, 99, 0.04)" }}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div
            className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border"
            style={{ background: "#F4F7FF", borderColor: "#E8F1FF" }}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: "#6B7A99" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient or doctor name…"
              className="bg-transparent outline-none flex-1"
              style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "#0A2463" }}
            />
          </div>
          <motion.button
            onClick={() => setShowFilters(!showFilters)}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
            style={{
              background: showFilters ? "#E8F1FF" : "#fff",
              borderColor: "#E8F1FF",
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              color: "#0A2463",
            }}
          >
            <Filter className="w-4 h-4" style={{ color: "#6B7A99" }} /> Filters
            <motion.div animate={{ rotate: showFilters ? 180 : 0 }}>
              <ChevronDown className="w-4 h-4" style={{ color: "#6B7A99" }} />
            </motion.div>
          </motion.button>
        </div>
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t mt-4"
                style={{ borderColor: "#E8F1FF" }}
              >
                <div>
                  <label style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                    Doctor
                  </label>
                  <select
                    value={filterDoctor}
                    onChange={(e) => setFilterDoctor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl outline-none"
                    style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", border: "1px solid #E8F1FF", background: "#F4F7FF", color: "#0A2463" }}
                  >
                    <option value="all">All Doctors</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl outline-none"
                    style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", border: "1px solid #E8F1FF", background: "#F4F7FF", color: "#0A2463" }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Appointments List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-5 rounded-2xl animate-pulse" style={{ background: '#F9FBFF', border: '1px solid #E8F1FF' }}>
                <div className="flex items-center gap-4 h-20">
                  <div className="w-12 h-12 rounded-full" style={{ background: '#E8F1FF' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-48" />
                    <div className="h-3 bg-gray-200 rounded w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl p-12 text-center" style={{ background: "#fff", border: "1px solid #E8F1FF" }}>
            <AlertTriangle className="w-12 h-12 mx-auto mb-3" style={{ color: "#F59E0B" }} />
            <p style={{ fontFamily: "var(--font-heading)", color: "#0A2463", fontSize: "1rem", fontWeight: 700 }}>
              Error loading appointments
            </p>
            <p style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.85rem", marginTop: 4 }}>
              {error}. Please refresh.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: "#fff", border: "1px solid #E8F1FF" }}
          >
            <Calendar className="w-12 h-12 mx-auto mb-3" style={{ color: "#C7D7F8" }} />
            <p style={{ fontFamily: "var(--font-heading)", color: "#0A2463", fontSize: "1rem", fontWeight: 700 }}>
              No appointments found
            </p>
            <p style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.85rem", marginTop: 4 }}>
              Try adjusting your filters or search terms
            </p>
          </div>
        ) : (
          filtered.map((apt, i) => {
            const sc = statusConfig[apt.status as keyof typeof statusConfig];
            const tc = typeConfig[apt.type] ?? { bg: "#F4F7FF", text: "#6B7A99", label: apt.type };
            const hasId = !!(apt.validIdUrl && apt.validIdUrl.trim());
            const registrationSource =
              apt.registrationSource ||
              inferRegistrationSource({ email: apt.patientEmail });
            const sourceBadge = sourceConfig[registrationSource];
            return (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl p-5"
                style={{ background: "#fff", border: "1px solid #E8F1FF", boxShadow: "0 2px 8px rgba(10, 36, 99, 0.04)" }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #1B4FD8, #3A86FF)", fontSize: "0.85rem", fontWeight: 700, fontFamily: "var(--font-body)" }}
                    >
                      {apt.patientName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ fontFamily: "var(--font-body)", color: "#0A2463", fontSize: "0.9rem", fontWeight: 700 }}>
                          {apt.patientName}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-md"
                          style={{ background: tc.bg, color: tc.text, fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: 600 }}
                        >
                          {tc.label}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-md"
                          style={{ background: sourceBadge.bg, color: sourceBadge.text, fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: 700 }}
                        >
                          {sourceBadge.label}
                        </span>
                        {sc && (
                          <span
                            className="px-2.5 py-0.5 rounded-full"
                            style={{ background: sc.bg, color: sc.text, fontFamily: "var(--font-body)", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}
                          >
                            {sc.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1" style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem" }}>
                          <Stethoscope className="w-3 h-3" /> {apt.doctorName}
                        </span>
                        <span className="flex items-center gap-1" style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem" }}>
                          <Calendar className="w-3 h-3" />{" "}
                          {new Date(apt.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="flex items-center gap-1" style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem" }}>
                          <Clock className="w-3 h-3" /> {formatTimeLabel(apt.time)}
                        </span>
                        <span className="flex items-center gap-1" style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem" }}>
                          <Phone className="w-3 h-3" /> {formatPhilippineMobileForDisplay(apt.patientPhone)}
                        </span>
                        <span className="flex items-center gap-1" style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem" }}>
                          <Calendar className="w-3 h-3" /> Registered {formatRegisteredDate(apt.createdAt)}
                        </span>
                      </div>
                      {apt.reason && (
                        <p className="mt-1 truncate" style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem" }}>
                          <Mail className="w-3 h-3 inline mr-1" />{apt.reason}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* ID Status badge */}
                  {hasId ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-shrink-0"
                      style={{ background: "#D1FAE5", border: "1px solid #A7F3D030" }}>
                      <Shield className="w-3 h-3 flex-shrink-0" style={{ color: "#059669" }} />
                      <span style={{ fontFamily: "var(--font-body)", color: "#059669", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                        ID Uploaded
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-shrink-0"
                      style={{ background: "#F4F7FF", border: "1px solid #E8F1FF" }}>
                      <Shield className="w-3 h-3 flex-shrink-0" style={{ color: "#9CA3AF" }} />
                      <span style={{ fontFamily: "var(--font-body)", color: "#9CA3AF", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                        No ID
                      </span>
                    </div>
                  )}

                  {apt.status === "pending" && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleAction("approve", apt)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white"
                        style={{ background: "linear-gradient(135deg, #059669, #10B981)", fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 600 }}
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleAction("reject", apt)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl"
                        style={{ background: "#FEE2E2", color: "#DC2626", fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 600 }}
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleAction("view", apt)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: "#E8F1FF" }}
                      >
                        <Eye className="w-4 h-4" style={{ color: "#1B4FD8" }} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setAppointmentToRemove(apt)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: "#FEE2E2" }}
                        title="Remove appointment"
                      >
                        <Trash2 className="w-4 h-4" style={{ color: "#DC2626" }} />
                      </motion.button>
                    </div>
                  )}
                  {apt.status === "approved" && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setMarkCompleteApt(apt)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl"
                        style={{ background: "#E8F1FF", color: "#1B4FD8", fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 600 }}
                        title="Mark as completed"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Mark Complete
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleAction("view", apt)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: "#E8F1FF" }}
                      >
                        <Eye className="w-4 h-4" style={{ color: "#1B4FD8" }} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setAppointmentToRemove(apt)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: "#FEE2E2" }}
                        title="Remove appointment"
                      >
                        <Trash2 className="w-4 h-4" style={{ color: "#DC2626" }} />
                      </motion.button>
                    </div>
                  )}
                  {(apt.status === "rejected" || apt.status === "completed") && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleAction("view", apt)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: "#E8F1FF" }}
                      >
                        <Eye className="w-4 h-4" style={{ color: "#1B4FD8" }} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setAppointmentToRemove(apt)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: "#FEE2E2" }}
                        title="Remove appointment"
                      >
                        <Trash2 className="w-4 h-4" style={{ color: "#DC2626" }} />
                      </motion.button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal && (
          <ActionModal
            type={modal.type}
            appointment={modal.apt}
            onConfirm={handleConfirm}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {markCompleteApt && (
          <MarkCompleteModal
            appointment={markCompleteApt}
            onConfirm={handleMarkComplete}
            onClose={() => !isMarkingComplete && setMarkCompleteApt(null)}
            isLoading={isMarkingComplete}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWalkIn && (
          <WalkInModal
            doctors={doctors}
            appointments={data}
            isSubmitting={creatingWalkin}
            onClose={() => setShowWalkIn(false)}
            onSubmit={async ({ appointment, patientRecord }) => {
              try {
                await createWalkin({
                  patient_name: appointment.patientName,
                  patient_email: appointment.patientEmail,
                  patient_phone: appointment.patientPhone,
                  doctor_name: appointment.doctorName,
                  date: appointment.date,
                  time: appointment.time,
                  type: appointment.type,
                  reason: appointment.reason,
                  status: 'approved' as AppointmentStatus,
                  patient_record: patientRecord,
                });
                setShowWalkIn(false);
              } catch (err) {
                // Error handled in hook
              }
            }}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!appointmentToRemove}
        title={`Remove ${appointmentToRemove?.patientName || "appointment"}?`}
        description="This will permanently delete the appointment from the database."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleRemoveAppointment}
        onCancel={() => setAppointmentToRemove(null)}
      />
    </div>
  );
}
