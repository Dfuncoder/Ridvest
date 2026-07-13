import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Counters from "@/components/Counters";
import Plans from "@/components/Plans";
import VehicleLineup from "@/components/VehicleLineup";
import { HowItWorks, WhyRydvest } from "@/components/Sections";
import Calculator from "@/components/Calculator";
import { CTABanner, Footer } from "@/components/Footer";

export const metadata = {
  title: "Rydvest — Invest in Keke. Earn Weekly.",
  description:
    "Rydvest lets everyday Nigerians co-invest in tricycles and earn consistent returns. Asset-backed, fully managed, starting from ₦100,000.",
};

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Counters />
      <Plans />
      <VehicleLineup />
      <HowItWorks />
      <Calculator />
      <WhyRydvest />
      <CTABanner />
      <Footer />
    </main>
  );
}
