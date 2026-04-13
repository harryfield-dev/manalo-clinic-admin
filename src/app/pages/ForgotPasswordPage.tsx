import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Key, AlertCircle, Shield, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

const C = {
  navy: '#0A2463', blue: '#1B4FD8', blueLight: '#3A86FF',
  bg: '#F0F4FF', card: '#FFFFFF', border: '#DDE5F8',
  inputBg: '#F6F9FF', muted: '#6B7A99', error: '#EF4444',
} as const;

type Step = 'email' | 'otp';

export function ForgotPasswordPage({
  onBack,
  onVerified,
}: {
  onBack: () => void;
  onVerified: () => void;
}) {
  const [step,      setStep]      = useState<Step>('email');
  const [email,     setEmail]     = useState('');
  const [otp,       setOtp]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState('');
  const [touched,   setTouched]   = useState(false);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  /* ── Step 1: send reset code ──────────────────────────── */
  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (!email.trim() || !isValidEmail(email)) return;
    setIsLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: window.location.origin }   // keeps Supabase happy but we won't use the link
    );
    setIsLoading(false);
    if (err) { setError(err.message); return; }
    setStep('otp');
  };

  /* ── Step 2: verify OTP ───────────────────────────────── */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) { setError('Please enter the full 6-digit code.'); return; }
    setIsLoading(true);
    setError('');
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type:  'recovery',
    });
    setIsLoading(false);
    if (err) { setError(err.message); return; }
    onVerified();   // ← recovery session is now active → show ResetPasswordPage
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: C.bg, padding: '1.5rem',
      fontFamily: 'var(--font-body)',
    }}>
      {/* grid bg */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(27,79,216,0.035) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(27,79,216,0.035) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: '400px',
          background: C.card, borderRadius: '1rem', border: `1px solid ${C.border}`,
          boxShadow: '0 4px 32px rgba(10,36,99,0.09)', padding: '2.5rem 2.25rem',
        }}
      >
        {/* back button */}
        <button
          type="button"
          onClick={step === 'otp' ? () => { setStep('email'); setOtp(''); setError(''); } : onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            fontSize: '0.78rem', color: C.muted, background: 'none', border: 'none',
            cursor: 'pointer', padding: 0, marginBottom: '1.5rem',
          }}
        >
          <ArrowLeft style={{ width: '0.78rem', height: '0.78rem' }} />
          {step === 'otp' ? 'Back' : 'Back to Sign In'}
        </button>

        <AnimatePresence mode="wait">
          {/* ── STEP 1: Email ─────────────────────────────── */}
          {step === 'email' && (
            <motion.div key="email"
              initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
            >
              <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.35rem', fontWeight: 700, color: C.navy }}>
                Forgot Password
              </h2>
              <p style={{ margin: '0 0 1.5rem', fontSize: '0.82rem', color: C.muted, lineHeight: 1.55 }}>
                Enter your admin email and we'll send a 6-digit reset code.
              </p>
              <div style={{ height: '1px', background: C.border, marginBottom: '1.5rem' }} />

              <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.navy, marginBottom: '0.375rem' }}>
                    Email address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '0.85rem', height: '0.85rem', color: C.muted, pointerEvents: 'none' }} />
                    <input
                      type="text" value={email}
                      onChange={e => setEmail(e.target.value)}
                      onBlur={() => setTouched(true)}
                      placeholder="admin@manaloclinic.com"
                      style={{
                        width: '100%', paddingTop: '0.65rem', paddingBottom: '0.65rem',
                        paddingLeft: '2.35rem', paddingRight: '1rem', borderRadius: '0.5rem',
                        border: `1.5px solid ${touched && (!email.trim() || !isValidEmail(email)) ? C.error : C.border}`,
                        background: C.inputBg, color: C.navy, fontSize: '0.875rem',
                        outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'var(--font-body)',
                      }}
                    />
                  </div>
                  {touched && !email.trim() && (
                    <p style={{ color: C.error, fontSize: '0.7rem', margin: '0.3rem 0 0' }}>Email is required</p>
                  )}
                  {touched && email.trim() && !isValidEmail(email) && (
                    <p style={{ color: C.error, fontSize: '0.7rem', margin: '0.3rem 0 0' }}>Please enter a valid email</p>
                  )}
                </div>

                {error && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.65rem 0.875rem', borderRadius: '0.5rem', background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <AlertCircle style={{ width: '0.875rem', height: '0.875rem', color: C.error, flexShrink: 0 }} />
                    <span style={{ color: '#DC2626', fontSize: '0.8rem' }}>{error}</span>
                  </div>
                )}

                <motion.button type="submit" disabled={isLoading}
                  whileHover={!isLoading ? { y: -1.5, boxShadow: '0 8px 24px rgba(27,79,216,0.30)' } : {}}
                  whileTap={!isLoading ? { scale: 0.98 } : {}}
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                    border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                    background: isLoading ? C.muted : `linear-gradient(135deg, ${C.navy} 0%, ${C.blue} 60%, ${C.blueLight} 100%)`,
                    color: '#fff', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-body)',
                  }}
                >
                  {isLoading ? 'Sending…' : 'Send Reset Code'}
                </motion.button>
              </form>
            </motion.div>
          )}

          {/* ── STEP 2: OTP ───────────────────────────────── */}
          {step === 'otp' && (
            <motion.div key="otp"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            >
              <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.35rem', fontWeight: 700, color: C.navy }}>
                Enter Reset Code
              </h2>
              <p style={{ margin: '0 0 1.5rem', fontSize: '0.82rem', color: C.muted, lineHeight: 1.55 }}>
                We sent a 6-digit code to{' '}
                <strong style={{ color: C.navy }}>{email}</strong>. Enter it below.
              </p>
              <div style={{ height: '1px', background: C.border, marginBottom: '1.5rem' }} />

              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.navy, marginBottom: '0.375rem' }}>
                    6-digit Code
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Key style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '0.85rem', height: '0.85rem', color: C.muted, pointerEvents: 'none' }} />
                    <input
                      type="text" value={otp}
                      onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                      placeholder="• • • • • •"
                      maxLength={6}
                      autoFocus
                      style={{
                        width: '100%', paddingTop: '0.85rem', paddingBottom: '0.85rem',
                        paddingLeft: '2.35rem', paddingRight: '1rem', borderRadius: '0.5rem',
                        border: `1.5px solid ${C.border}`, background: C.inputBg, color: C.navy,
                        fontSize: '1.5rem', letterSpacing: '0.5rem', textAlign: 'center',
                        outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'monospace',
                      }}
                    />
                  </div>
                </div>

                {error && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.65rem 0.875rem', borderRadius: '0.5rem', background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <AlertCircle style={{ width: '0.875rem', height: '0.875rem', color: C.error, flexShrink: 0 }} />
                    <span style={{ color: '#DC2626', fontSize: '0.8rem' }}>{error}</span>
                  </div>
                )}

                <motion.button type="submit" disabled={isLoading || otp.length < 6}
                  whileHover={!isLoading && otp.length >= 6 ? { y: -1.5, boxShadow: '0 8px 24px rgba(27,79,216,0.30)' } : {}}
                  whileTap={!isLoading && otp.length >= 6 ? { scale: 0.98 } : {}}
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: 'none',
                    cursor: isLoading || otp.length < 6 ? 'not-allowed' : 'pointer',
                    background: isLoading || otp.length < 6
                      ? C.muted
                      : `linear-gradient(135deg, ${C.navy} 0%, ${C.blue} 60%, ${C.blueLight} 100%)`,
                    color: '#fff', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-body)',
                  }}
                >
                  {isLoading ? 'Verifying…' : 'Verify Code →'}
                </motion.button>

                <button type="button" onClick={handleSendCode} disabled={isLoading}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: C.blue, fontSize: '0.78rem', fontFamily: 'var(--font-body)', padding: 0,
                  }}
                >
                  Didn't receive it? Resend code
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{
          marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
        }}>
          <Shield style={{ width: '0.72rem', height: '0.72rem', color: C.muted }} />
          <span style={{ fontSize: '0.68rem', color: C.muted }}>Authorized clinic staff only</span>
        </div>
      </motion.div>
    </div>
  );
}