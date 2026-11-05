import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { listUsers } from "@/lib/services/master";
import { UsersView } from "@/components/admin/UsersView";
import { PageHeader } from "@/components/ui/kit";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const u = await getSession();
  if (!u || u.role !== "ADMIN_PAM") redirect("/dashboard");
  const store = await getStore();
  const [users, regions, spbus] = await Promise.all([listUsers(u), store.list("REGIONS"), store.list("SPBUS")]);
  return (
    <>
      <PageHeader icon={<Users className="h-6 w-6" />} title="Pengguna & Role" subtitle="Setiap SPBU memiliki satu akun Admin SPBU aktif. Akses ditentukan oleh role dan lingkup Region/SPBU." />
      <UsersView users={users} regions={regions} spbus={spbus.filter((s) => s.is_active === "1").map((s) => ({ id: s.spbu_id, name: s.name, region_id: s.region_id }))} meId={u.userId} />
    </>
  );
}
