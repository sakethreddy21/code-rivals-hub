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
  solvedAt: string;
};

export type Challenge = {
  id: string;
  title: string;
  target: number;
  topic: string;
  reward: string;
};

export type RivalUser = {
  id: string;
  name: string;
  emoji: string;
  title: string;
  username: string;
  rivalUserId: string | null;
};

export type AppData = {
  profiles: Profile[];
  problems: Problem[];
  challenges: Challenge[];
};
