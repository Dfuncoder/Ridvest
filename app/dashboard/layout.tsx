/**
 * USER DASHBOARD LAYOUT — server component.
 *
 * The REAL auth gate for everything under /dashboard: requireUser() redirects
 * anonymous visitors to /login (the proxy does this too, but this check is
 * the one that can't be bypassed). Loads the profile and hands the visual
 * shell (client component) the user's real name and email. Admins also get a
 * link back to /admin, so switching between the two views works both ways.
 */
import { requireUser, getProfile } from "@/lib/auth";
import DashboardShell from "@/components/dashboard/Shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const profile = await getProfile();

  return (
    <DashboardShell
      name={profile?.full_name ?? "Investor"}
      email={profile?.email ?? user.email}
      isAdmin={profile?.role === "admin"}
    >
      {children}
    </DashboardShell>
  );
}
