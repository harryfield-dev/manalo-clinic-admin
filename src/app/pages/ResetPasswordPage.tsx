import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, Shield, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const C = {
  navy: '#0A2463', blue: '#1B4FD8', blueLight: '#3A86FF',
  bg: '#F0F4FF', card: '#FFFFFF', border: '#DDE5F8',
  inputBg: '#F6F9FF', muted: '#6B7A99', error: '#EF4444', success: '#16A34A',
} as const;

export function ResetPasswordPage({ onDone }: { onDone: () => void }) {
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState('');
  const [done,        setDone]        = useState(false);
  const [countdown,   setCountdown]   = useState(4);
  const [touched,     setTouched]     = useState({ password: false, confirm: false });

  // Auto-redirect to login after success
  useEffect(() => {
    if (!done) return;
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timer); onDone(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [done, onDone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ password: true, confirm: true });
    if (!password || password.length < 8) return;
    if (password !== confirm) return;
    setIsLoading(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
    } else {
      await supabase.auth.signOut();
      setDone(true);
    }
    setIsLoading(false);
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
        {/* ── Success State ────────────────────────────────── */}
        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem' }}
          >
            <div style={{
              width: '4rem', height: '4rem', borderRadius: '50%',
              background: 'linear-gradient(135deg, #16A34A, #4ADE80)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(22,163,74,0.3)',
            }}>
              <span style={{ fontSize: '1.8rem' }}>🎉</span>
            </div>

            <div>
              <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.4rem', fontWeight: 800, color: C.navy }}>
                Password Changed!
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: C.muted, lineHeight: 1.6 }}>
                Congratulations! Your password has been updated successfully.
              </p>
            </div>

            <div style={{
              width: '100%', padding: '0.75rem 1rem', borderRadius: '0.6rem',
              background: '#F0FDF4', border: '1px solid #BBF7D0',
              fontSize: '0.82rem', color: '#15803D',
            }}>
              Redirecting to Sign In in <strong>{countdown}s</strong>…
            </div>

            <button
              type="button" onClick={onDone}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                background: `linear-gradient(135deg, ${C.navy}, ${C.blue})`,
                color: '#fff', border: 'none', cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-body)',
              }}
            >
              Go to Sign In now
            </button>
          </motion.div>
        ) : (
          /* ── Form State ─────────────────────────────────── */
          <>
            <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.35rem', fontWeight: 700, color: C.navy }}>
              Set New Password
            </h2>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.82rem', color: C.muted, lineHeight: 1.55 }}>
              Choose a strong new password for your admin account.
            </p>
            <div style={{ height: '1px', background: C.border, marginBottom: '1.5rem' }} />

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* New password */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.navy, marginBottom: '0.375rem' }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '0.85rem', height: '0.85rem', color: C.muted, pointerEvents: 'none' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, password: true }))}
                    placeholder="Min. 8 characters"
                    style={{
                      width: '100%', paddingTop: '0.65rem', paddingBottom: '0.65rem',
                      paddingLeft: '2.35rem', paddingRight: '2.5rem', borderRadius: '0.5rem',
                      border: `1.5px solid ${touched.password && password.length < 8 ? C.error : C.border}`,
                      background: C.inputBg, color: C.navy, fontSize: '0.875rem',
                      outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'var(--font-body)',
                    }}
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)} style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: C.muted,
                  }}>
                    {showPass ? <EyeOff style={{ width: '0.85rem', height: '0.85rem' }} /> : <Eye style={{ width: '0.85rem', height: '0.85rem' }} />}
                  </button>
                </div>
                {touched.password && password.length < 8 && (
                  <p style={{ color: C.error, fontSize: '0.7rem', margin: '0.3rem 0 0' }}>
                    Password must be at least 8 characters
                  </p>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.navy, marginBottom: '0.375rem' }}>
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '0.85rem', height: '0.85rem', color: C.muted, pointerEvents: 'none' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, confirm: true }))}
                    placeholder="Repeat new password"
                    style={{
                      width: '100%', paddingTop: '0.65rem', paddingBottom: '0.65rem',
                      paddingLeft: '2.35rem', paddingRight: '1rem', borderRadius: '0.5rem',
                      border: `1.5px solid ${touched.confirm && password !== confirm ? C.error : C.border}`,
                      background: C.inputBg, color: C.navy, fontSize: '0.875rem',
                      outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'var(--font-body)',
                    }}
                  />
                </div>
                {touched.confirm && password !== confirm && (
                  <p style={{ color: C.error, fontSize: '0.7rem', margin: '0.3rem 0 0' }}>
                    Passwords do not match
                  </p>
                )}
              </div>

              {error && (
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0.65rem 0.875rem', borderRadius: '0.5rem', background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <AlertCircle style={{ width: '0.875rem', height: '0.875rem', color: C.error, flexShrink: 0 }} />
                  <span style={{ color: '#DC2626', fontSize: '0.8rem' }}>{error}</span>
                </div>
              )}

              <motion.button
                type="submit" disabled={isLoading}
                whileHover={!isLoading ? { y: -1.5, boxShadow: '0 8px 24px rgba(27,79,216,0.30)' } : {}}
                whileTap={!isLoading ? { scale: 0.98 } : {}}
                style={{
                  width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                  border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                  background: isLoading ? C.muted : `linear-gradient(135deg, ${C.navy} 0%, ${C.blue} 60%, ${C.blueLight} 100%)`,
                  color: '#fff', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-body)',
                }}
              >
                {isLoading ? 'Updating…' : 'Change Password'}
              </motion.button>
            </form>
          </>
        )}

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