import SiteNavbar from "@/components/SiteNavbar";
import { getSessionUser } from "@/lib/auth";
import { CTABanner, Footer } from "@/components/Footer";
import AboutUs from "@/components/AboutUs";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "About Us — Rydvest",
  description:
    "Why we built Rydvest, what we stand for, and how everyday Nigerians come to co-own income-earning transport assets.",
});

export default async function AboutPage() {
  const isLoggedIn = Boolean(await getSessionUser());

  return (
    <main>
      <SiteNavbar />
      <AboutUs isLoggedIn={isLoggedIn} />
      <CTABanner isLoggedIn={isLoggedIn} />
      <Footer />
    </main>
  );
}
