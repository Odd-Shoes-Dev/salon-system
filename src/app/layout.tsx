import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { headers } from 'next/headers';
import { getSalonBySubdomain, getSalonByDomain } from '@/lib/tenants';
import { getCurrentUser } from '@/lib/auth';
import { SalonProvider } from '@/contexts/SalonContext';
import { UserProvider } from '@/contexts/UserContext';
import '../styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const subdomain = headersList.get('x-salon-subdomain');
  
  if (subdomain) {
    const salon = await getSalonBySubdomain(subdomain);
    if (salon) {
      return {
        title: `${salon.name} - Powered by Blue Ox`,
        description: 'Salon management system',
        manifest: '/manifest.json',
        icons: {
          icon: '/assets/images/logo.png',
          apple: '/assets/images/logo.png',
        },
      };
    }
  }
  
  return {
    title: 'Salon Management System - Powered by Blue Ox',
    description: 'Salon management system',
    manifest: '/manifest.json',
    icons: {
      icon: '/assets/images/logo.png',
      apple: '/assets/images/logo.png',
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Load salon based on custom domain or subdomain
  const headersList = await headers();
  const customDomain = headersList.get('x-custom-domain');
  const subdomain = headersList.get('x-salon-subdomain');
  
  // Try custom domain first, then fall back to subdomain
  let salon = null;
  if (customDomain) {
    console.log('[Layout] Looking up salon by custom domain:', customDomain);
    salon = await getSalonByDomain(customDomain);
    if (!salon) {
      console.log('[Layout] Custom domain lookup failed for:', customDomain);
    }
  }
  if (!salon && subdomain) {
    console.log('[Layout] Looking up salon by subdomain:', subdomain);
    salon = await getSalonBySubdomain(subdomain);
    if (!salon) {
      console.log('[Layout] Subdomain lookup failed for:', subdomain);
    } else {
      console.log('[Layout] Found salon by subdomain:', salon.name);
    }
  }
  
  if (salon) {
    console.log('[Layout] Loaded salon:', salon.name, 'ID:', salon.id);
  } else {
    console.log('[Layout] No salon found - will show general landing page');
  }
  
  // Get current authenticated user
  const user = await getCurrentUser();
  
  // Convert hex color to HSL for CSS variables
  const hexToHSL = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '217 91% 60%'; // fallback blue
    
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  const primaryColor = salon?.theme_primary_color ? hexToHSL(salon.theme_primary_color) : '217 91% 60%';
  
  return (
    <html lang="en">
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Salon POS" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Salon POS" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#E31C23" />
        
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/assets/images/logo.png" />
        
        <style dangerouslySetInnerHTML={{
          __html: `:root { --brand-primary: ${primaryColor}; }`
        }} />
      </head>
      <body className={inter.className}>
        <SalonProvider initialSalon={salon}>
          <UserProvider initialUser={user}>
            {children}
            <Toaster position="top-center" />
          </UserProvider>
        </SalonProvider>
      </body>
    </html>
  );
}
