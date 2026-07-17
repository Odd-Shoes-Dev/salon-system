import SmsPageClient from './SmsPageClient';

export default function SmsPage() {
  const provider = (process.env.SMS_PROVIDER ?? 'esms').toLowerCase();
  return <SmsPageClient initialProvider={provider} />;
}
