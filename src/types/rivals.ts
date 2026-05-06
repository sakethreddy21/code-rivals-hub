export type Difficulty = "Easy" | "Medium" | "Hard";

export type Account = { id: string; username: string };

export type Profile = {
  id: string;
  account_id: string;
  username: string;
  display_name: string;
  emoji: string;
  title: string;
  rival_user_id: string | null;
  created_at: string;
};

export type MutualUser = {
  id: string;
  name: string;
  emoji: string;
  title: string;
  username: string;
  mutualUserId: string | null;
};

export type Problem = {
  id: string;
  accountId: string;
  name: string;
  link: string;
  platform: string;
  difficulty: Difficulty;
  topic: string;
  timeTaken: number;
  notes: string;
  code?: string;
  solvedAt: string;
};

export type Challenge = {
  id: string;
  title: string;
  target: number;
  topic: string;
  reward: string;
};

export type StreakStatus = "Safe" | "Caution" | "Critical";

export type PlatformConnection = {
  id: string;
  account_id: string;
  platform: "LeetCode" | "GeeksforGeeks";
  platform_username: string;
  last_synced_at: string | null;
  stats: LeetCodeStats | GfgStats | null;
  created_at: string;
};

export type LeetCodeStats = {
  platform: "LeetCode";
  username: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalQuestions: number;
  easyTotal: number;
  mediumTotal: number;
  hardTotal: number;
  ranking: number;
  streak: number;
  reputation: number;
  contributionPoints: number;
  solvedSlugs?: string[];
};

export type GfgStats = {
  platform: "GeeksforGeeks";
  username: string;
  totalSolved: number;
  codingScore: number;
  totalScore: number;
  monthlyScore: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  instituteRank: string;
  solvedSlugs?: string[];
};

export type AppData = {
  profiles: Profile[];
  problems: Problem[];
  challenges: Challenge[];
  platformConnections: PlatformConnection[];
};
