import { supabase } from "../src/integrations/supabase/client";

async function run() {
  console.log("Querying database tables...");
  try {
    const { data: friendships, error: fError } = await supabase.from("friendships" as any).select("*");
    console.log("Friendships table data:", friendships);
    if (fError) console.error("Friendships error:", fError);

    const { data: profiles, error: pError } = await supabase.from("profiles" as any).select("*");
    console.log("Profiles table data:", profiles);
    if (pError) console.error("Profiles error:", pError);

    const { data: accounts, error: aError } = await supabase.from("accounts" as any).select("*");
    console.log("Accounts table data:", accounts);
    if (aError) console.error("Accounts error:", aError);

  } catch (err) {
    console.error("Error in run:", err);
  }
}

run();
