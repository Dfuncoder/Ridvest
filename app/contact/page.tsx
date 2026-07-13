/**
 * CONTACT / "TALK TO US" — public page with the contact form.
 * Messages are stored in the database (admin → Messages) and emailed to the
 * support inbox when Resend is configured.
 */
import Navbar from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import ContactForm from "@/components/ContactForm";

export const metadata = {
  title: "Talk to us — Rydvest",
  description:
    "Questions about investing with Rydvest? Send us a message and we'll get back to you within one business day.",
};

const contactPoints = [
  {
    title: "Email us directly",
    value: "support@rydvest.com",
    href: "mailto:support@rydvest.com",
  },
  {
    title: "Response time",
    value: "Within 1 business day",
  },
];

export default function ContactPage() {
  return (
    <main>
      <Navbar />

      <section className="relative bg-[#0d2137] py-20 sm:py-24 px-6 overflow-hidden min-h-[80vh]">
        {/* Decorative glow (gradient, not filter:blur — see mobile GPU notes) */}
        <div className="hidden md:block absolute top-0 left-0 w-125 h-125 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 65%)" }} />

        <div className="relative max-w-5xl mx-auto grid lg:grid-cols-5 gap-10 items-start">
          {/* Left: pitch */}
          <div className="lg:col-span-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">We reply fast</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight tracking-tight mb-4">
              Talk to us.
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed mb-8">
              Not sure which plan fits? Want to understand how pools and payouts work before
              committing? Send a message — a real person will get back to you.
            </p>

            <div className="flex flex-col gap-3">
              {contactPoints.map((c) => (
                <div key={c.title} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">{c.title}</p>
                  {c.href ? (
                    <a href={c.href} className="text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors">{c.value}</a>
                  ) : (
                    <p className="text-sm font-bold text-white">{c.value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: the form */}
          <div className="lg:col-span-3 bg-[#0f2e52] border border-white/10 rounded-2xl p-6 sm:p-8">
            <ContactForm />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
