import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/constants";
import { Shell } from "@/components/layout/Shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await getSession();
  if (!u) redirect("/login");
  const store = await getStore();
  let unit = "Head Office";
  if (u.role === "ADMIN_REGION") unit = (await store.list("REGIONS")).find((r) => r.region_id === u.regionId)?.region_name || u.regionId;
  if (u.role === "ADMIN_SPBU") {
    const s = (await store.list("SPBUS")).find((x) => x.spbu_id === u.spbuId);
    const r = (await store.list("REGIONS")).find((x) => x.region_id === u.regionId);
    unit = `${s?.name || u.spbuId} · ${r?.region_name || ""}`;
  }
  return (
    <Shell
      user={{
        name: u.name,
        username: u.username,
        role: u.role,
        roleLabel: ROLE_LABEL[u.role],
        unit,
        demo: !!u.isDemo && process.env.DEMO_MODE !== "false",
        profileName: u.profileName || "",
        employeeId: u.employeeId || "",
        phone: u.phone || "",
      }}
    >
      {children}
    </Shell>
  );
}
