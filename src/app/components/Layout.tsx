import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { DashboardPage } from "../pages/DashboardPage";
import { AppointmentsPage } from "../pages/AppointmentsPage";
import { DoctorsPage } from "../pages/DoctorsPage";
import { PatientsPage } from "../pages/PatientsPage";
import { ReportsPage } from "../pages/ReportsPage";
import { ChatPage } from "../pages/ChatPage";
import { NotificationsPage } from "../pages/NotificationsPage";
import { ClinicSettingsPage } from "../pages/ClinicSettingsPage";
import { AuditPage } from "../pages/AuditPage";
import { PatientAccountsPage } from "../pages/PatientAccountsPage";

const pageMeta: Record<
  string,
  { title: string; subtitle: string }
> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Overview of clinic operations",
  },
  appointments: {
    title: "Appointments",
    subtitle: "Manage patient appointment requests",
  },
  doctors: {
    title: "Doctor Management",
    subtitle: "View and manage clinic physicians",
  },
  patients: {
    title: "Patient Records",
    subtitle: "Patient profiles and consultation history",
  },
  reports: {
    title: "Reports",
    subtitle: "Generate and view clinic reports",
  },
  chat: {
    title: "Chat",
    subtitle: "Monitor and respond to patient conversations",
  },
  notifications: {
    title: "Notifications",
    subtitle: "Alerts and system updates",
  },
  "clinic-settings": {
    title: "Clinic Information",
    subtitle: "Manage clinic details and settings",
  },
  "patient-accounts": {
    title: "Patient Accounts",
    subtitle: "Manage patient access and account status",
  },
};

export function Layout() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const meta = pageMeta[currentPage] ?? {
    title: "Portal",
    subtitle: "",
  };

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage onNavigate={setCurrentPage} />;
      case "appointments":
        return <AppointmentsPage />;
      case "doctors":
        return <DoctorsPage />;
      case "patients":
        return <PatientsPage />;
      case "reports":
        return <ReportsPage />;
      case "chat":
        return <ChatPage />;
      case "notifications":
        return <NotificationsPage onNavigate={setCurrentPage} />;
      case "clinic-settings":
        return <ClinicSettingsPage />;
      case "patient-accounts":
        return <PatientAccountsPage />;
      case "audit":
        return <AuditPage />;
      default:
        return <DashboardPage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#F4F7FF" }}
    >
      {/* Sidebar — desktop */}
      <div className="hidden md:flex flex-col w-64 flex-shrink-0 h-full">
        <Sidebar
          currentPage={currentPage}
          onNavigate={(page) => {
            setCurrentPage(page);
            setSidebarOpen(false);
          }}
        />
      </div>

      {/* Sidebar — mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 md:hidden"
              style={{
                background: "rgba(10, 36, 99, 0.4)",
                backdropFilter: "blur(2px)",
              }}
            />
            <motion.div
              key="mobile-sidebar"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
              className="fixed left-0 top-0 bottom-0 w-64 z-50 md:hidden"
            >
              <Sidebar
                currentPage={currentPage}
                onNavigate={(page) => {
                  setCurrentPage(page);
                  setSidebarOpen(false);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          onNavigate={setCurrentPage}
        />
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
