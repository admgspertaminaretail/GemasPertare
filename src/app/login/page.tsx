import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { DEMO_PASSWORD, STATUS } from "@/lib/constants";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  if (await getSession()) redirect("/home");
  const showDemo = process.env.DEMO_MODE !== "false";
  const accounts: { label: string; username: string; hint: string }[] = [];
  if (showDemo) {
    const store = await getStore();
    const [users, subs, spbus] = await Promise.all([store.list("USERS"), store.list("SUBMISSIONS"), store.list("SPBUS")]);
    const pam = users.find((u) => u.role_id === "ADMIN_PAM" && u.is_active === "1");
    if (pam) accounts.push({ label: "Admin PAM / Head Office", username: pam.username, hint: "Lintas Region" });
    const reg1 = users.find((u) => u.role_id === "ADMIN_REGION" && u.region_id === "REG-1" && u.is_active === "1");
    if (reg1) accounts.push({ label: "PIC Region I", username: reg1.username, hint: "Review, pooling, MEMO" });
    const spbu1 = users.find((u) => u.role_id === "ADMIN_SPBU" && u.region_id === "REG-1" && u.is_active === "1");
    if (spbu1) {
      const nm = spbus.find((s) => s.spbu_id === spbu1.spbu_id)?.name || "";
      accounts.push({ label: "Admin SPBU", username: spbu1.username, hint: nm });
    }
  }
  return <LoginForm next={searchParams.next} accounts={accounts} demoPassword={showDemo ? DEMO_PASSWORD : ""} />;
}
