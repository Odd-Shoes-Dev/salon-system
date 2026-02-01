'use client';

import { useSalon } from '@/contexts/SalonContext';
import Image from 'next/image';
import Link from 'next/link';

/**
 * Displays salon logo and name
 * Adapts to each salon's branding
 */
export function SalonLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { salon } = useSalon();
  
  const sizes = {
    sm: { h: 32, img: 'h-8' },
    md: { h: 48, img: 'h-12' },
    lg: { h: 64, img: 'h-16' },
  };
  
  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };
  
  if (!salon) {
    return (
      <div className="flex items-center gap-3">
        <Image
          src="/assets/images/logo.png"
          alt="Blue Ox Logo"
          width={sizes[size].h}
          height={sizes[size].h}
          className={`${sizes[size].img} w-auto object-contain`}
        />
        <span className={`${textSizes[size]} font-bold text-brand-primary`}>
          Blue Ox
        </span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-3">
      {salon.logo_url ? (
        <Image
          src={salon.logo_url}
          alt={`${salon.name} logo`}
          width={size === 'sm' ? 32 : size === 'md' ? 48 : 64}
          height={size === 'sm' ? 32 : size === 'md' ? 48 : 64}
          className={`${sizes[size]} w-auto object-contain`}
        />
      ) : (
        <div 
          className={`${sizes[size]} ${sizes[size]} rounded-full flex items-center justify-center text-white font-bold`}
          style={{ backgroundColor: salon.theme_primary_color }}
        >
          {salon.name.charAt(0)}
        </div>
      )}
      <span 
        className={`${textSizes[size]} font-bold`}
        style={{ color: salon.theme_primary_color }}
      >
        {salon.name}
      </span>
    </div>
  );
}

/**
 * Header with salon branding
 */
export function SalonHeader({ title, children }: { title?: string; children?: React.ReactNode }) {
  const { salon } = useSalon();
  
  return (
    <header 
      className="bg-white shadow-sm border-b"
      style={{ borderBottomColor: salon?.theme_primary_color + '20' }}
    >
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <SalonLogo size="md" />
            </Link>
            {title && (
              <>
                <span className="text-gray-400">|</span>
                <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {children}
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Primary button with salon branding
 */
export function BrandButton({ 
  children, 
  onClick,
  disabled,
  className = '',
  variant = 'primary'
}: { 
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
}) {
  const { salon } = useSalon();
  const primaryColor = salon?.theme_primary_color || '#2563EB';
  
  const baseStyles = 'btn-touch font-semibold transition-all';
  
  const styles = {
    primary: {
      backgroundColor: primaryColor,
      color: '#fff',
    },
    secondary: {
      backgroundColor: salon?.theme_secondary_color || '#F59E0B',
      color: '#fff',
    },
    outline: {
      borderColor: primaryColor,
      color: primaryColor,
      borderWidth: '2px',
    },
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${className}`}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

/**
 * Card with salon accent border
 */
export function BrandCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { salon } = useSalon();
  
  return (
    <div 
      className={`bg-white rounded-xl p-6 shadow-sm border-2 ${className}`}
      style={{ borderColor: salon?.theme_primary_color + '20' }}
    >
      {children}
    </div>
  );
}
