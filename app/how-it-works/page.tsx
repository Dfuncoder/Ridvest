import SiteNavbar from "@/components/SiteNavbar";
import { getSessionUser } from "@/lib/auth";
import HowItWorks from "@/components/HowItWorks";
import { CTABanner, Footer } from "@/components/Footer";

export const metadata = {
  title: "How It Works — Rydvest",
  description: "Learn how to invest in a keke napep on Rydvest, earn weekly returns, and get your capital back after 78 weeks.",
};

export default async function HowItWorksPage() {
  const isLoggedIn = Boolean(await getSessionUser());

  return (
    <main>
      <SiteNavbar />
      <HowItWorks isLoggedIn={isLoggedIn} />
      <CTABanner isLoggedIn={isLoggedIn} />
      <Footer />
    </main>
  );
}
