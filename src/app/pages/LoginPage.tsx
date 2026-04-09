import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Lock, Mail, AlertCircle, CheckCircle, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

/* ─── colour tokens ──────────────────────────────────────────── */
const C = {
  navy:      '#0A2463',
  blue:      '#1B4FD8',
  blueLight: '#3A86FF',
  bg:        '#F0F4FF',        // very faint blue-tinted page bg
  card:      '#FFFFFF',
  border:    '#DDE5F8',
  inputBg:   '#F6F9FF',
  muted:     '#6B7A99',
  error:     '#EF4444',
  success:   '#16A34A',
} as const;

/* ─── tiny reusable label ────────────────────────────────────── */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block',
      fontSize: '0.78rem',
      fontWeight: 600,
      color: C.navy,
      fontFamily: 'var(--font-body)',
      marginBottom: '0.375rem',
      letterSpacing: '0.02em',
    }}>
      {children}
    </label>
  );
}

export function LoginPage() {
  const { login, loginTimestamp, user } = useAuth();
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState(false);
  const [touched,      setTouched]      = useState({ email: false, password: false });

  /* welcome toast after successful login */
  useEffect(() => {
    if (loginTimestamp && user && success) {
      const dateStr = loginTimestamp.toLocaleDateString('en-PH', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      });
      const timeStr = loginTimestamp.toLocaleTimeString('en-PH', {
        hour: '2-digit', minute: '2-digit',
      });
      toast(`Welcome back, ${user.name}. Last login: ${dateStr} at ${timeStr}.`, {
        duration: 7000,
      });
    }
  }, [loginTimestamp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!email.trim() || !password.trim()) return;
    setError('');
    setIsLoading(true);
    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || 'Login failed. Please check your credentials.');
    } else {
      setSuccess(true);
    }
    setIsLoading(false);
  };

  /* shared input focus/blur border logic */
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = C.blue;
    e.currentTarget.style.boxShadow   = `0 0 0 3px rgba(27,79,216,0.10)`;
  };
  const onBlurInput = (
    e: React.FocusEvent<HTMLInputElement>,
    hasError: boolean,
  ) => {
    e.currentTarget.style.borderColor = hasError ? C.error : C.border;
    e.currentTarget.style.boxShadow   = 'none';
  };

  /* ── shared input style builder ─────────────────────────── */
  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width:          '100%',
    paddingTop:     '0.65rem',
    paddingBottom:  '0.65rem',
    paddingLeft:    '2.35rem',
    paddingRight:   '2.5rem',
    borderRadius:   '0.5rem',
    border:         `1.5px solid ${hasError ? C.error : C.border}`,
    background:     C.inputBg,
    color:          C.navy,
    fontSize:       '0.875rem',
    fontFamily:     'var(--font-body)',
    outline:        'none',
    boxSizing:      'border-box',
    transition:     'border-color 0.15s, box-shadow 0.15s',
  });

  return (
    /* ── page shell ─────────────────────────────────────────── */
    <div style={{
      minHeight:       '100vh',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      background:      C.bg,
      padding:         '1.5rem',
      fontFamily:      'var(--font-body)',
    }}>

      {/* subtle grid texture overlay */}
      <div style={{
        position:   'fixed',
        inset:      0,
        pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(27,79,216,0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(27,79,216,0.035) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />

      {/* ── card ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position:     'relative',
          zIndex:       1,
          width:        '100%',
          maxWidth:     '400px',
          background:   C.card,
          borderRadius: '1rem',
          border:       `1px solid ${C.border}`,
          boxShadow:    '0 4px 32px rgba(10,36,99,0.09), 0 1px 4px rgba(10,36,99,0.06)',
          padding:      '2.5rem 2.25rem',
        }}
      >

        {/* ── brand header ─────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {/* logo pill */}
          <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <div style={{
              width:        '3.25rem',
              height:       '3.25rem',
              borderRadius: '0.75rem',
              overflow:     'hidden',
              border:       `1.5px solid ${C.border}`,
              boxShadow:    '0 2px 8px rgba(10,36,99,0.10)',
            }}>
              <img
                src="/logo.png"
                alt="Manalo Medical Clinic"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>

          <h1 style={{
            margin:      0,
            fontSize:    '1.15rem',
            fontWeight:  700,
            color:       C.navy,
            fontFamily:  'var(--font-heading)',
            letterSpacing: '0.005em',
          }}>
            Manalo Medical Clinic
          </h1>
          <span style={{
            display:       'block',
            fontSize:      '0.68rem',
            fontWeight:    600,
            color:         C.muted,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginTop:     '0.2rem',
          }}>
            Admin Portal
          </span>
        </div>

        {/* ── divider ──────────────────────────────────────── */}
        <div style={{ height: '1px', background: C.border, marginBottom: '1.75rem' }} />

        {/* ── form heading ─────────────────────────────────── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{
            margin:      0,
            fontSize:    '1.35rem',
            fontWeight:  700,
            color:       C.navy,
            fontFamily:  'var(--font-heading)',
            lineHeight:  1.3,
          }}>
            Sign in
          </h2>
          <p style={{
            margin:    '0.3rem 0 0',
            fontSize:  '0.82rem',
            color:     C.muted,
            lineHeight: 1.55,
          }}>
            Enter your credentials to continue to the portal.
          </p>
        </div>

        {/* ── form ─────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* email */}
          <div>
            <FieldLabel>Email address</FieldLabel>
            <div style={{ position: 'relative' }}>
              <Mail style={{
                position:  'absolute', left: '0.75rem', top: '50%',
                transform: 'translateY(-50%)',
                width: '0.85rem', height: '0.85rem', color: C.muted,
                pointerEvents: 'none',
              }} />
              <input
                type="text"
                value={email}
                autoComplete="email"
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
                onFocus={onFocus}
                onBlurCapture={e => onBlurInput(e, touched.email && !email.trim())}
                placeholder="your@email.com"
                style={inputStyle(touched.email && !email.trim())}
              />
            </div>
            <AnimatePresence>
              {touched.email && !email.trim() && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ color: C.error, fontSize: '0.7rem', marginTop: '0.3rem', margin: '0.3rem 0 0' }}
                >
                  Email is required
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* password */}
          <div>
            <FieldLabel>Password</FieldLabel>
            <div style={{ position: 'relative' }}>
              <Lock style={{
                position:  'absolute', left: '0.75rem', top: '50%',
                transform: 'translateY(-50%)',
                width: '0.85rem', height: '0.85rem', color: C.muted,
                pointerEvents: 'none',
              }} />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                autoComplete="current-password"
                onChange={e => setPassword(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, password: true }))}
                onFocus={onFocus}
                onBlurCapture={e => onBlurInput(e, touched.password && !password.trim())}
                placeholder="••••••••"
                style={{ ...inputStyle(touched.password && !password.trim()), WebkitAppearance: 'none' } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                style={{
                  position:  'absolute', right: '0.75rem', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, color: C.muted, display: 'flex', alignItems: 'center',
                }}
              >
                {showPass
                  ? <EyeOff style={{ width: '0.85rem', height: '0.85rem' }} />
                  : <Eye    style={{ width: '0.85rem', height: '0.85rem' }} />
                }
              </button>
            </div>
            <AnimatePresence>
              {touched.password && !password.trim() && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ color: C.error, fontSize: '0.7rem', margin: '0.3rem 0 0' }}
                >
                  Password is required
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0,  height: 'auto' }}
                exit={{   opacity: 0, y: -6,  height: 0 }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                  padding: '0.65rem 0.875rem', borderRadius: '0.5rem',
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  overflow: 'hidden',
                }}
              >
                <AlertCircle style={{ width: '0.875rem', height: '0.875rem', color: C.error, flexShrink: 0, marginTop: '1px' }} />
                <span style={{ color: '#DC2626', fontSize: '0.8rem' }}>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* success banner */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.65rem 0.875rem', borderRadius: '0.5rem',
                  background: '#F0FDF4', border: '1px solid #BBF7D0',
                }}
              >
                <CheckCircle style={{ width: '0.875rem', height: '0.875rem', color: C.success }} />
                <span style={{ color: '#15803D', fontSize: '0.8rem' }}>Login successful. Redirecting…</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* submit */}
          <motion.button
            type="submit"
            disabled={isLoading || success}
            whileHover={!isLoading && !success ? { y: -1.5, boxShadow: '0 8px 24px rgba(27,79,216,0.30)' } : {}}
            whileTap={!isLoading   && !success ? { scale: 0.98 } : {}}
            style={{
              marginTop:      '0.25rem',
              width:          '100%',
              padding:        '0.75rem',
              borderRadius:   '0.5rem',
              border:         'none',
              cursor:         isLoading || success ? 'not-allowed' : 'pointer',
              background:     isLoading || success
                                ? C.muted
                                : `linear-gradient(135deg, ${C.navy} 0%, ${C.blue} 60%, ${C.blueLight} 100%)`,
              color:          '#fff',
              fontSize:       '0.875rem',
              fontWeight:     600,
              fontFamily:     'var(--font-body)',
              letterSpacing:  '0.02em',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '0.5rem',
              transition:     'background 0.2s, opacity 0.2s',
            }}
          >
            {isLoading ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                  style={{
                    display: 'block', width: '0.875rem', height: '0.875rem',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                    borderRadius: '50%',
                  }}
                />
                Verifying…
              </>
            ) : success ? (
              <><CheckCircle style={{ width: '0.875rem', height: '0.875rem' }} />Signed In</>
            ) : (
              'Sign In'
            )}
          </motion.button>
        </form>

        {/* ── footer ───────────────────────────────────────── */}
        <div style={{
          marginTop:  '1.75rem',
          paddingTop: '1.25rem',
          borderTop:  `1px solid ${C.border}`,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
        }}>
          <Shield style={{ width: '0.72rem', height: '0.72rem', color: C.muted }} />
          <span style={{ fontSize: '0.68rem', color: C.muted, letterSpacing: '0.02em' }}>
            Authorized clinic staff only
          </span>
        </div>
      </motion.div>
    </div>
  );
}