import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type UserId = "alex" | "sam";
export type Difficulty = "Easy" | "Medium" | "Hard";

export type RivalUser = {
  id: UserId;
  username: UserId;
  password: string;
  name: string;
  emoji: string;
  title: string;
};

export type Problem = {
  id: string;
  userId: UserId;
  name: string;
  link: string;
  platform: string;
  difficulty: Difficulty;
  topic: string;
  timeTaken: number;
  notes: string;
  solvedAt: string;
};

export type Challenge = {
  id: string;
  title: string;
  target: number;
  topic: string;
  reward: string;
};

type LoginResult = { ok: true } | { ok: false; message: string };

type DsaRivalsState = {
  users: RivalUser[];
  problems: Problem[];
  challenges: Challenge[];
  currentUserId: UserId | null;
  login: (username: string, password: string) => LoginResult;
  logout: () => void;
  addProblem: (problem: Omit<Problem, "id" | "userId" | "solvedAt">) => void;
};

const users: RivalUser[] = [
  { id: "alex", username: "alex", password: "123456", name: "Alex", emoji: "🔥", title: "Streak Hunter" },
  { id: "sam", username: "sam", password: "123456", name: "Sam", emoji: "⚡", title: "Speed Solver" },
];

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(19 - (days % 7), 12, 0, 0);
  return date.toISOString();
};

const seedProblems: Problem[] = [
  ["alex", "Binary Tree Right Side View", "LeetCode", "Medium", "Trees", 34, 0],
  ["alex", "Top K Frequent Elements", "LeetCode", "Medium", "Heap", 27, 0],
  ["sam", "Course Schedule", "LeetCode", "Medium", "Graphs", 41, 0],
  ["sam", "Valid Anagram", "NeetCode", "Easy", "Hashing", 9, 1],
  ["alex", "Merge Intervals", "LeetCode", "Medium", "Intervals", 23, 1],
  ["sam", "Koko Eating Bananas", "LeetCode", "Medium", "Binary Search", 35, 2],
  ["alex", "Number of Islands", "HackerRank", "Medium", "Graphs", 45, 2],
  ["sam", "Trapping Rain Water", "LeetCode", "Hard", "Two Pointers", 52, 3],
  ["alex", "Climbing Stairs", "Codeforces", "Easy", "DP", 12, 3],
  ["sam", "Longest Substring Without Repeating", "LeetCode", "Medium", "Sliding Window", 24, 4],
  ["alex", "Word Ladder", "LeetCode", "Hard", "Graphs", 61, 5],
  ["sam", "House Robber", "NeetCode", "Medium", "DP", 28, 6],
  ["alex", "Two Sum", "LeetCode", "Easy", "Arrays", 8, 6],
  ["sam", "Subsets", "LeetCode", "Medium", "Backtracking", 31, 7],
] .map(([userId, name, platform, difficulty, topic, timeTaken, day], index) => ({
  id: `seed-${index}`,
  userId: userId as UserId,
  name: name as string,
  link: "https://leetcode.com/problemset/",
  platform: platform as string,
  difficulty: difficulty as Difficulty,
  topic: topic as string,
  timeTaken: timeTaken as number,
  notes: "Clean solution logged after review.",
  solvedAt: daysAgo(day as number),
}));

const challenges: Challenge[] = [
  { id: "graphs", title: "Graph Sprint", target: 6, topic: "Graphs", reward: "🧭 Pathfinder" },
  { id: "dp", title: "DP Discipline", target: 5, topic: "DP", reward: "🧠 Memo Master" },
  { id: "speed", title: "Easy Speed Run", target: 8, topic: "Easy", reward: "💨 Quick Draw" },
];

export const getFriendId = (id: UserId): UserId => (id === "alex" ? "sam" : "alex");

export const useDsaRivalsStore = create<DsaRivalsState>()(
  persist(
    (set) => ({
      users,
      problems: seedProblems,
      challenges,
      currentUserId: null,
      login: (username, password) => {
        const user = users.find((item) => item.username === username.trim().toLowerCase() && item.password === password);
        if (!user) return { ok: false, message: "Invalid username or password" };
        set({ currentUserId: user.id });
        return { ok: true };
      },
      logout: () => set({ currentUserId: null }),
      addProblem: (problem) =>
        set((state) => {
          if (!state.currentUserId) return state;
          return {
            problems: [
              {
                ...problem,
                id: crypto.randomUUID(),
                userId: state.currentUserId,
                solvedAt: new Date().toISOString(),
              },
              ...state.problems,
            ],
          };
        }),
    }),
    {
      name: "dsa-rivals-demo",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ problems: state.problems, currentUserId: state.currentUserId }),
    },
  ),
);

export const userStats = (problems: Problem[], userId: UserId) => {
  const mine = problems.filter((problem) => problem.userId === userId);
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
};