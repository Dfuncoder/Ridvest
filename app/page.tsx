import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Counters from "@/components/Counters";
import Plans from "@/components/Plans";
import InvestmentCards from "@/components/InvestmentCards";
import VehicleLineup from "@/components/VehicleLineup";
import { HowItWorks, WhyRidvest } from "@/components/Sections";
import Calculator from "@/components/Calculator";
import { CTABanner, Footer } from "@/components/Footer";

export const metadata = {
  title: "Ridvest — Invest in Keke. Earn Monthly.",
  description:
    "Ridvest lets everyday Nigerians co-invest in tricycles and earn consistent returns. Asset-backed, fully managed, starting from ₦100,000.",
};

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Counters />
      <InvestmentCards />
      <VehicleLineup />
      <HowItWorks />
      <Calculator />
      <WhyRidvest />
      <CTABanner />
      <Footer />
    </main>
  );
}
