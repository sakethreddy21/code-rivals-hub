import { supabase } from "../src/integrations/supabase/client";

async function run() {
  const now = new Date();
  console.log("Current time:", now.toISOString());
  console.log("Current local date string:", now.toLocaleDateString());
  
  const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayKey = localKey(now);
  console.log("dayKey (local):", todayKey);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  console.log("7 days ago:", sevenDaysAgo.toISOString());

  const { data: problems, error } = await (supabase as any)
    .from("problems")
    .select("id, name, link, topic, solved_at, account_id")
    .eq("topic", "Target Problem")
    .gte("solved_at", sevenDaysAgo.toISOString());

  if (error) { console.error(error); return; }
  console.log("\n--- TARGET PROBLEMS (last 7 days) ---");
  (problems as any[]).forEach((p: any) => {
    const localDate = localKey(new Date(p.solved_at));
    console.log(`LocalDate: ${localDate} | solved_at: ${p.solved_at} | Name: ${p.name} | Link: ${p.link.slice(0,80)}`);
  });
}

run();
