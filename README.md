# 🐂 Blue Ox - Multi-Tenant Salon Management Platform

A modern, tablet-first SaaS platform for salons and grooming businesses. Features POS, loyalty points, WhatsApp messaging, and mobile money integration.

---

## 🚀 Features

### ✅ Phase 1 - DEMO READY
- **Multi-Tenant Architecture** - Multiple salons on one platform
- **Dynamic Branding** - Each salon gets their logo, colors, and subdomain
- **POS System** - Tablet-optimized checkout interface
- **Client Management** - Track clients, visits, and loyalty points
- **Services Catalog** - Manage services and pricing
- **Loyalty Points** - Automatic calculation and rewards
- **WhatsApp Receipts** - Send receipts via WhatsApp
- **Mobile Money Simulation** - MTN/Airtel payment simulation for demo
- **Admin Dashboard** - Sales overview, top services, staff performance

### 🔮 Phase 2 - Production
- **Salon Registration** - Self-service onboarding for new salons
- **Subdomain Management** - Each salon gets unique subdomain
- Real MTN MoMo API integration
- Real Airtel Money API integration
- Inventory management
- Staff commission tracking
- Advanced analytics
- Custom domain support (premium)

---

## 🛠️ Tech Stack

**Frontend:**
- Next.js 15 (React 18)
- TypeScript
- Tailwind CSS
- React Hook Form

**Backend:**
- Next.js API Routes
- Supabase (PostgreSQL + Auth + Real-time)

**Integrations:**
- WhatsApp Business Cloud API / Twilio
- Resend (Email)
- Mobile Money APIs (Phase 2)

---

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (separate project from business system)

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd salon-system
npm install
```

### 2. Set Up Supabase
1. Create a new Supabase project at https://supabase.com
2. Copy the URL and anon key
3. Run the database migrations in `/supabase/migrations`

### 3. Configure Environment
```bash
cp .env.example .env
```
Fill in your Supabase credentials and API keys.

### 4. Run Development Server
```bash
npm run dev
```
App runs on http://localhost:3001

---

## 📁 Project Structure

```
salon-system/
├── src/
│   ├── app/                    # Next.js 15 app directory
│   │   ├── (auth)/            # Auth routes (login, signup)
│   │   ├── pos/               # POS interface (main UI)
│   │   ├── dashboard/         # Admin dashboard
│   │   ├── clients/           # Client management
│   │   ├── services/          # Services catalog
│   │   ├── loyalty/           # Loyalty program
│   │   ├── staff/             # Staff management
│   │   └── api/               # API routes
│   ├── components/
│   │   ├── pos/               # POS-specific components
│   │   ├── ui/                # Reusable UI components
│   │   └── layout/            # Layout components
│   ├── lib/
│   │   ├── supabase/          # Supabase client
│   │   ├── whatsapp/          # WhatsApp messaging
│   │   ├── payments/          # Payment simulations
│   │   ├── loyalty/           # Loyalty calculations
│   │   └── utils.ts           # Utilities
│   ├── types/                 # TypeScript types
│   └── styles/                # Global styles
├── supabase/
│   └── migrations/            # Database migrations
└── public/                    # Static assets
```

---

## 🗄️ Database Schema

### Core Tables
- `salons` - Salon/branch information
- `clients` - Client profiles with loyalty points
- `services` - Service catalog with pricing
- `visits` - Transaction records
- `staff` - Staff members and roles
- `loyalty_tiers` - Loyalty program configuration
- `whatsapp_messages` - Message log

---

## 🎯 Demo User Flows

### Flow 1: Client Check-In
1. Search client by phone number
2. View loyalty points and rewards
3. Start new visit/transaction

### Flow 2: POS Checkout
1. Select service(s) from catalog
2. Total auto-calculated
3. Choose payment method (MTN/Airtel/Cash)
4. Simulate payment success
5. Points automatically added
6. WhatsApp receipt sent

### Flow 3: Loyalty Reward
1. System checks if client reached threshold
2. Flag client for free service
3. Redeem on next visit

### Flow 4: Admin View
1. Today's sales summary
2. Top services
3. Client acquisition
4. Staff performance

---

## 🎨 UI Design Principles

**Tablet-First Design:**
- Large touch targets (minimum 48px)
- High contrast colors
- Luxury salon aesthetic
- Fast loading
- Minimal clicks to checkout

**Color Scheme:**
- Primary: Luxury gold/bronze
- Secondary: Deep charcoal
- Accent: Fresh green (success)
- Background: Clean white/light gray

---

## 📱 WhatsApp Integration

### Demo Mode
Uses Twilio WhatsApp Sandbox or WhatsApp Cloud API Sandbox

### Production Mode
Requires WhatsApp Business API approval

**Message Template:**
```
✨ POSH Grooming Lounge ✨

Thank you for visiting!

Service: Luxury Beard Trim
Amount: UGX 35,000
Points Earned: +35

Total Loyalty Points: 135
🎁 50 points until next reward!

See you again! 😎
```

---

## 💳 Payment Integration

### Demo Phase
- Simulated payments (button click = success)
- Instant confirmation
- Receipt generation

### Production Phase
- MTN Mobile Money API
- Airtel Money API
- Real-time payment verification

---

## 🔐 Security

- JWT authentication via Supabase
- Row Level Security (RLS) policies
- Salon-level data isolation
- Secure API endpoints

---

## 📊 Analytics & Reports

- Daily sales summary
- Service popularity
- Client retention rate
- Loyalty program engagement
- Staff performance metrics

---

## 🚀 Deployment

### Recommended: Vercel
```bash
npm run build
vercel --prod
```

### Alternative: Any Node.js host
- Railway
- Render
- DigitalOcean App Platform

---

## 📞 Support

For issues or questions, contact: admin@blueoxjobs.eu

---

## 📄 License

Proprietary - BlueOx Solutions
