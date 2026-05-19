import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://metqzcvrunllgbfrnxyy.supabase.co";
const SUPABASE_KEY = "sb_publishable_fcdNohmbppdl8S4UDZd2Vg_ODd9szFP";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const extractSlug = (url: string): string => {
  try {
    const pathname = new URL(url.startsWith("http") ? url : `https://${url}`).pathname;
    const parts = pathname.split("/").filter(Boolean);
    const probIdx = parts.indexOf("problems");
    if (probIdx !== -1 && parts[probIdx + 1]) return parts[probIdx + 1];
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
};

const deriveName = (url: string, currentName: string) => {
  if (currentName !== "1" && currentName !== "Description" && currentName !== "") return currentName;
  if (!url) return currentName;
  try {
    const slug = extractSlug(url);
    if (!slug) return currentName;
    return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return currentName;
  }
};

function inferTopic(name: string, currentTopic: string): string {
  const combined = `${currentTopic || ""} ${name || ""}`.toLowerCase();
  
  if (combined.includes("array")) return "Arrays";
  if (combined.includes("graph")) return "Graphs";
  if (combined.includes("dp") || combined.includes("dynamic")) return "DP";
  if (combined.includes("tree")) return "Trees";
  if (combined.includes("heap") || combined.includes("priority queue")) return "Heap";
  if (combined.includes("sliding") || combined.includes("window")) return "Sliding Window";
  if (combined.includes("binary search") || combined.includes("bs")) return "Binary Search";
  if (combined.includes("backtrack")) return "Backtracking";
  if (combined.includes("string")) return "Strings";
  if (combined.includes("linked") || combined.includes("list")) return "Linked List";
  if (combined.includes("stack")) return "Stack";
  if (combined.includes("queue")) return "Queue";
  if (combined.includes("hash") || combined.includes("map") || combined.includes("set")) return "Hashing";
  if (combined.includes("two pointer") || combined.includes("pointer")) return "Two Pointers";
  if (combined.includes("sort")) return "Sorting";
  if (combined.includes("greedy")) return "Greedy";
  if (combined.includes("recurs") || combined.includes("hanoi") || combined.includes("josephus") || combined.includes("fibonacci")) return "Recursion";
  if (combined.includes("math") || combined.includes("number") || combined.includes("digit") || combined.includes("arithmetic") || combined.includes("modulo")) return "Math";
  if (combined.includes("bit") || combined.includes("xor")) return "Bit Manipulation";
  
  return "Other";
}

async function run() {
  console.log("Fetching problems...");
  const { data: problems, error } = await supabase.from("problems").select("id, name, link, topic");
  
  if (error) {
    console.error("Error fetching problems:", error);
    return;
  }

  if (!problems || problems.length === 0) {
    console.log("No problems found.");
    return;
  }

  console.log(`Found ${problems.length} problems. Re-categorizing...`);
  
  let updatedCount = 0;
  
  for (const problem of problems) {
    const newName = deriveName(problem.link, problem.name);
    const inferredTopic = inferTopic(newName, problem.topic);
    
    let toUpdate: any = {};
    if (problem.name !== newName) toUpdate.name = newName;
    if (problem.topic !== inferredTopic && !(inferredTopic === "Other" && problem.topic && problem.topic !== "Target Problem" && problem.topic !== "DSA")) {
      toUpdate.topic = inferredTopic;
    }
    
    if (Object.keys(toUpdate).length > 0) {
      console.log(`Updating ${problem.id}:`, toUpdate);
      const { error: updateError } = await supabase
        .from("problems")
        .update(toUpdate)
        .eq("id", problem.id);
        
      if (updateError) {
        console.error(`Failed to update ${problem.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Done! Successfully re-categorized ${updatedCount} problems.`);
}

run().catch(console.error);
