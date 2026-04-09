import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Calendar,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { formatPhilippineMobileForDisplay } from "../lib/philippinePhone";
import { supabase } from "../lib/supabase";

type PatientStatus = "active" | "suspended" | "deleted";
type FilterKey = "all" | "active" | "suspended" | "deleted";

interface PatientRow {
  id: string;
  full_name: string | null;
  email: string | null;
  contact_number: string | null;
  created_at: string | null;
  status: PatientStatus | null;
  suspended_until: string | null;
  suspension_reason: string | null;
}

const DURATIONS = [
  { label: "1 day", value: 1 },
  { label: "3 days", value: 3 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
];

function patientName(patient: PatientRow) {
  return patient.full_name?.trim() || "Unnamed Patient";
}

function remainingDays(until: string | null) {
  if (!until) return 0;
  const diff = new Date(until).getTime() - Date.now();
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}

function effectiveStatus(patient: PatientRow): PatientStatus {
  if (patient.status === "deleted") return "deleted";
  if (patient.status === "suspended" && remainingDays(patient.suspended_until) > 0) return "suspended";
  return "active";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ patient }: { patient: PatientRow }) {
  const status = effectiveStatus(patient);
  if (status === "suspended") {
    const days = remainingDays(patient.suspended_until);
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "#FEE2E2", color: "#DC2626" }}>
        <UserX className="h-3 w-3" />
        {`Suspended (${days} ${days === 1 ? "day" : "days"} left)`}
      </span>
    );
  }
  if (status === "deleted") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "#E5E7EB", color: "#6B7280" }}>
        <Trash2 className="h-3 w-3" />
        Deleted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "#D1FAE5", color: "#059669" }}>
      <UserCheck className="h-3 w-3" />
      Active
    </span>
  );
}

function SuspendModal({
  patient,
  busy,
  onClose,
  onSubmit,
}: {
  patient: PatientRow;
  busy: boolean;
  onClose: () => void;
  onSubmit: (days: number, reason: string) => void;
}) {
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] flex items-center justify-center p-4"
        style={{ background: "rgba(10,36,99,0.5)", backdropFilter: "blur(4px)" }}
        onClick={busy ? undefined : onClose}
      >
        <motion.div
          initial={{ scale: 0.96, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 12 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-white"
          style={{ boxShadow: "0 24px 72px rgba(10,36,99,0.25)" }}
        >
          <div className="border-b px-6 py-5" style={{ borderColor: "#E8F1FF", background: "#FEF2F2" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "#FEE2E2" }}>
                <Shield className="h-5 w-5" style={{ color: "#DC2626" }} />
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-heading)", color: "#0A2463", fontSize: "1rem", fontWeight: 700 }}>Suspend Account</div>
                <div style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.85rem" }}>{patientName(patient)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-6">
            <div>
              <label className="mb-2 block" style={{ fontFamily: "var(--font-body)", color: "#0A2463", fontSize: "0.85rem", fontWeight: 600 }}>
                Suspension Duration
              </label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full rounded-xl px-4 py-3 outline-none"
                style={{ fontFamily: "var(--font-body)", border: "1.5px solid #E8F1FF", background: "#F4F7FF", color: "#0A2463" }}
              >
                {DURATIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block" style={{ fontFamily: "var(--font-body)", color: "#0A2463", fontSize: "0.85rem", fontWeight: 600 }}>
                Suspension Reason
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Optional reason..."
                className="w-full resize-none rounded-xl px-4 py-3 outline-none"
                style={{ fontFamily: "var(--font-body)", border: "1.5px solid #E8F1FF", background: "#F4F7FF", color: "#0A2463" }}
              />
            </div>
          </div>

          <div className="flex gap-3 px-6 pb-6">
            <button onClick={onClose} disabled={busy} className="flex-1 rounded-xl border py-2.5 text-sm" style={{ fontFamily: "var(--font-body)", color: "#6B7A99", borderColor: "#E8F1FF" }}>
              Cancel
            </button>
            <button onClick={() => setConfirmOpen(true)} disabled={busy} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white" style={{ fontFamily: "var(--font-body)", background: "linear-gradient(135deg, #DC2626, #EF4444)" }}>
              {busy ? "Suspending..." : "Suspend Account"}
            </button>
          </div>
        </motion.div>
      </motion.div>

      <ConfirmModal
        open={confirmOpen}
        title={`Suspend ${patientName(patient)}?`}
        description={`This will suspend the account for ${days} ${days === 1 ? "day" : "days"}.`}
        confirmLabel="Yes, Suspend"
        variant="danger"
        onConfirm={() => {
          setConfirmOpen(false);
          onSubmit(days, reason.trim());
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

export function PatientAccountsPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [suspendTarget, setSuspendTarget] = useState<PatientRow | null>(null);
  const [unsuspendTarget, setUnsuspendTarget] = useState<PatientRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatientRow | null>(null);
  const [recoverTarget, setRecoverTarget] = useState<PatientRow | null>(null);

  const loadPatients = useCallback(async () => {
    setLoading(true);

    const { error: syncError } = await supabase
      .from("patients")
      .update({ status: "active", suspended_until: null, suspension_reason: null })
      .eq("status", "suspended")
      .lt("suspended_until", new Date().toISOString());

    if (syncError) toast.error(`Failed to sync expired suspensions: ${syncError.message}`);

    const { data, error } = await supabase
      .from("patients")
      .select("id, full_name, email, contact_number, created_at, status, suspended_until, suspension_reason")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(`Failed to load patients: ${error.message}`);
      setPatients([]);
    } else {
      setPatients((data || []) as PatientRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const counts = useMemo(
    () =>
      patients.reduce(
        (acc, patient) => {
          acc.all += 1;
          const s = effectiveStatus(patient);
          if (s === "active") acc.active += 1;
          if (s === "suspended") acc.suspended += 1;
          if (s === "deleted") acc.deleted += 1;
          return acc;
        },
        { all: 0, active: 0, suspended: 0, deleted: 0 },
      ),
    [patients],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesSearch = !q || patientName(patient).toLowerCase().includes(q) || (patient.email || "").toLowerCase().includes(q);
      const status = effectiveStatus(patient);
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && status === "active") ||
        (filter === "suspended" && status === "suspended") ||
        (filter === "deleted" && status === "deleted");
      return matchesSearch && matchesFilter;
    });
  }, [filter, patients, search]);

  const suspendPatient = useCallback(async (patient: PatientRow, days: number, reason: string) => {
    setBusy(true);
    const suspendedUntil = new Date(Date.now() + days * 86400000).toISOString();
    const { error } = await supabase
      .from("patients")
      .update({ status: "suspended", suspended_until: suspendedUntil, suspension_reason: reason || null })
      .eq("id", patient.id);

    if (error) {
      toast.error(`Failed to suspend account: ${error.message}`);
      setBusy(false);
      return;
    }

    toast.success(`${patientName(patient)} has been suspended.`);
    setSuspendTarget(null);
    setBusy(false);
    await loadPatients();
  }, [loadPatients]);

  const unsuspendPatient = useCallback(async (patient: PatientRow) => {
    setBusy(true);
    const { error } = await supabase
      .from("patients")
      .update({ status: "active", suspended_until: null, suspension_reason: null })
      .eq("id", patient.id);

    if (error) {
      toast.error(`Failed to unsuspend account: ${error.message}`);
      setBusy(false);
      return;
    }

    toast.success(`${patientName(patient)} has been unsuspended.`);
    setUnsuspendTarget(null);
    setBusy(false);
    await loadPatients();
  }, [loadPatients]);

  const recoverPatient = useCallback(async (patient: PatientRow) => {
    setBusy(true);
    const { error } = await supabase
      .from("patients")
      .update({ status: "active", suspended_until: null, suspension_reason: null })
      .eq("id", patient.id);

    if (error) {
      toast.error(`Failed to recover account: ${error.message}`);
      setBusy(false);
      return;
    }

    toast.success(`${patientName(patient)}'s account has been recovered.`);
    setRecoverTarget(null);
    setBusy(false);
    await loadPatients();
  }, [loadPatients]);

  const deletePatient = useCallback(async (patient: PatientRow) => {
    setBusy(true);

    // Soft delete: mark as deleted so it can be recovered later
    const { error } = await supabase
      .from("patients")
      .update({ status: "deleted", suspended_until: null, suspension_reason: null })
      .eq("id", patient.id);

    if (error) {
      toast.error(`Failed to delete account: ${error.message}`);
      setBusy(false);
      return;
    }

    toast.success(`${patientName(patient)}'s account has been marked as deleted. You can recover it anytime from the Deleted tab.`);
    setDeleteTarget(null);
    setBusy(false);
    await loadPatients();
  }, [loadPatients]);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <AnimatePresence>
        {suspendTarget && (
          <SuspendModal
            patient={suspendTarget}
            busy={busy}
            onClose={() => setSuspendTarget(null)}
            onSubmit={(days, reason) => suspendPatient(suspendTarget, days, reason)}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!unsuspendTarget}
        title={`Unsuspend ${unsuspendTarget ? patientName(unsuspendTarget) : "patient"}?`}
        description="This will restore the patient's access immediately."
        confirmLabel={busy ? "Unsuspending..." : "Yes, Unsuspend"}
        variant="success"
        onConfirm={() => unsuspendTarget && unsuspendPatient(unsuspendTarget)}
        onCancel={() => !busy && setUnsuspendTarget(null)}
      />

      <ConfirmModal
        open={!!recoverTarget}
        title={`Recover ${recoverTarget ? patientName(recoverTarget) : "patient"}'s account?`}
        description="This will restore the deleted account and allow the patient to log in again."
        confirmLabel={busy ? "Recovering..." : "Yes, Recover Account"}
        variant="success"
        onConfirm={() => recoverTarget && recoverPatient(recoverTarget)}
        onCancel={() => !busy && setRecoverTarget(null)}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title={`Delete ${deleteTarget ? patientName(deleteTarget) : "patient"}'s account?`}
        description="The account will be marked as deleted and the patient won't be able to log in. Their data is preserved and you can restore the account anytime using the 'Recover Account' button."
        confirmLabel={busy ? "Deleting..." : "Delete Account"}
        variant="danger"
        onConfirm={() => deleteTarget && deletePatient(deleteTarget)}
        onCancel={() => !busy && setDeleteTarget(null)}
      />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

        <button onClick={loadPatients} className="flex items-center gap-2 rounded-xl border px-4 py-2 ml-auto" style={{ fontFamily: "var(--font-body)", color: "#6B7A99", borderColor: "#E8F1FF", background: "#fff" }}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total Patients", value: counts.all, icon: Users, bg: "#E8F1FF", color: "#1B4FD8" },
          { label: "Active", value: counts.active, icon: UserCheck, bg: "#D1FAE5", color: "#059669" },
          { label: "Suspended", value: counts.suspended, icon: ShieldOff, bg: "#FEE2E2", color: "#DC2626" },
          { label: "Deleted", value: counts.deleted, icon: Trash2, bg: "#F3F4F6", color: "#6B7280" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="flex items-center gap-4 rounded-2xl border bg-white p-5" style={{ borderColor: "#E8F1FF", boxShadow: "0 2px 12px rgba(10,36,99,0.06)" }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: card.bg }}>
                <Icon className="h-5 w-5" style={{ color: card.color }} />
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-heading)", color: "#0A2463", fontSize: "1.35rem", fontWeight: 700 }}>{card.value}</div>
                <div style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.78rem" }}>{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border bg-white px-3 py-2.5" style={{ borderColor: "#E8F1FF" }}>
          <Search className="h-4 w-4" style={{ color: "#6B7A99" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." className="flex-1 bg-transparent outline-none" style={{ fontFamily: "var(--font-body)", color: "#0A2463" }} />
        </div>
        <div className="flex overflow-hidden rounded-xl border" style={{ borderColor: "#E8F1FF" }}>
          {(["all", "active", "suspended", "deleted"] as const).map((key) => (
            <button key={key} onClick={() => setFilter(key)} className="px-4 py-2 text-sm font-medium capitalize" style={{ fontFamily: "var(--font-body)", background: filter === key ? "#0A2463" : "#fff", color: filter === key ? "#fff" : "#6B7A99" }}>
              {key} ({counts[key]})
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "#E8F1FF", boxShadow: "0 2px 12px rgba(10,36,99,0.06)" }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            <span style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.875rem" }}>Loading patients...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Users className="h-10 w-10" style={{ color: "#C7D7F8" }} />
            <span style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.875rem" }}>No patients found</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr style={{ background: "#F4F7FF", borderBottom: "1px solid #E8F1FF" }}>
                  {["Name", "Email", "Contact", "Date Registered", "Status", "Actions"].map((heading) => (
                    <th key={heading} className="px-5 py-3.5 text-left" style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((patient) => {
                  const status = effectiveStatus(patient);
                  const isSuspended = status === "suspended";
                  const isDeleted = status === "deleted";
                  return (
                    <tr key={patient.id} className="border-b align-top" style={{ borderColor: "#F4F7FF" }}>
                      <td className="px-5 py-4">
                        <div style={{ fontFamily: "var(--font-body)", color: "#0A2463", fontSize: "0.875rem", fontWeight: 600 }}>{patientName(patient)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5" style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.82rem" }}>
                          <Mail className="h-3.5 w-3.5" />
                          {patient.email || "-"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5" style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.82rem" }}>
                          <Phone className="h-3.5 w-3.5" />
                          {formatPhilippineMobileForDisplay(patient.contact_number) || patient.contact_number || "-"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5" style={{ fontFamily: "var(--font-body)", color: "#6B7A99", fontSize: "0.82rem" }}>
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(patient.created_at)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge patient={patient} />
                        {isSuspended && patient.suspension_reason && (
                          <div className="mt-2 flex items-start gap-1.5" style={{ fontFamily: "var(--font-body)", color: "#9CA3AF", fontSize: "0.72rem" }}>
                            <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                            <span>{patient.suspension_reason}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {!isDeleted && !isSuspended && (
                            <button onClick={() => setSuspendTarget(patient)} className="rounded-xl px-3 py-1.5 text-xs font-semibold" style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                              Suspend Account
                            </button>
                          )}
                          {isSuspended && (
                            <button onClick={() => setUnsuspendTarget(patient)} className="rounded-xl px-3 py-1.5 text-xs font-semibold" style={{ background: "#D1FAE5", color: "#059669", border: "1px solid #A7F3D0" }}>
                              Unsuspend
                            </button>
                          )}
                          {!isDeleted && (
                            <button onClick={() => setDeleteTarget(patient)} className="rounded-xl px-3 py-1.5 text-xs font-semibold" style={{ background: "#FEE2E2", color: "#DC2626", border: "1px solid #FECACA" }}>
                              Delete Account
                            </button>
                          )}
                          {isDeleted && (
                            <button onClick={() => setRecoverTarget(patient)} className="rounded-xl px-3 py-1.5 text-xs font-semibold" style={{ background: "#D1FAE5", color: "#059669", border: "1px solid #A7F3D0" }}>
                              Recover Account
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
