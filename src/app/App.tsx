import { AnimatePresence, motion } from 'motion/react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Layout } from './components/Layout';
import { MAINTENANCE_MODE } from './lib/maintenance';
import { MaintenancePage } from './MaintenancePage';
function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#F4F7FF' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1B4FD8, #3A86FF)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
              }}
            />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              color: '#0A2463',
              fontSize: '1.1rem',
              fontWeight: 700,
            }}
          >
            Manalo Medical Clinic
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              color: '#6B7A99',
              fontSize: '0.875rem',
            }}
          >
            Loading portal...
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {isAuthenticated ? (
        <motion.div
          key="portal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{ height: '100vh' }}
        >
          <Layout />
        </motion.div>
      ) : (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <LoginPage />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  // Maintenance mode bypasses all providers and auth logic entirely
  if (MAINTENANCE_MODE) return <MaintenancePage />;

  return (
    <AuthProvider>
      <AppContent />
      <Toaster
        position="top-right"
        expand={false}
        richColors
        closeButton
        toastOptions={{
          style: {
            fontFamily: 'var(--font-body)',
            borderRadius: '14px',
            fontSize: '0.875rem',
            border: '1px solid #E8F1FF',
          },
          duration: 4000,
        }}
      />
    </AuthProvider>
  );
}