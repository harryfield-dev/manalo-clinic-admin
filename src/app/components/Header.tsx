import { motion } from 'motion/react';
import { Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuToggle: () => void;
  onNavigate?: (page: string) => void;
}

export function Header({ title, subtitle, onMenuToggle, onNavigate }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b" style={{ background: '#fff', borderColor: '#E8F1FF' }}>
      <div className="flex items-center gap-4">
        <button onClick={onMenuToggle} className="md:hidden p-2 rounded-lg" style={{ color: '#0A2463' }}>
          <Menu className="w-5 h-5" />
        </button>
        {(title || subtitle) && (
          <div>
            {title && (
              <h1 style={{ fontFamily: 'var(--font-heading)', color: '#0A2463', fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.2 }}>
                {title}
              </h1>
            )}
            {subtitle && (
              <p style={{ fontFamily: 'var(--font-body)', color: '#6B7A99', fontSize: '0.8rem', marginTop: 2 }}>
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Profile */}
        
      </div>
    </header>
  );
}
