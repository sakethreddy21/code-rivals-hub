import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  ExternalLink,
  Flame,
  LayoutDashboard,
  ListFilter,
  Loader2,
  LogOut,
  Medal,
  Plus,
  Search,
  ShieldCheck,
  Swords,
  Target,
  Trophy,
  User,
  UserPlus,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/")({
  component: Index,
});

type Difficulty = "Easy" | "Medium" | "Hard";
type Profile = Tables<"profiles">;
type DbProblem = Tables<"problems">;
type Challenge = Tables<"challenges">;
type Problem = {
  id: string;
  userId: string;
  name: string;
  link: string;
  platform: string;
  difficulty: Difficulty;
  topic: string;
  timeTaken: number;
  notes: string;
  solvedAt: string;
};
type RivalUser = { id: string; name: string; emoji: string; title: string; username: string; rivalUserId: string | null };
type AppData = { profiles: Profile[]; problems: Problem[]; challenges: Challenge[] };

type ViewId = (typeof navItems)[number]["id"];

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "log", label: "Log Problem", icon: Plus },
  { id: "problems", label: "My Problems", icon: BookOpenCheck },
  { id: "friend-problems", label: "Friend Solved", icon: Swords },
  { id: "challenges", label: "Challenges", icon: Target },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "profile", label: "Profile", icon: User },
] as const;

const platforms = ["LeetCode", "NeetCode", "Codeforces", "HackerRank"];
const difficulties = ["Easy", "Medium", "Hard"] as const;
const topics = ["Arrays", "Graphs", "DP", "Trees", "Heap", "Sliding Window", "Binary Search", "Backtracking"];

function mapProblem(problem: DbProblem): Problem {
  return {
    id: problem.id,
    userId: problem.user_id,
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

function mapUser(profile: Profile): RivalUser {
  return {
    id: profile.user_id,
    name: profile.display_name,
    emoji: profile.emoji,
    title: profile.title,
    username: profile.username,
    rivalUserId: profile.rival_user_id,
  };
}

function userStats(problems: Problem[], userId: string) {
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
}

function getFriendId(currentUserId: string, users: RivalUser[]) {
  const current = users.find((user) => user.id === currentUserId);
  return current?.rivalUserId || users.find((user) => user.id !== currentUserId)?.id || currentUserId;
}

async function loadAppData(): Promise<AppData> {
  const [profilesResult, problemsResult, challengesResult] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("problems").select("*").order("solved_at", { ascending: false }),
    supabase.from("challenges").select("*").order("created_at", { ascending: true }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (problemsResult.error) throw problemsResult.error;
  if (challengesResult.error) throw challengesResult.error;
  return {
    profiles: profilesResult.data ?? [],
    problems: (problemsResult.data ?? []).map(mapProblem),
    challenges: challengesResult.data ?? [],
  };
}

function Index() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AppData>({ profiles: [], problems: [], challenges: [] });

  const refresh = async () => {
    try {
      setData(await loadAppData());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load app data");
    }
  };

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setSessionUserId(session?.user.id ?? null);
      setSessionEmail(session?.user.email ?? "");
      setLoading(false);
      if (session?.user.id) window.setTimeout(() => refresh(), 0);
    });
    supabase.auth.getSession().then(({ data: sessionData }) => {
      setSessionUserId(sessionData.session?.user.id ?? null);
      setSessionEmail(sessionData.session?.user.email ?? "");
      setLoading(false);
      if (sessionData.session?.user.id) refresh();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionUserId) return;
    const channel = supabase
      .channel("algobuilding-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "problems" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionUserId]);

  if (loading) return <LoadingScreen />;
  if (!sessionUserId) return <LoginPage />;

  const currentProfile = data.profiles.find((profile) => profile.user_id === sessionUserId);
  if (!currentProfile) return <ProfileSetup userId={sessionUserId} email={sessionEmail} onCreated={refresh} />;

  return <CompetitionApp currentUserId={sessionUserId} data={data} onRefresh={refresh} />;
}

function LoadingScreen() {
  return <main className="app-shell-bg flex min-h-screen items-center justify-center text-foreground"><div className="glass-panel rounded-2xl p-6"><Loader2 className="mx-auto mb-3 size-6 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Loading AlgoBuilding...</p></div></main>;
}

function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(mode === "login" ? "Welcome back to the arena" : "Check your email to verify your account");
  };

  const signInWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error(result.error.message);
  };

  return (
    <main className="rival-spotlight min-h-screen overflow-hidden px-4 py-8 text-foreground sm:px-6 lg:px-10">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-enter">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/70 px-4 py-2 text-sm text-muted-foreground"><Swords className="size-4 text-primary" /> Two friends. One streak war.</div>
          <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-normal sm:text-7xl">AlgoBuilding<span className="block text-primary">Competition Tracker</span></h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">A live competition hub where friends log solved problems, compare progress, and push each other with shared challenges.</p>
          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">{["Real accounts", "Shared progress", "Live rivalry"].map((item) => <div key={item} className="rounded-lg border border-border bg-card/70 p-4 text-sm font-semibold shadow-card"><ShieldCheck className="mb-3 size-5 text-primary" /> {item}</div>)}</div>
        </div>
        <form onSubmit={submit} className="glass-panel animate-enter rounded-2xl p-6 sm:p-8">
          <div className="mb-8"><div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl text-primary-foreground shadow-glow"><Flame /></div><h2 className="text-2xl font-bold">{mode === "login" ? "Enter the arena" : "Create your account"}</h2><p className="mt-2 text-sm text-muted-foreground">Use email/password or Google to keep progress synced across devices.</p></div>
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1"><button type="button" onClick={() => setMode("login")} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${mode === "login" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}>Login</button><button type="button" onClick={() => setMode("signup")} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${mode === "signup" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}>Sign up</button></div>
          <label className="mb-2 block text-sm font-semibold" htmlFor="email">Email</label><input id="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mb-4 h-12 w-full rounded-lg border border-input bg-background/70 px-4 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30" placeholder="you@example.com" type="email" required />
          <label className="mb-2 block text-sm font-semibold" htmlFor="password">Password</label><input id="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={6} className="mb-4 h-12 w-full rounded-lg border border-input bg-background/70 px-4 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30" placeholder="Minimum 6 characters" required />
          <Button className="h-12 w-full" variant="rival" type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Zap />} {mode === "login" ? "Login" : "Sign up"}</Button>
          <Button className="mt-3 h-12 w-full" variant="secondary" type="button" onClick={signInWithGoogle}>Continue with Google</Button>
        </form>
      </section>
    </main>
  );
}

function ProfileSetup({ userId, email, onCreated }: { userId: string; email: string; onCreated: () => Promise<void> }) {
  const baseName = email.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) || "builder";
  const [form, setForm] = useState({ username: baseName, displayName: baseName || "Algo Builder", emoji: "🚀", title: "Algo Builder" });
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("profiles").insert({ user_id: userId, username: form.username.toLowerCase(), display_name: form.displayName, emoji: form.emoji, title: form.title });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile created");
    await onCreated();
  };
  return <main className="app-shell-bg flex min-h-screen items-center justify-center px-4 text-foreground"><form onSubmit={submit} className="glass-panel w-full max-w-lg rounded-2xl p-6"><UserPlus className="mb-4 size-8 text-primary" /><h1 className="text-3xl font-black">Set up your profile</h1><p className="mt-2 text-sm text-muted-foreground">This is what your friend will see on the leaderboard.</p><div className="mt-6 grid gap-3"><input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Username" /><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Display name" /><input required value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Emoji" /><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Title" /><Button variant="rival" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Save profile</Button></div></form></main>;
}

function CompetitionApp({ currentUserId, data, onRefresh }: { currentUserId: string; data: AppData; onRefresh: () => Promise<void> }) {
  const [view, setView] = useState<ViewId>("dashboard");
  const users = data.profiles.map(mapUser);
  const user = users.find((item) => item.id === currentUserId)!;
  const friendId = getFriendId(currentUserId, users);
  const friend = users.find((item) => item.id === friendId) ?? user;
  const logout = async () => { await supabase.auth.signOut(); toast.success("Logged out"); };
  return <div className="app-shell-bg min-h-screen text-foreground lg:flex"><aside className="glass-panel sticky top-0 z-20 border-x-0 border-t-0 px-4 py-4 lg:h-screen lg:w-72 lg:border-y-0 lg:border-l-0"><div className="flex items-center justify-between lg:block"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground shadow-glow"><Swords /></div><div><p className="font-black">AlgoBuilding</p><p className="text-xs text-muted-foreground">Competition Tracker</p></div></div><Button className="lg:hidden" variant="ghost" size="icon" onClick={logout}><LogOut /></Button></div><nav className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setView(item.id)} className={`flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:bg-secondary ${view === item.id ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground"}`}><Icon className="size-4" /> {item.label}</button>; })}</nav><div className="mt-6 hidden rounded-xl border border-border bg-card/80 p-4 lg:block"><p className="text-sm text-muted-foreground">Logged in as</p><p className="mt-1 text-lg font-bold">{user.emoji} {user.name}</p><p className="text-xs text-primary">{user.title}</p><Button className="mt-4 w-full" variant="secondary" onClick={logout}><LogOut /> Logout</Button></div></aside><main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8"><Header user={user} friend={friend} />{view === "dashboard" && <Dashboard currentUserId={currentUserId} data={data} users={users} />}{view === "leaderboard" && <Leaderboard users={users} problems={data.problems} />}{view === "log" && <LogProblem currentUserId={currentUserId} onRefresh={onRefresh} />}{view === "problems" && <MyProblems currentUserId={currentUserId} problems={data.problems} />}{view === "friend-problems" && <FriendProblems currentUserId={currentUserId} users={users} problems={data.problems} />}{view === "challenges" && <Challenges challenges={data.challenges} users={users} problems={data.problems} />}{view === "analytics" && <Analytics currentUserId={currentUserId} users={users} problems={data.problems} />}{view === "profile" && <Profile currentUserId={currentUserId} profiles={data.profiles} users={users} problems={data.problems} onRefresh={onRefresh} />}</main></div>;
}

function Header({ user, friend }: { user: RivalUser; friend: RivalUser }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return <header className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card/70 p-5 shadow-card sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-primary">Rival: {friend.name} {friend.emoji}</p><h2 className="text-3xl font-black">{greeting}, {user.name}! {user.emoji}</h2></div><div className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground"><Flame className="mr-2 inline size-4 text-accent" /> Live shared progress.</div></header>;
}

function Dashboard({ currentUserId, data, users }: { currentUserId: string; data: AppData; users: RivalUser[] }) {
  const mine = userStats(data.problems, currentUserId);
  const friendId = getFriendId(currentUserId, users);
  const rival = userStats(data.problems, friendId);
  const user = users.find((item) => item.id === currentUserId)!;
  const friend = users.find((item) => item.id === friendId) ?? user;
  const recent = [...data.problems].sort((a, b) => +new Date(b.solvedAt) - +new Date(a.solvedAt)).slice(0, 6);
  return <section className="animate-enter space-y-6"><div className="grid gap-4 md:grid-cols-4">{([{ label: "Total Solved", value: mine.total, Icon: Trophy }, { label: "Today", value: mine.today, Icon: Zap }, { label: "Current Streak", value: `${mine.streak} days`, Icon: Flame }, { label: "Weekly Progress", value: mine.week, Icon: Activity }] satisfies Array<{ label: string; value: React.ReactNode; Icon: LucideIcon }>).map((item) => <StatCard key={item.label} {...item} />)}</div><div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]"><div className="glass-panel rounded-2xl p-5"><h3 className="mb-4 text-xl font-bold">Friend Comparison</h3><div className="grid gap-4 sm:grid-cols-2"><RivalCard user={user} stats={mine} highlight /><RivalCard user={friend} stats={rival} /></div></div><div className="glass-panel rounded-2xl p-5"><h3 className="mb-4 text-xl font-bold">Quick Log Solved Problem</h3><LogProblem currentUserId={currentUserId} compact /></div></div><div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]"><RecentActivity problems={recent} users={users} /><Heatmap currentUserId={currentUserId} problems={data.problems} /></div></section>;
}

function StatCard({ label, value, Icon }: { label: string; value: React.ReactNode; Icon: LucideIcon }) {
  return <div className="card-gradient rounded-2xl border border-border p-5 shadow-card transition hover:-translate-y-1"><Icon className="mb-4 size-5 text-primary" /><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>;
}

function RivalCard({ user, stats, highlight }: { user: RivalUser; stats: ReturnType<typeof userStats>; highlight?: boolean }) {
  return <div className={`rounded-xl border p-5 ${highlight ? "border-primary bg-primary/10" : "border-border bg-card/70"}`}><div className="text-3xl">{user.emoji}</div><h4 className="mt-2 text-xl font-black">{user.name}</h4><p className="text-sm text-muted-foreground">{user.title}</p><div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><span>{stats.total}<small className="block text-muted-foreground">total</small></span><span>{stats.week}<small className="block text-muted-foreground">week</small></span><span>{stats.streak}<small className="block text-muted-foreground">streak</small></span></div></div>;
}

function LogProblem({ currentUserId, compact = false, onRefresh }: { currentUserId: string; compact?: boolean; onRefresh?: () => Promise<void> }) {
  const [form, setForm] = useState({ name: "", link: "", platform: "LeetCode", difficulty: "Medium", topic: "Arrays", timeTaken: "25", notes: "" });
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!form.name.trim()) return; const { error } = await supabase.from("problems").insert({ user_id: currentUserId, name: form.name.trim(), link: form.link.trim(), platform: form.platform, difficulty: form.difficulty, topic: form.topic, time_taken: Number(form.timeTaken) || 0, notes: form.notes.trim() }); if (error) { toast.error(error.message); return; } toast.success("Problem logged. Streak protected!"); setForm({ ...form, name: "", link: "", notes: "" }); await onRefresh?.(); };
  return <form onSubmit={submit} className={`grid gap-3 ${compact ? "" : "glass-panel animate-enter rounded-2xl p-5 md:grid-cols-2"}`}><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Problem name" /><input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Problem URL" /><Select value={form.platform} options={platforms} onChange={(value) => setForm({ ...form, platform: value })} /><Select value={form.difficulty} options={[...difficulties]} onChange={(value) => setForm({ ...form, difficulty: value })} /><Select value={form.topic} options={topics} onChange={(value) => setForm({ ...form, topic: value })} /><input value={form.timeTaken} onChange={(e) => setForm({ ...form, timeTaken: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Time taken (min)" /><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-24 rounded-lg border border-input bg-background/70 px-3 py-3 outline-none focus:ring-2 focus:ring-primary/30 md:col-span-2" placeholder="Notes" /><Button variant="rival" className="md:col-span-2"><Plus /> Log Solved Problem</Button></form>;
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30">{options.map((option) => <option key={option}>{option}</option>)}</select>;
}

function RecentActivity({ problems, users }: { problems: Problem[]; users: RivalUser[] }) {
  return <div className="glass-panel rounded-2xl p-5"><h3 className="mb-4 text-xl font-bold">Recent Activity</h3><div className="space-y-3">{problems.map((problem) => { const user = users.find((item) => item.id === problem.userId); return <div key={problem.id} className="flex items-center justify-between rounded-lg bg-secondary/60 p-3"><div><p className="font-semibold">{user?.emoji ?? "🚀"} {problem.name}</p><p className="text-xs text-muted-foreground">{problem.platform} · {problem.topic} · {problem.difficulty}</p></div><span className="text-xs text-muted-foreground">{new Date(problem.solvedAt).toLocaleDateString()}</span></div>; })}</div></div>;
}

function Heatmap({ currentUserId, problems }: { currentUserId: string; problems: Problem[] }) {
  const mine = problems.filter((problem) => problem.userId === currentUserId);
  const cells = Array.from({ length: 49 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (48 - index)); return mine.filter((problem) => new Date(problem.solvedAt).toDateString() === date.toDateString()).length; });
  return <div className="glass-panel rounded-2xl p-5"><h3 className="mb-4 text-xl font-bold">Contribution Heatmap</h3><div className="grid grid-cols-7 gap-2">{cells.map((count, index) => <div key={index} title={`${count} solved`} className={`aspect-square rounded ${count === 0 ? "bg-muted" : count === 1 ? "bg-heat-1" : count === 2 ? "bg-heat-2" : count === 3 ? "bg-heat-3" : "bg-heat-4"}`} />)}</div></div>;
}

function Leaderboard({ users, problems }: { users: RivalUser[]; problems: Problem[] }) {
  const ranked = [...users].sort((a, b) => userStats(problems, b.id).total - userStats(problems, a.id).total);
  return <section className="glass-panel animate-enter rounded-2xl p-5"><h3 className="mb-5 text-2xl font-black">Leaderboard</h3>{ranked.length === 0 && <p className="text-sm text-muted-foreground">No builders yet.</p>}{ranked.map((user, index) => <div key={user.id} className="mb-3 flex items-center justify-between rounded-xl bg-card/80 p-4"><div className="flex items-center gap-4"><span className="text-2xl">{index === 0 ? "🥇" : index === 1 ? "🥈" : "🏅"}</span><div><p className="text-lg font-bold">{user.emoji} {user.name}</p><p className="text-sm text-muted-foreground">@{user.username}</p></div></div><div className="text-right"><p className="text-2xl font-black">{userStats(problems, user.id).total}</p><p className="text-xs text-muted-foreground">total solved</p></div></div>)}</section>;
}

function MyProblems({ currentUserId, problems }: { currentUserId: string; problems: Problem[] }) {
  const mine = problems.filter((problem) => problem.userId === currentUserId);
  const [filter, setFilter] = useState("");
  const filtered = mine.filter((problem) => `${problem.platform} ${problem.difficulty} ${problem.topic} ${problem.name}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="glass-panel animate-enter rounded-2xl p-5"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row"><h3 className="text-2xl font-black">My Problems</h3><label className="flex items-center gap-2 rounded-lg border border-input bg-background/70 px-3"><Search className="size-4 text-muted-foreground" /><input value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 bg-transparent outline-none" placeholder="Filter platform, topic..." /></label></div><ProblemTable problems={filtered} /></section>;
}

function FriendProblems({ currentUserId, users, problems }: { currentUserId: string; users: RivalUser[]; problems: Problem[] }) {
  const friendId = getFriendId(currentUserId, users);
  const friend = users.find((item) => item.id === friendId) ?? users.find((item) => item.id === currentUserId)!;
  const solvedByMe = new Set(problems.filter((problem) => problem.userId === currentUserId).map((problem) => problem.name.toLowerCase()));
  const friendProblems = problems.filter((problem) => problem.userId === friendId);
  const [filter, setFilter] = useState("");
  const filtered = friendProblems.filter((problem) => `${problem.platform} ${problem.difficulty} ${problem.topic} ${problem.name}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="glass-panel animate-enter rounded-2xl p-5"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row"><div><h3 className="text-2xl font-black">{friend.name}'s Solved Problems</h3><p className="mt-1 text-sm text-muted-foreground">See what your friend solved and choose your next target.</p></div><label className="flex items-center gap-2 rounded-lg border border-input bg-background/70 px-3"><Search className="size-4 text-muted-foreground" /><input value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 bg-transparent outline-none" placeholder="Filter friend problems..." /></label></div><div className="grid gap-3">{filtered.length === 0 && <p className="text-sm text-muted-foreground">No friend problems yet. Invite your friend to sign up and log problems.</p>}{filtered.map((problem) => { const alreadySolved = solvedByMe.has(problem.name.toLowerCase()); return <div key={problem.id} className="rounded-xl border border-border bg-card/80 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-lg font-bold">{problem.name}</p><p className="mt-1 text-sm text-muted-foreground">{problem.platform} · {problem.topic} · {problem.difficulty} · {problem.timeTaken}m</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${alreadySolved ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>{alreadySolved ? "You solved it" : "Try this next"}</span>{problem.link && <a href={problem.link} target="_blank" rel="noreferrer" className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-secondary text-foreground transition hover:bg-accent hover:text-accent-foreground" aria-label={`Open ${problem.name}`}><ExternalLink className="size-4" /></a>}</div></div><p className="mt-3 text-xs text-muted-foreground">Solved on {new Date(problem.solvedAt).toLocaleDateString()}</p></div>; })}</div></section>;
}

function ProblemTable({ problems }: { problems: Problem[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-muted-foreground"><tr><th className="py-3">Problem</th><th>Platform</th><th>Difficulty</th><th>Topic</th><th>Time</th><th>Date</th></tr></thead><tbody>{problems.map((problem) => <tr key={problem.id} className="border-t border-border"><td className="py-3 font-semibold">{problem.link ? <a className="transition hover:text-primary" href={problem.link} target="_blank" rel="noreferrer">{problem.name}</a> : problem.name}</td><td>{problem.platform}</td><td>{problem.difficulty}</td><td>{problem.topic}</td><td>{problem.timeTaken}m</td><td>{new Date(problem.solvedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>;
}

function Challenges({ challenges, users, problems }: { challenges: Challenge[]; users: RivalUser[]; problems: Problem[] }) {
  return <section className="animate-enter grid gap-4 lg:grid-cols-3">{challenges.map((challenge) => <div key={challenge.id} className="glass-panel rounded-2xl p-5"><Target className="mb-4 size-6 text-accent" /><h3 className="text-xl font-black">{challenge.title}</h3><p className="mb-4 text-sm text-muted-foreground">{challenge.topic} · Reward {challenge.reward}</p>{users.map((user) => { const count = problems.filter((problem) => problem.userId === user.id && (problem.topic === challenge.topic || problem.difficulty === challenge.topic)).length; return <div key={user.id} className="mb-3"><div className="mb-1 flex justify-between text-sm"><span>{user.emoji} {user.name}</span><span>{count}/{challenge.target}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, (count / challenge.target) * 100)}%` }} /></div></div>; })}</div>)}</section>;
}

function Analytics({ currentUserId, users, problems }: { currentUserId: string; users: RivalUser[]; problems: Problem[] }) {
  const friendId = getFriendId(currentUserId, users);
  const mine = problems.filter((problem) => problem.userId === currentUserId);
  const friend = problems.filter((problem) => problem.userId === friendId);
  const byTopic = useMemo(() => topics.slice(0, 6).map((topic) => ({ topic, mine: mine.filter((p) => p.topic === topic).length, friend: friend.filter((p) => p.topic === topic).length })), [mine, friend]);
  return <section className="glass-panel animate-enter rounded-2xl p-5"><h3 className="mb-5 text-2xl font-black">Analytics</h3><div className="space-y-4">{byTopic.map((row) => <div key={row.topic} className="grid items-center gap-3 sm:grid-cols-[140px_1fr_48px]"><span className="font-semibold">{row.topic}</span><div className="space-y-2"><div className="h-3 rounded-full bg-muted"><div className="h-3 rounded-full bg-primary" style={{ width: `${Math.min(100, row.mine * 18)}%` }} /></div><div className="h-3 rounded-full bg-muted"><div className="h-3 rounded-full bg-accent" style={{ width: `${Math.min(100, row.friend * 18)}%` }} /></div></div><span className="text-sm text-muted-foreground">{row.mine}/{row.friend}</span></div>)}</div><p className="mt-5 text-sm text-muted-foreground"><span className="text-primary">Primary</span> is you, <span className="text-accent">accent</span> is your friend.</p></section>;
}

function Profile({ currentUserId, profiles, users, problems, onRefresh }: { currentUserId: string; profiles: Profile[]; users: RivalUser[]; problems: Problem[]; onRefresh: () => Promise<void> }) {
  const profile = profiles.find((item) => item.user_id === currentUserId)!;
  const user = mapUser(profile);
  const stats = userStats(problems, currentUserId);
  const [rivalUsername, setRivalUsername] = useState(users.find((item) => item.id === profile.rival_user_id)?.username ?? "");
  const saveRival = async () => { const rival = users.find((item) => item.username.toLowerCase() === rivalUsername.trim().toLowerCase()); if (!rival || rival.id === currentUserId) { toast.error("Enter a valid friend's username"); return; } const { error } = await supabase.from("profiles").update({ rival_user_id: rival.id }).eq("user_id", currentUserId); if (error) { toast.error(error.message); return; } toast.success("Rival updated"); await onRefresh(); };
  return <section className="glass-panel animate-enter rounded-2xl p-6"><div className="text-7xl">{user.emoji}</div><h3 className="mt-4 text-3xl font-black">{user.name}</h3><p className="text-primary">@{user.username} · {user.title}</p><div className="mt-6 grid gap-4 sm:grid-cols-4"><StatCard label="Solved" value={stats.total} Icon={Medal} /><StatCard label="This Week" value={stats.week} Icon={ListFilter} /><StatCard label="Hard Wins" value={stats.hard} Icon={Swords} /><StatCard label="Minutes" value={stats.minutes} Icon={Activity} /></div><div className="mt-6 rounded-xl border border-border bg-card/70 p-4"><h4 className="font-bold">Choose your friend</h4><p className="mt-1 text-sm text-muted-foreground">Enter your friend's username to compare directly.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={rivalUsername} onChange={(e) => setRivalUsername(e.target.value)} className="h-11 flex-1 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="friend_username" /><Button type="button" variant="rival" onClick={saveRival}>Save Rival</Button></div></div></section>;
}
