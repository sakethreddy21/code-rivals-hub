import { supabase } from "../src/integrations/supabase/client";

async function createDaksh() {
  console.log("Creating user 'daksh'...");
  const username = "daksh";
  const password = "123";

  // Check if account already exists
  const { data: existingAccount, error: findError } = await supabase
    .from("accounts" as any)
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (findError) {
    console.error("Error finding account:", findError);
    return;
  }

  let accountId: string;

  if (existingAccount) {
    console.log("Account 'daksh' already exists:", existingAccount);
    accountId = (existingAccount as any).id;
  } else {
    const { data: newAccount, error: createError } = await supabase
      .from("accounts" as any)
      .insert({ username, password })
      .select()
      .single();

    if (createError) {
      console.error("Error creating account:", createError);
      return;
    }
    console.log("Created account 'daksh':", newAccount);
    accountId = (newAccount as any).id;
  }

  // Check if profile exists
  const { data: existingProfile, error: pFindError } = await supabase
    .from("profiles" as any)
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();

  if (pFindError) {
    console.error("Error finding profile:", pFindError);
    return;
  }

  if (existingProfile) {
    console.log("Profile for 'daksh' already exists:", existingProfile);
  } else {
    const { data: newProfile, error: pCreateError } = await supabase
      .from("profiles" as any)
      .insert({
        account_id: accountId,
        username: username,
        display_name: "Daksh",
        emoji: "🦁",
        title: "Algo Partner"
      })
      .select()
      .single();

    if (pCreateError) {
      console.error("Error creating profile:", pCreateError);
      return;
    }
    console.log("Created profile for 'daksh':", newProfile);
  }

  console.log("Done!");
}

createDaksh();
