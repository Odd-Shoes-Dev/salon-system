'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSalon } from '@/contexts/SalonContext';

export default function LoginPage() {
  const router = useRouter();
  const { salon } = useSalon();
  const [method, setMethod] = useState<'pin' | 'password'>('pin');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const subdomain = window.location.hostname.split('.')[0];
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          phone: method === 'pin' ? phone : undefined,
          pin: method === 'pin' ? pin : undefined,
          email: method === 'password' ? email : undefined,
          password: method === 'password' ? password : undefined,
          subdomain,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      
      // Redirect to dashboard
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const brandColor = salon?.theme_primary_color || '#2563EB';
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          {salon?.logo_url ? (
            <div className="flex justify-center mb-4">
              <div className="w-32 h-32 flex items-center justify-center">
                <Image
                  src={salon.logo_url}
                  alt={salon.name}
                  width={128}
                  height={128}
                  className="object-contain"
                />
              </div>
            </div>
          ) : (
            <div 
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-white text-3xl font-bold mb-4"
              style={{ backgroundColor: brandColor }}
            >
              {salon?.name.charAt(0).toUpperCase() || 'S'}
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900">
            {salon?.name || 'Salon System'}
          </h1>
          {salon?.slogan && (
            <p className="text-slate-600 text-sm mt-2 italic font-medium">
              "{salon.slogan}"
            </p>
          )}
          <p className="text-slate-600 text-sm mt-1">Sign in to continue</p>
        </div>
        
        {/* Login Method Toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setMethod('pin')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              method === 'pin'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Quick PIN
          </button>
          <button
            type="button"
            onClick={() => setMethod('password')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              method === 'password'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Email & Password
          </button>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}
        
        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {method === 'pin' ? (
            <>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+256 700 000 000"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-slate-700 mb-2">
                  4-Digit PIN
                </label>
                <input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.slice(0, 4))}
                  placeholder="••••"
                  maxLength={4}
                  pattern="\d{4}"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: brandColor }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        {/* Demo Credentials */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-medium text-blue-900 mb-2">Demo Credentials:</p>
          <div className="text-xs text-blue-700 space-y-1">
            <p><strong>Phone:</strong> +256700000001</p>
            <p><strong>PIN:</strong> 1234</p>
            <p className="text-blue-600 mt-2">or</p>
            <p><strong>Email:</strong> admin@demo.com</p>
            <p><strong>Password:</strong> password123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
