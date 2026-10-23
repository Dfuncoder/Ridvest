import SiteNavbar from "@/components/SiteNavbar";
import { getSessionUser } from "@/lib/auth";
import { CTABanner, Footer } from "@/components/Footer";
import AboutUs from "@/components/AboutUs";

export const metadata = {
  title: "About Us — Rydvest",
  description: "Learn how Rydvest works, what we stand for, and why we built Nigeria's first keke napep co-ownership platform.",
};

export default async function AboutPage() {
  const isLoggedIn = Boolean(await getSessionUser());

  return (
    <main>
      <SiteNavbar />
      <AboutUs />
      <CTABanner isLoggedIn={isLoggedIn} />
      <Footer />
    </main>
  );
}
