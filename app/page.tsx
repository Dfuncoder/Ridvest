import SiteNavbar from "@/components/SiteNavbar";
import { getSessionUser } from "@/lib/auth";
import Hero from "@/components/Hero";
import Counters from "@/components/Counters";
import Plans from "@/components/Plans";
import AboutUs from "@/components/AboutUs";
import HowItWorks from "@/components/HowItWorks";
import InvestmentCards from "@/components/InvestmentCards";
import VehicleLineup from "@/components/VehicleLineup";
import Calculator from "@/components/Calculator";
import { CTABanner, Footer } from "@/components/Footer";

export const metadata = {
  title: "Rydvest — Co-own a Keke. Earn Weekly.",
  description:
    "Rydvest lets everyday Nigerians co-own tricycles and earn consistent earnings. Asset-backed, fully managed, starting from ₦100,000.",
};

/**
 * The public home page.
 *
 * Reads the session once and hands it down as a boolean: the three call-to-
 * action blocks all say "create an account", which is the wrong thing to say
 * to somebody who already has one. SiteNavbar does its own read; getClaims()
 * verifies the token locally, so a second one costs nothing.
 */
export default async function Home() {
  const isLoggedIn = Boolean(await getSessionUser());

  return (
    <main>
      <SiteNavbar />
      <Hero isLoggedIn={isLoggedIn} />
      <AboutUs isLoggedIn={isLoggedIn} />
      <HowItWorks isLoggedIn={isLoggedIn} />
      <VehicleLineup />
      <Calculator />
      <CTABanner isLoggedIn={isLoggedIn} />
      <Footer />
    </main>
  );
}
