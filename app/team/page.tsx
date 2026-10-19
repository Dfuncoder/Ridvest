import SiteNavbar from "@/components/SiteNavbar";
import { getSessionUser } from "@/lib/auth";
import { CTABanner, Footer } from "@/components/Footer";
import Team from "@/components/Team";

export const metadata = {
  title: "Our Team — Rydvest",
  description:
    "Meet the three co-founders behind Rydvest, Nigeria's transport co-ownership platform.",
};

export default async function TeamPage() {
  const isLoggedIn = Boolean(await getSessionUser());

  return (
    <main>
      <SiteNavbar />
      <Team />
      <CTABanner isLoggedIn={isLoggedIn} />
      <Footer />
    </main>
  );
}
