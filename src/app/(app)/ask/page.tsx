import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { AskView } from "@/components/ai/AskView";

export const dynamic = "force-dynamic";

export default async function AskPage() {
  await requireUser();
  const store = await getStore();
  const docs = await store.list("KNOWLEDGE_DOCUMENTS");
  const indexed = docs.filter((d) => d.status === "Aktif" && d.use_for_ai === "1" && d.ai_status.startsWith("Terindeks")).map((d) => d.title);
  return <AskView indexed={indexed} totalDocs={docs.length} llm={!!process.env.GEMINI_API_KEY} />;
}
