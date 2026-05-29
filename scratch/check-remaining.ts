import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: all, error } = await supabase
    .from("problems" as any)
    .select("id, name, link, topic, solved_at, account_id")
    .order("solved_at", { ascending: false })
    .limit(200);

  if (error) { console.error("ERROR:", error); return; }

  const list = all as any[];
  console.log(`\nTotal problems in DB: ${list.length}`);

  const byTopic: Record<string, number> = {};
  list.forEach((p: any) => {
    byTopic[p.topic] = (byTopic[p.topic] || 0) + 1;
  });
  console.log("\n--- By Topic ---");
  Object.entries(byTopic).sort((a,b) => b[1]-a[1]).forEach(([t,c]) => console.log(`  ${t}: ${c}`));

  console.log("\n--- Recent 30 problems ---");
  list.slice(0, 30).forEach((p: any) => {
    const d = new Date(p.solved_at);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    console.log(`  [${dateStr}] topic=${p.topic} | ${p.name?.slice(0,60)}`);
  });
}

run().catch(console.error);
