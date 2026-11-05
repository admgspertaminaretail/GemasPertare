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
    const demo = users.filter((u) => u.is_demo === "1" && u.is_active === "1");
    const pam = demo.find((u) => u.role_id === "ADMIN_PAM");
    if (pam) accounts.push({ label: "Admin PAM / Head Office", username: pam.username, hint: "Lintas Region" });
    const reg1 = demo.find((u) => u.role_id === "ADMIN_REGION" && u.region_id === "REG-1");
    if (reg1) accounts.push({ label: "PIC Region I", username: reg1.username, hint: "Review, pooling, MEMO" });
    const spbuOf = (r: string, pred: (id: string) => boolean) => demo.find((u) => u.role_id === "ADMIN_SPBU" && u.region_id === r && pred(u.spbu_id));
    const rev = spbuOf("REG-1", (id) => subs.some((s) => s.spbu_id === id && s.status === STATUS.REVISION));
    const none = spbuOf("REG-1", (id) => !subs.some((s) => s.spbu_id === id));
    const nm = (u?: Record<string, string>) => spbus.find((s) => s.spbu_id === u?.spbu_id)?.name || "";
    if (rev) accounts.push({ label: "Admin SPBU (ada revisi)", username: rev.username, hint: nm(rev) });
    if (none) accounts.push({ label: "Admin SPBU (belum mengajukan)", username: none.username, hint: nm(none) });
  }
  return <LoginForm next={searchParams.next} accounts={accounts} demoPassword={showDemo ? DEMO_PASSWORD : ""} />;
}
