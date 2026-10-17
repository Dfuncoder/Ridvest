import SiteNavbar from "@/components/SiteNavbar";
import { CTABanner, Footer } from "@/components/Footer";
import Team from "@/components/Team";

export const metadata = {
  title: "Our Team — Rydvest",
  description:
    "Meet the three co-founders behind Rydvest, Nigeria's transport co-ownership platform.",
};

export default function TeamPage() {
  return (
    <main>
      <SiteNavbar />
      <Team />
      <CTABanner />
      <Footer />
    </main>
  );
}
