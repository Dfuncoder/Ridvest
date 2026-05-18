"use client";

import Link from "next/link";
import { useState } from "react";

const faqs = [
  {
    category: "Getting started",
    questions: [
      {
        q: "What is Ridvest?",
        a: "Ridvest is a Nigerian co-investment platform that lets you own a stake in a commercial tricycle (keke napep) and earn monthly returns for 12 months. We handle everything on the ground — vehicle acquisition, driver management, maintenance, and operations. You invest, we run it, you earn.",
      },
      {
        q: "Who can invest on Ridvest?",
        a: "Any Nigerian resident aged 18 and above with a valid bank account can invest on Ridvest. You will need to complete a quick identity verification during sign-up using a government-issued ID (NIN, BVN, passport, or driver's licence).",
      },
      {
        q: "How do I create an account?",
        a: "Click 'Get started' on the homepage, fill in your details, verify your identity, and link your bank account. The whole process takes less than 5 minutes.",
      },
      {
        q: "Is Ridvest safe?",
        a: "Yes. Every investment is backed by a real, physical keke on the road — not a digital token or paper promise. We vet our drivers, insure our vehicles, and maintain them throughout the investment term. Your capital is returned in full at the end of 12 months.",
      },
    ],
  },
  {
    category: "Investing",
    questions: [
      {
        q: "What is the minimum amount I can invest?",
        a: "The minimum investment to join a public or private pool is ₦100,000. If you want to own a full keke outright by yourself, the amount depends on the current cost of the vehicle, which is shown on the investment page.",
      },
      {
        q: "What are my investment options?",
        a: "You have three options:\n\n1. Full Ownership — you fund the entire cost of a keke and own it alone for the year.\n\n2. Public Pool — you join an open pool with other investors on the platform. Once the pool hits its target, the keke is deployed.\n\n3. Private Pool — you create or join a pool with people you invite, like family, friends, or your cooperative.",
      },
      {
        q: "What is the interest rate?",
        a: "The current rate is 25% per annum. This means if you invest ₦200,000, you earn ₦50,000 in interest over 12 months — paid out monthly at roughly ₦4,167 per month. The rate that applies to your investment is locked in at the time you fund it.",
      },
      {
        q: "How long does my money stay invested?",
        a: "Every investment on Ridvest runs for a fixed 12-month term. You collect monthly returns throughout the year, and your original capital is returned to you at the end of month 12.",
      },
      {
        q: "What happens after 12 months?",
        a: "Your capital is returned in full to your bank account. After that, it is entirely your choice — you can reinvest in a new cycle, join another pool, or walk away.",
      },
      {
        q: "Can I invest more than once?",
        a: "Yes. You can hold multiple investments at the same time — different pools or different investment types. There is no limit to how many investments you can make.",
      },
    ],
  },
  {
    category: "Payouts and returns",
    questions: [
      {
        q: "When do I start receiving returns?",
        a: "Returns begin from the month after your investment is confirmed and the keke is deployed. For pool investments, the clock starts once the pool is fully funded and the vehicle is on the road.",
      },
      {
        q: "How are my returns paid?",
        a: "Monthly returns are paid directly to the bank account you registered on Ridvest. You do not need to request them — they are processed automatically on your scheduled payout date each month.",
      },
      {
        q: "Can I track my earnings?",
        a: "Yes. Your Ridvest dashboard shows your investment activity, monthly returns, payout history, and the performance of your keke in real time.",
      },
      {
        q: "What if a payout is delayed?",
        a: "Payouts are processed on schedule every month. If there is ever a delay due to a banking issue or any operational matter, we will notify you immediately by email and WhatsApp and resolve it as quickly as possible.",
      },
    ],
  },
  {
    category: "Pools",
    questions: [
      {
        q: "What is a public pool?",
        a: "A public pool is an open investment opportunity visible to all Ridvest users. You browse the available pools, choose one, and contribute your amount. Once the pool reaches its funding target, the keke is acquired and deployed.",
      },
      {
        q: "What is a private pool?",
        a: "A private pool is invitation-only. You create the pool and share a link with specific people — family, friends, or a cooperative. Only people with your link can join. Once the pool is fully funded, it works exactly the same as a public pool.",
      },
      {
        q: "How long does it take for a pool to fill?",
        a: "It depends on how many investors join. Public pools are open to the entire platform so they fill faster. Private pools depend on how quickly your invited group contributes. You can track the pool's progress in real time on your dashboard.",
      },
      {
        q: "What happens if a pool does not fill up?",
        a: "If a pool does not reach its funding target within the specified window, all contributions are returned to investors in full with no deductions.",
      },
    ],
  },
  {
    category: "Vehicles and operations",
    questions: [
      {
        q: "What vehicles can I invest in right now?",
        a: "Currently, only Keke Napep (commercial tricycles) are available for investment. Mini buses and motorcycles are coming soon — early investors on the platform will get priority access when they launch.",
      },
      {
        q: "Who manages the keke?",
        a: "Ridvest manages everything. We acquire the vehicle, vet and onboard a verified driver, handle routine maintenance, cover insurance, and monitor daily operations. You are not involved in any of this.",
      },
      {
        q: "What if the keke breaks down or gets damaged?",
        a: "All vehicles on the Ridvest platform are insured and covered for maintenance. In the event of damage or a breakdown, we handle repairs and continue operations. This does not affect your scheduled monthly payouts.",
      },
      {
        q: "Can I see which keke my money is in?",
        a: "Yes. Once your investment is confirmed and the vehicle is deployed, your dashboard will show details about the keke associated with your investment, including operational updates.",
      },
    ],
  },
  {
    category: "Account and security",
    questions: [
      {
        q: "How do I withdraw my capital before 12 months?",
        a: "Investments are designed to run for the full 12-month term. Early withdrawal requests can be submitted through your dashboard and are handled on a case-by-case basis. Processing timelines and conditions will be communicated at the time of your request.",
      },
      {
        q: "Is my personal and financial information safe?",
        a: "Yes. Ridvest uses industry-standard encryption for all data. We never sell your personal information and we only share data with trusted service providers who help us run the platform. See our Privacy Policy for full details.",
      },
      {
        q: "What do I do if I forget my password?",
        a: "Click 'Forgot password' on the login page and follow the steps to reset it via your registered email address.",
      },
      {
        q: "How do I contact Ridvest for support?",
        a: "You can reach us by email at hello@ridvest.ng, by phone or WhatsApp on +234 800 000 0000, or visit us at our office in Ogidi, Anambra State. We aim to respond to all enquiries within 24 hours.",
      },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-xl transition-all duration-200 ${open ? "border-blue-200 bg-blue-50/50" : "border-slate-100 bg-white hover:border-slate-200"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 p-5 text-left"
      >
        <span className={`text-sm font-semibold leading-snug transition-colors ${open ? "text-blue-700" : "text-slate-900"}`}>{q}</span>
        <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center transition-all duration-200 mt-0.5 ${open ? "bg-blue-600 text-white rotate-45" : "bg-slate-100 text-slate-500"}`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5">
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 mb-5">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Support</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">Frequently asked questions</h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-xl">
            Everything you need to know about investing on Ridvest. Can't find your answer? Reach us on WhatsApp at +234 800 000 0000.
          </p>
        </div>
      </div>

      {/* FAQ content */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex flex-col gap-14">
          {faqs.map((cat) => (
            <div key={cat.category}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-5 bg-amber-400 rounded-full" />
                <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">{cat.category}</h2>
              </div>
              <div className="flex flex-col gap-3">
                {cat.questions.map((item) => (
                  <FAQItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Still have questions */}
        <div className="mt-16 bg-[#0d2137] rounded-2xl p-8 text-center">
          <h3 className="text-lg font-extrabold text-white mb-2">Still have questions?</h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Our team is available Monday to Saturday, 8am to 6pm. We usually respond within a few hours.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href="mailto:hello@ridvest.ng"
              className="inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-all duration-150"
            >
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              Email us
            </a>
            <a
              href="https://wa.me/2348000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-[#0d2137] text-sm font-extrabold px-5 py-3 rounded-xl transition-all duration-150"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp us
            </a>
          </div>
        </div>
      </div>

      {/* Footer strip */}
      <div className="border-t border-slate-100 py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-wrap gap-4 justify-between items-center">
          <span className="text-sm font-black text-slate-900">Rid<span className="text-amber-400">vest</span></span>
          <div className="flex gap-5">
            <Link href="/terms" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </div>

    </main>
  );
}
