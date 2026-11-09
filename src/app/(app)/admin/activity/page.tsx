import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listActivity } from "@/lib/services/master";
import { ActivityView } from "@/components/admin/ActivityView";
import { PageHeader } from "@/components/ui/kit";
import { ScrollText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const u = await getSession();
  if (!u || u.role !== "ADMIN_PAM") redirect("/dashboard");
  const logs = await listActivity(u);
  return (
    <>
      <PageHeader icon={<ScrollText className="h-6 w-6" />} title="Riwayat & Audit Trail" subtitle="Seluruh aktivitas sistem (2.000 terbaru)." />
      <ActivityView logs={logs} />
    </>
  );
}
