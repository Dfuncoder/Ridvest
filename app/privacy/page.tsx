import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Rydvest",
  description: "How Rydvest collects, uses, and protects your personal data.",
};

const sections = [
  {
    title: "1. Who We Are", 
    content: `Rydvest Ltd is a transport co-investment platform based in Ogidi, Anambra State, Nigeria. We operate the Rydvest platform, which allows individuals to invest in commercial vehicles and earn weekly returns.

This Privacy Policy explains what personal information we collect, why we collect it, how we use it, and your rights regarding that information. If you have questions, contact us at hello@rydvest.com.`,
  },
  {
    title: "2. Information We Collect",
    content: `When you use Rydvest, we collect the following types of information:

Identity Information — Your full name, date of birth, and government-issued ID (such as NIN, BVN, international passport, or driver's licence) collected during account verification.

Contact Information — Your email address, phone number, and WhatsApp number.

Financial Information — Your bank account name, account number, and bank name, used solely for processing investment payouts and capital returns. We do not store card details.

Investment Activity — Details of your investments, pool memberships, payout history, and account activity on the platform.

Device and Usage Data — Your IP address, browser type, device information, and how you navigate the platform. This helps us improve our service and detect fraud.

Communications — Records of messages, emails, or support conversations you have with Rydvest.`,
  },
  {
    title: "3. Why We Collect Your Information",
    content: `We use your information to:

— Create and manage your Rydvest account
— Verify your identity in compliance with Nigerian financial regulations
— Process your investments, weekly payouts, and capital returns
— Send you important account updates, payout notifications, and platform announcements
— Detect, prevent, and investigate fraud or suspicious activity
— Improve the Rydvest platform and user experience
— Comply with legal and regulatory obligations

We do not use your information for purposes beyond what is listed here without your explicit consent.`,
  },
  {
    title: "4. How We Share Your Information",
    content: `Rydvest does not sell your personal data to anyone. We may share your information only in the following limited circumstances:

Service Providers — We work with trusted third-party providers (such as payment processors and identity verification services) who help us operate the platform. They are only given information they need to perform their specific function and are bound by confidentiality agreements.

Legal Requirements — We may disclose your information if required to do so by Nigerian law, a court order, or a government regulatory body.

Business Continuity — In the unlikely event of a merger, acquisition, or restructuring of Rydvest Ltd, your data may be transferred to the succeeding entity, and you will be notified in advance.

We will never share your data with advertisers or third parties for marketing purposes.`,
  },
  {
    title: "5. How We Protect Your Information",
    content: `We take the security of your data seriously. Rydvest uses industry-standard encryption for data in transit and at rest. Access to personal data within our team is restricted on a need-to-know basis.

However, no method of data transmission or storage is completely secure. While we do everything reasonably possible to protect your information, we cannot guarantee absolute security. In the event of a data breach that affects your rights, we will notify you promptly.`,
  },
  {
    title: "6. Data Retention",
    content: `We keep your personal data for as long as your account is active and for a reasonable period afterward to meet legal and regulatory obligations. If you close your account, we will delete or anonymise your data within 90 days, except where we are required by law to retain it longer.

Investment records may be retained for up to 7 years in compliance with Nigerian financial record-keeping requirements.`,
  },
  {
    title: "7. Your Rights",
    content: `You have the right to:

— Access the personal information we hold about you
— Request correction of any inaccurate information
— Request deletion of your data, subject to legal obligations
— Withdraw consent for optional data uses at any time
— Lodge a complaint with the relevant data protection authority in Nigeria

To exercise any of these rights, contact us at hello@rydvest.com. We will respond within 14 business days.`,
  },
  {
    title: "8. Cookies",
    content: `Rydvest uses cookies and similar tracking technologies to keep you logged in, remember your preferences, and understand how people use our platform. You can control cookie settings through your browser. Disabling cookies may affect some features of the platform.`,
  },
  {
    title: "9. Third-Party Links",
    content: `Our platform may contain links to third-party websites. This Privacy Policy does not apply to those websites. We encourage you to read the privacy policies of any third-party sites you visit.`,
  },
  {
    title: "10. Changes to This Policy",
    content: `We may update this Privacy Policy as our platform grows or regulations change. When we make significant changes, we will notify you by email or a notice on the platform. The date at the top of this page always reflects the most recent update.`,
  },
  {
    title: "11. Contact Us",
    content: `For any privacy-related questions or requests, reach us at:

Email: hello@rydvest.com
Phone: +234 707 092 1140
WhatsApp: +234 706 528 4100
Address: Ogidi, Anambra State, Nigeria`,
  },
];

export default function PrivacyPage() {
  return (
    <main className="bg-white min-h-screen">

      {/* Header */}
      <div className="bg-[#0d2137] py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-amber-400 text-sm font-semibold hover:text-amber-300 transition-colors mb-6 inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to home
          </Link>
          
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-slate-400 text-sm">Last updated: January 2026 · Rydvest Ltd, Ogidi, Anambra State, Nigeria</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-slate-600 text-base leading-relaxed mb-12 p-5 bg-blue-50 border border-blue-100 rounded-xl">
          Your privacy matters to us. This policy explains exactly what we do with your personal information — in plain, simple language. We do not sell your data, and we never will.
        </p>

        <div className="flex flex-col gap-10">
          {sections.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-extrabold text-slate-900 mb-4">{s.title}</h2>
              <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{s.content}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer strip */}
      <div className="border-t border-slate-100 py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-wrap gap-4 justify-between items-center">
          <span className="text-sm font-black text-slate-900">Ryd<span className="text-amber-400">vest</span></span>
          <div className="flex gap-5">
            <Link href="/terms" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">Terms of Service</Link>
            <Link href="/faq" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">FAQ</Link>
          </div>
        </div>
      </div>

    </main>
  );
}
