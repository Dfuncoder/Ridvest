import SiteNavbar from "@/components/SiteNavbar";
import HowItWorks from "@/components/HowItWorks";
import { CTABanner, Footer } from "@/components/Footer";

export const metadata = {
  title: "How It Works — Rydvest",
  description: "Learn how to invest in a keke napep on Rydvest, earn weekly returns, and get your capital back after 78 weeks.",
};

export default function HowItWorksPage() {
  return (
    <main>
      <SiteNavbar />
      <HowItWorks />
      <CTABanner />
      <Footer />
    </main>
  );
}
