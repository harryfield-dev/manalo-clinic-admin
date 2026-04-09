import type { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "success";
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "danger",
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(10, 36, 99, 0.55)", backdropFilter: "blur(4px)" }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: "#fff",
              boxShadow: "0 24px 72px rgba(10, 36, 99, 0.25)",
              fontFamily: "var(--font-body)",
            }}
          >
            {/* Icon header */}
            <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: variant === "danger" ? "#FEE2E2" : "#D1FAE5" }}
              >
                {variant === "danger" ? (
                  <AlertTriangle size={26} style={{ color: "#DC2626" }} />
                ) : (
                  <CheckCircle size={26} style={{ color: "#059669" }} />
                )}
              </div>
              <h3
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "#0A2463",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  marginBottom: "0.5rem",
                }}
              >
                {title}
              </h3>
              <p style={{ color: "#6B7A99", fontSize: "0.875rem", lineHeight: 1.6 }}>
                {description}
              </p>
            </div>

            {/* Optional extra content */}
            {children && <div className="px-6 pb-2">{children}</div>}

            {/* Buttons */}
            <div className="flex gap-3 px-6 pb-6 pt-2">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all hover:bg-gray-50"
                style={{ color: "#6B7A99", borderColor: "#E8F1FF", fontFamily: "var(--font-body)" }}
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
                style={{
                  background:
                    variant === "danger"
                      ? "linear-gradient(135deg, #DC2626, #EF4444)"
                      : "linear-gradient(135deg, #059669, #10B981)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
