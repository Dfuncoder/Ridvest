import SiteNavbar from "@/components/SiteNavbar";
import { getSessionUser } from "@/lib/auth";
import HowItWorks from "@/components/HowItWorks";
import { CTABanner, Footer } from "@/components/Footer";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "How It Works — Rydvest",
  description:
    "Fund a share of a transport asset, we vet the driver and run it, and earnings reach your account every week for 78 weeks.",
});

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
