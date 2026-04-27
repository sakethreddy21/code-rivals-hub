import { supabase } from "@/integrations/supabase/client";
import { AppData, Difficulty, Problem, Profile, RivalUser } from "@/types/rivals";

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

export function mapUser(profile: Profile): RivalUser {
  return {
    id: profile.account_id,
    name: profile.display_name,
    emoji: profile.emoji,
    title: profile.title,
    username: profile.username,
    rivalUserId: profile.rival_user_id,
  };
}

export function userStats(problems: Problem[], accountId: string) {
  const mine = problems.filter((problem) => problem.accountId === accountId);
  const now = new Date();
  const todayKey = now.toDateString();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  const solvedDays = new Set(mine.map((problem) => new Date(problem.solvedAt).toDateString()));
  let streak = 0;
  for (let offset = 0; offset < 60; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    if (!solvedDays.has(date.toDateString())) break;
    streak += 1;
  }
  return {
    total: mine.length,
    today: mine.filter((problem) => new Date(problem.solvedAt).toDateString() === todayKey).length,
    week: mine.filter((problem) => new Date(problem.solvedAt) >= weekStart).length,
    streak,
    hard: mine.filter((problem) => problem.difficulty === "Hard").length,
    minutes: mine.reduce((sum, problem) => sum + problem.timeTaken, 0),
  };
}

export function getFriendId(currentAccountId: string, users: RivalUser[]) {
  const current = users.find((user) => user.id === currentAccountId);
  return current?.rivalUserId || users.find((user) => user.id !== currentAccountId)?.id || currentAccountId;
}

export async function loadAppData(): Promise<AppData> {
  const [profilesResult, problemsResult, challengesResult] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("problems").select("*").order("solved_at", { ascending: false }),
    supabase.from("challenges").select("*").order("id", { ascending: true }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (problemsResult.error) throw problemsResult.error;
  if (challengesResult.error) throw challengesResult.error;
  return {
    profiles: (profilesResult.data ?? []) as any as Profile[],
    problems: (problemsResult.data ?? []).map(mapProblem),
    challenges: (challengesResult.data ?? []) as any as Challenge[],
  };
}
