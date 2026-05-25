import { supabase } from "../src/integrations/supabase/client";

async function run() {
  console.log("Checking columns of friendships table...");
  try {
    const { data, error } = await supabase.rpc("get_table_columns" as any, { table_name: "friendships" } as any);
    if (error) {
      // If RPC is not defined, we can query it via a simple select or other means, or let's try reading table info.
      console.log("RPC get_table_columns failed, attempting custom query...");
      const { data: cols, error: cErr } = await supabase.from("friendships" as any).select("*").limit(0);
      console.log("Friendships columns query success:", !cErr, "Error:", cErr);
    } else {
      console.log("Columns:", data);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
