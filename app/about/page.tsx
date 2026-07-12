import Navbar from "@/components/Navbar";
import { CTABanner, Footer } from "@/components/Footer";
import AboutUs from "@/components/AboutUs";

export const metadata = {
  title: "About Us — Rydvest",
  description: "Learn how Rydvest works, what we stand for, and why we built Nigeria's first keke napep co-investment platform.",
};

export default function AboutPage() {
  return (
    <main>
      <Navbar />
      <AboutUs />
      <CTABanner />
      <Footer />
    </main>
  );
}
