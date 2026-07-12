/**
 * ADMIN LAYOUT — the REAL gate for everything under /admin.
 * requireAdmin() verifies the session AND profiles.role = 'admin' on the
 * server for every request; non-admins are redirected to /dashboard.
 */
import { requireAdmin } from "@/lib/auth";
import AdminShell from "@/components/admin/Shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();

  return <AdminShell name={profile.full_name}>{children}</AdminShell>;
}
