import { supabase } from "@/integrations/supabase/client";
import { AppData, Difficulty, MutualUser, PlatformConnection, Problem, Profile } from "@/types/rivals";

export const platforms = ["LeetCode", "NeetCode", "Codeforces", "HackerRank", "Custom..."];
export const difficulties = ["Easy", "Medium", "Hard"] as const;
export const topics = ["Arrays", "Graphs", "DP", "Trees", "Heap", "Sliding Window", "Binary Search", "Backtracking", "Custom..."];

export function mapProblem(problem: any): Problem {
  return {
    id: problem.id,
    accountId: problem.account_id,
    name: problem.name,
    link: problem.link,
    platform: problem.platform,
    difficulty: problem.difficulty as Difficulty,
    topic: problem.topic,
    timeTaken: problem.time_taken,
    notes: problem.notes,
    solvedAt: problem.solved_at,
  };
}

export function mapUser(profile: Profile, problems?: Problem[]): MutualUser {
  let emoji = profile.emoji;
  let title = profile.title;
  
  if (problems) {
    const stats = userStats(problems, profile.account_id);
    if (stats.streak === 0 && stats.total > 0) {
      emoji = "🤡";
      title = "Streak Breaker";
    }
  }

  return {
    id: profile.account_id,
    name: profile.display_name,
    emoji,
    title,
    username: profile.username,
    mutualUserId: profile.rival_user_id,
  };
}

export function userStats(problems: Problem[], accountId: string) {
  const mine = [...problems].filter((problem) => problem.accountId === accountId)
    .sort((a, b) => +new Date(b.solvedAt) - +new Date(a.solvedAt));
  
  const now = new Date();
  const todayKey = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = yesterday.toDateString();

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  
  const solvedDays = new Set(mine.map((problem) => new Date(problem.solvedAt).toDateString()));
  
  const solvedToday = solvedDays.has(todayKey);
  const solvedYesterday = solvedDays.has(yesterdayKey);

  let streak = 0;
  if (solvedToday || solvedYesterday) {
    // Start counting from today or yesterday
    let startOffset = solvedToday ? 0 : 1;
    for (let offset = startOffset; offset < 365; offset += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - offset);
      if (!solvedDays.has(date.toDateString())) break;
      streak += 1;
    }
  }

  return {
    total: mine.length,
    today: mine.filter((problem) => new Date(problem.solvedAt).toDateString() === todayKey).length,
    week: mine.filter((problem) => new Date(problem.solvedAt) >= weekStart).length,
    streak,
    hard: mine.filter((problem) => problem.difficulty === "Hard").length,
    minutes: mine.reduce((sum, problem) => sum + problem.timeTaken, 0),
    solvedToday,
    xp: mine.reduce((acc, p) => acc + (p.difficulty === 'Hard' ? 100 : p.difficulty === 'Medium' ? 30 : 10), 0),
  };
}

export type StreakStatus = "Safe" | "Caution" | "Critical";


export function getStreakStatus(solvedToday: boolean): { status: StreakStatus; message: string; color: string } {
  if (solvedToday) {
    return { status: "Safe", message: "Streak protected for today! 🔥", color: "text-green-500" };
  }
  
  const hoursLeft = 24 - new Date().getHours();
  
  if (hoursLeft > 6) {
    return { status: "Caution", message: "Your streak is at risk. Solve something soon!", color: "text-yellow-500" };
  }
  
  return { status: "Critical", message: "FINAL CALL: Your streak will break in a few hours! 🚨", color: "text-red-500" };
}

export function getFriendId(currentAccountId: string, users: MutualUser[]) {
  const current = users.find((user) => user.id === currentAccountId);
  return current?.mutualUserId || users.find((user) => user.id !== currentAccountId)?.id || currentAccountId;
}

export async function loadAppData(): Promise<AppData> {
  const [profilesResult, problemsResult, connectionsResult] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("problems").select("*").order("solved_at", { ascending: false }),
    supabase.from("platform_connections" as any).select("*").order("created_at", { ascending: true }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (problemsResult.error) throw problemsResult.error;
  // platform_connections might not exist yet, so we don't throw on error
  return {
    profiles: (profilesResult.data ?? []) as any as Profile[],
    problems: (problemsResult.data ?? []).map(mapProblem),
    platformConnections: (connectionsResult.data ?? []) as any as PlatformConnection[],
  };
}
