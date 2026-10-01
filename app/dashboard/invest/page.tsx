/**
 * Kept only so old links and bookmarks keep working.
 *
 * Investing used to live here and duplicated the Pools page. Browsing and
 * joining is now Pools; the user's own positions are Investments.
 */
import { redirect } from "next/navigation";

export default function InvestRedirect() {
  redirect("/dashboard/pools");
}
