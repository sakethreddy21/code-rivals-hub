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
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Index,
});

type Difficulty = "Easy" | "Medium" | "Hard";

// Custom types matching our new schema
type Account = { id: string; username: string };
type Profile = {
  id: string;
  account_id: string;
  username: string;
  display_name: string;
  emoji: string;
  title: string;
  rival_user_id: string | null;
  created_at: string;
};
type Problem = {
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
type Challenge = {
  id: string;
  title: string;
  target: number;
  topic: string;
  reward: string;
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

const platforms = ["LeetCode", "NeetCode", "Codeforces", "HackerRank", "Custom..."];
const difficulties = ["Easy", "Medium", "Hard"] as const;
const topics = ["Arrays", "Graphs", "DP", "Trees", "Heap", "Sliding Window", "Binary Search", "Backtracking", "Custom..."];

function mapProblem(problem: any): Problem {
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

function mapUser(profile: Profile): RivalUser {
  return {
    id: profile.account_id,
    name: profile.display_name,
    emoji: profile.emoji,
    title: profile.title,
    username: profile.username,
    rivalUserId: profile.rival_user_id,
  };
}

function userStats(problems: Problem[], accountId: string) {
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

function getFriendId(currentAccountId: string, users: RivalUser[]) {
  const current = users.find((user) => user.id === currentAccountId);
  return current?.rivalUserId || users.find((user) => user.id !== currentAccountId)?.id || currentAccountId;
}

async function loadAppData(): Promise<AppData> {
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

function Index() {
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(localStorage.getItem("rivals_account_id"));
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
    setLoading(false);
    if (currentAccountId) refresh();
  }, [currentAccountId]);

  useEffect(() => {
    if (!currentAccountId) return;
    const channel = supabase
      .channel("rivals-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "problems" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentAccountId]);

  if (loading) return <LoadingScreen />;
  if (!currentAccountId) return <LoginPage onLogin={(id) => setCurrentAccountId(id)} />;

  const currentProfile = data.profiles.find((profile) => profile.account_id === currentAccountId);
  if (!currentProfile) return <ProfileSetup accountId={currentAccountId} onCreated={refresh} />;

  return <CompetitionApp currentAccountId={currentAccountId} data={data} onRefresh={refresh} onLogout={() => setCurrentAccountId(null)} />;
}

function LoadingScreen() {
  return <main className="app-shell-bg flex min-h-screen items-center justify-center text-foreground"><div className="glass-panel rounded-2xl p-6"><Loader2 className="mx-auto mb-3 size-6 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Loading AlgoBuilding...</p></div></main>;
}

function LoginPage({ onLogin }: { onLogin: (id: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter both username and password");
      return;
    }
    
    setBusy(true);
    const uname = username.trim().toLowerCase();

    // 1. Try to find the account
    const { data: account, error: findError } = await supabase
      .from("accounts" as any)
      .select("*")
      .eq("username", uname)
      .maybeSingle();

    if (findError) {
      toast.error(findError.message);
      setBusy(false);
      return;
    }

    if (account) {
      const acc = account as any;
      // 2. Check password
      if (acc.password === password) {
        localStorage.setItem("rivals_account_id", acc.id);
        onLogin(acc.id);
        toast.success("Welcome back!");
      } else {
        toast.error("Invalid password for this username");
      }
    } else {
      // 3. Auto-Join: Create new account
      const { data: newAccount, error: createError } = await supabase
        .from("accounts" as any)
        .insert({ username: uname, password })
        .select()
        .single();

      if (createError) {
        toast.error(createError.message);
      } else {
        const nAcc = newAccount as any;
        localStorage.setItem("rivals_account_id", nAcc.id);
        onLogin(nAcc.id);
        toast.success("Account created! Welcome to the arena.");
      }
    }
    
    setBusy(false);
  };

  return (
    <main className="rival-spotlight min-h-screen overflow-hidden px-4 py-8 text-foreground sm:px-6 lg:px-10">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-enter">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/70 px-4 py-2 text-sm text-muted-foreground">
            <Swords className="size-4 text-primary" /> Two friends. One streak war.
          </div>
          <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-normal sm:text-7xl">
            AlgoBuilding<span className="block text-primary">Competition Tracker</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            A live competition hub where friends log solved problems, compare progress, and push each other with shared challenges.
          </p>
          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            {["No Email Needed", "Simple Username", "Live rivalry"].map((item) => (
              <div key={item} className="rounded-lg border border-border bg-card/70 p-4 text-sm font-semibold shadow-card">
                <ShieldCheck className="mb-3 size-5 text-primary" /> {item}
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={submit} className="glass-panel animate-enter rounded-2xl p-6 sm:p-8">
          <div className="mb-8">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl text-primary-foreground shadow-glow">
              <Flame />
            </div>
            <h2 className="text-2xl font-bold">Enter the arena</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter a username and password. New here? Your account will be created automatically.
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-12 w-full rounded-lg border border-input bg-background/70 px-4 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                placeholder="Pick a username"
                type="text"
                required
              />
            </div>
            
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                className="h-12 w-full rounded-lg border border-input bg-background/70 px-4 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                placeholder="Any password works"
                required
              />
            </div>
            
            <Button className="mt-2 h-12 w-full" variant="rival" type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Zap />} Enter Arena
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}

function ProfileSetup({ accountId, onCreated }: { accountId: string; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ username: "", displayName: "", emoji: "🚀", title: "Algo Builder" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Try to get username from accounts table
    supabase.from("accounts" as any).select("username").eq("id", accountId).single().then(({ data }) => {
      if (data) setForm(f => ({ ...f, username: (data as any).username, displayName: (data as any).username }));
    });
  }, [accountId]);

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("profiles" as any).insert({ 
      account_id: accountId, 
      username: form.username.toLowerCase(), 
      display_name: form.displayName, 
      emoji: form.emoji, 
      title: form.title 
    });
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

function CompetitionApp({ currentAccountId, data, onRefresh, onLogout }: { currentAccountId: string; data: AppData; onRefresh: () => Promise<void>; onLogout: () => void }) {
  const [view, setView] = useState<ViewId>("dashboard");
  const users = data.profiles.map(mapUser);
  const user = users.find((item) => item.id === currentAccountId)!;
  const friendId = getFriendId(currentAccountId, users);
  const friend = users.find((item) => item.id === friendId) ?? user;
  
  const logout = () => { 
    localStorage.removeItem("rivals_account_id");
    onLogout();
    toast.success("Logged out"); 
  };

  return <div className="app-shell-bg min-h-screen text-foreground lg:flex"><aside className="glass-panel sticky top-0 z-20 border-x-0 border-t-0 px-4 py-4 lg:h-screen lg:w-72 lg:border-y-0 lg:border-l-0"><div className="flex items-center justify-between lg:block"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground shadow-glow"><Swords /></div><div><p className="font-black">AlgoBuilding</p><p className="text-xs text-muted-foreground">Competition Tracker</p></div></div><Button className="lg:hidden" variant="ghost" size="icon" onClick={logout}><LogOut /></Button></div><nav className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setView(item.id)} className={`flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:bg-secondary ${view === item.id ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground"}`}><Icon className="size-4" /> {item.label}</button>; })}</nav><div className="mt-6 hidden rounded-xl border border-border bg-card/80 p-4 lg:block"><p className="text-sm text-muted-foreground">Logged in as</p><p className="mt-1 text-lg font-bold">{user.emoji} {user.name}</p><p className="text-xs text-primary">{user.title}</p><Button className="mt-4 w-full" variant="secondary" onClick={logout}><LogOut /> Logout</Button></div></aside><main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8"><Header user={user} friend={friend} />{view === "dashboard" && <Dashboard currentAccountId={currentAccountId} data={data} users={users} />}{view === "leaderboard" && <Leaderboard users={users} problems={data.problems} />}{view === "log" && <LogProblem currentAccountId={currentAccountId} data={data} onRefresh={onRefresh} />}{view === "problems" && <MyProblems currentAccountId={currentAccountId} problems={data.problems} />}{view === "friend-problems" && <FriendProblems currentAccountId={currentAccountId} users={users} problems={data.problems} />}{view === "challenges" && <Challenges challenges={data.challenges} users={users} problems={data.problems} />}{view === "analytics" && <Analytics currentAccountId={currentAccountId} users={users} problems={data.problems} />}{view === "profile" && <Profile currentAccountId={currentAccountId} profiles={data.profiles} users={users} problems={data.problems} onRefresh={onRefresh} />}</main></div>;
}

function Header({ user, friend }: { user: RivalUser; friend: RivalUser }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return <header className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card/70 p-5 shadow-card sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-primary">Rival: {friend.name} {friend.emoji}</p><h2 className="text-3xl font-black">{greeting}, {user.name}! {user.emoji}</h2></div><div className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground"><Flame className="mr-2 inline size-4 text-accent" /> Live shared progress.</div></header>;
}

function Dashboard({ currentAccountId, data, users }: { currentAccountId: string; data: AppData; users: RivalUser[] }) {
  const mine = userStats(data.problems, currentAccountId);
  const friendId = getFriendId(currentAccountId, users);
  const rival = userStats(data.problems, friendId);
  const user = users.find((item) => item.id === currentAccountId)!;
  const friend = users.find((item) => item.id === friendId) ?? user;
  const recent = [...data.problems].sort((a, b) => +new Date(b.solvedAt) - +new Date(a.solvedAt)).slice(0, 6);
  return <section className="animate-enter space-y-6"><div className="grid gap-4 md:grid-cols-4">{([{ label: "Total Solved", value: mine.total, Icon: Trophy }, { label: "Today", value: mine.today, Icon: Zap }, { label: "Current Streak", value: `${mine.streak} days`, Icon: Flame }, { label: "Weekly Progress", value: mine.week, Icon: Activity }] satisfies Array<{ label: string; value: React.ReactNode; Icon: LucideIcon }>).map((item) => <StatCard key={item.label} {...item} />)}</div><div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]"><div className="glass-panel rounded-2xl p-5"><h3 className="mb-4 text-xl font-bold">Friend Comparison</h3><div className="grid gap-4 sm:grid-cols-2"><RivalCard user={user} stats={mine} highlight /><RivalCard user={friend} stats={rival} /></div></div><div className="glass-panel rounded-2xl p-5"><h3 className="mb-4 text-xl font-bold">Quick Log Solved Problem</h3><LogProblem currentAccountId={currentAccountId} data={data} compact /></div></div><div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]"><RecentActivity problems={recent} users={users} /><Heatmap currentAccountId={currentAccountId} problems={data.problems} /></div></section>;
}

function StatCard({ label, value, Icon }: { label: string; value: React.ReactNode; Icon: LucideIcon }) {
  return <div className="card-gradient rounded-2xl border border-border p-5 shadow-card transition hover:-translate-y-1"><Icon className="mb-4 size-5 text-primary" /><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>;
}

function RivalCard({ user, stats, highlight }: { user: RivalUser; stats: ReturnType<typeof userStats>; highlight?: boolean }) {
  return <div className={`rounded-xl border p-5 ${highlight ? "border-primary bg-primary/10" : "border-border bg-card/70"}`}><div className="text-3xl">{user.emoji}</div><h4 className="mt-2 text-xl font-black">{user.name}</h4><p className="text-sm text-muted-foreground">{user.title}</p><div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><span>{stats.total}<small className="block text-muted-foreground">total</small></span><span>{stats.week}<small className="block text-muted-foreground">week</small></span><span>{stats.streak}<small className="block text-muted-foreground">streak</small></span></div></div>;
}

function LogProblem({ currentAccountId, data, compact = false, onRefresh }: { currentAccountId: string; data?: AppData; compact?: boolean; onRefresh?: () => Promise<void> }) {
  const [form, setForm] = useState({ 
    name: "", 
    link: "", 
    platform: "LeetCode", 
    customPlatform: "",
    difficulty: "Medium", 
    topic: "Arrays", 
    customTopic: "",
    timeTaken: "25", 
    notes: "" 
  });

  // Dynamically calculate available platforms and topics from existing data
  const dynamicOptions = useMemo(() => {
    if (!data) return { platforms: platforms, topics: topics };
    
    const existingPlatforms = Array.from(new Set(data.problems.map(p => p.platform)));
    const existingTopics = Array.from(new Set(data.problems.map(p => p.topic)));
    
    // Merge defaults with existing, unique values
    const finalPlatforms = Array.from(new Set([...platforms.filter(p => p !== "Custom..."), ...existingPlatforms])).sort();
    const finalTopics = Array.from(new Set([...topics.filter(t => t !== "Custom..."), ...existingTopics])).sort();
    
    return {
      platforms: [...finalPlatforms, "Custom..."],
      topics: [...finalTopics, "Custom..."]
    };
  }, [data]);

  const submit = async (event: React.SyntheticEvent) => { 
    event.preventDefault(); 
    if (!form.name.trim()) return; 

    const finalPlatform = form.platform === "Custom..." ? form.customPlatform.trim() : form.platform;
    const finalTopic = form.topic === "Custom..." ? form.customTopic.trim() : form.topic;

    if (!finalPlatform) {
      toast.error("Please provide a platform name");
      return;
    }
    if (!finalTopic) {
      toast.error("Please provide a topic name");
      return;
    }

    const { error } = await supabase.from("problems" as any).insert({ 
      account_id: currentAccountId, 
      name: form.name.trim(), 
      link: form.link.trim(), 
      platform: finalPlatform, 
      difficulty: form.difficulty, 
      topic: finalTopic, 
      time_taken: Number(form.timeTaken) || 0, 
      notes: form.notes.trim() 
    }); 

    if (error) { 
      toast.error(error.message); 
      return; 
    } 
    toast.success("Problem logged. Streak protected!"); 
    setForm({ ...form, name: "", link: "", notes: "", customPlatform: "", customTopic: "" }); 
    await onRefresh?.(); 
  };

  return (
    <form onSubmit={submit} className={`grid gap-3 ${compact ? "" : "glass-panel animate-enter rounded-2xl p-5 md:grid-cols-2"}`}>
      <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Problem name" />
      <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Problem URL" />
      
      <div className="space-y-2">
        <Select value={form.platform} options={dynamicOptions.platforms} onChange={(value) => setForm({ ...form, platform: value })} />
        {form.platform === "Custom..." && (
          <input required value={form.customPlatform} onChange={(e) => setForm({ ...form, customPlatform: e.target.value })} className="h-11 w-full rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30 animate-in slide-in-from-top-1" placeholder="Enter platform name" />
        )}
      </div>

      <div className="space-y-2">
        <Select value={form.topic} options={dynamicOptions.topics} onChange={(value) => setForm({ ...form, topic: value })} />
        {form.topic === "Custom..." && (
          <input required value={form.customTopic} onChange={(e) => setForm({ ...form, customTopic: e.target.value })} className="h-11 w-full rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30 animate-in slide-in-from-top-1" placeholder="Enter topic name" />
        )}
      </div>

      <Select value={form.difficulty} options={[...difficulties]} onChange={(value) => setForm({ ...form, difficulty: value })} />
      <input value={form.timeTaken} onChange={(e) => setForm({ ...form, timeTaken: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Time taken (min)" />
      
      <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-24 rounded-lg border border-input bg-background/70 px-3 py-3 outline-none focus:ring-2 focus:ring-primary/30 md:col-span-2" placeholder="Notes" />
      
      <Button variant="rival" className="md:col-span-2">
        <Plus /> Log Solved Problem
      </Button>
    </form>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30">{options.map((option) => <option key={option}>{option}</option>)}</select>;
}

function RecentActivity({ problems, users }: { problems: Problem[]; users: RivalUser[] }) {
  return <div className="glass-panel rounded-2xl p-5"><h3 className="mb-4 text-xl font-bold">Recent Activity</h3><div className="space-y-3">{problems.map((problem) => { const user = users.find((item) => item.id === problem.accountId); return <div key={problem.id} className="flex items-center justify-between rounded-lg bg-secondary/60 p-3"><div><p className="font-semibold">{user?.emoji ?? "🚀"} {problem.name}</p><p className="text-xs text-muted-foreground">{problem.platform} · {problem.topic} · {problem.difficulty}</p></div><span className="text-xs text-muted-foreground">{new Date(problem.solvedAt).toLocaleDateString()}</span></div>; })}</div></div>;
}

function Heatmap({ currentAccountId, problems }: { currentAccountId: string; problems: Problem[] }) {
  const mine = problems.filter((problem) => problem.accountId === currentAccountId);
  const cells = Array.from({ length: 49 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (48 - index)); return mine.filter((problem) => new Date(problem.solvedAt).toDateString() === date.toDateString()).length; });
  return <div className="glass-panel rounded-2xl p-5"><h3 className="mb-4 text-xl font-bold">Contribution Heatmap</h3><div className="grid grid-cols-7 gap-2">{cells.map((count, index) => <div key={index} title={`${count} solved`} className={`aspect-square rounded ${count === 0 ? "bg-muted" : count === 1 ? "bg-heat-1" : count === 2 ? "bg-heat-2" : count === 3 ? "bg-heat-3" : "bg-heat-4"}`} />)}</div></div>;
}

function Leaderboard({ users, problems }: { users: RivalUser[]; problems: Problem[] }) {
  const ranked = [...users].sort((a, b) => userStats(problems, b.id).total - userStats(problems, a.id).total);
  return <section className="glass-panel animate-enter rounded-2xl p-5"><h3 className="mb-5 text-2xl font-black">Leaderboard</h3>{ranked.length === 0 && <p className="text-sm text-muted-foreground">No builders yet.</p>}{ranked.map((user, index) => <div key={user.id} className="mb-3 flex items-center justify-between rounded-xl bg-card/80 p-4"><div className="flex items-center gap-4"><span className="text-2xl">{index === 0 ? "🥇" : index === 1 ? "🥈" : "🏅"}</span><div><p className="text-lg font-bold">{user.emoji} {user.name}</p><p className="text-sm text-muted-foreground">@{user.username}</p></div></div><div className="text-right"><p className="text-2xl font-black">{userStats(problems, user.id).total}</p><p className="text-xs text-muted-foreground">total solved</p></div></div>)}</section>;
}

function MyProblems({ currentAccountId, problems }: { currentAccountId: string; problems: Problem[] }) {
  const mine = problems.filter((problem) => problem.accountId === currentAccountId);
  const [filter, setFilter] = useState("");
  const filtered = mine.filter((problem) => `${problem.platform} ${problem.difficulty} ${problem.topic} ${problem.name}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="glass-panel animate-enter rounded-2xl p-5"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row"><h3 className="text-2xl font-black">My Problems</h3><label className="flex items-center gap-2 rounded-lg border border-input bg-background/70 px-3"><Search className="size-4 text-muted-foreground" /><input value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 bg-transparent outline-none" placeholder="Filter platform, topic..." /></label></div><ProblemTable problems={filtered} /></section>;
}

function FriendProblems({ currentAccountId, users, problems }: { currentAccountId: string; users: RivalUser[]; problems: Problem[] }) {
  const friendId = getFriendId(currentAccountId, users);
  const friend = users.find((item) => item.id === friendId) ?? users.find((item) => item.id === currentAccountId)!;
  const solvedByMe = new Set(problems.filter((problem) => problem.accountId === currentAccountId).map((problem) => problem.name.toLowerCase()));
  const friendProblems = problems.filter((problem) => problem.accountId === friendId);
  const [filter, setFilter] = useState("");
  const filtered = friendProblems.filter((problem) => `${problem.platform} ${problem.difficulty} ${problem.topic} ${problem.name}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="glass-panel animate-enter rounded-2xl p-5"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row"><div><h3 className="text-2xl font-black">{friend.name}'s Solved Problems</h3><p className="mt-1 text-sm text-muted-foreground">See what your friend solved and choose your next target.</p></div><label className="flex items-center gap-2 rounded-lg border border-input bg-background/70 px-3"><Search className="size-4 text-muted-foreground" /><input value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 bg-transparent outline-none" placeholder="Filter friend problems..." /></label></div><div className="grid gap-3">{filtered.length === 0 && <p className="text-sm text-muted-foreground">No friend problems yet. Invite your friend to sign up and log problems.</p>}{filtered.map((problem) => { const alreadySolved = solvedByMe.has(problem.name.toLowerCase()); return <div key={problem.id} className="rounded-xl border border-border bg-card/80 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-lg font-bold">{problem.name}</p><p className="mt-1 text-sm text-muted-foreground">{problem.platform} · {problem.topic} · {problem.difficulty} · {problem.timeTaken}m</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${alreadySolved ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>{alreadySolved ? "You solved it" : "Try this next"}</span>{problem.link && <a href={problem.link} target="_blank" rel="noreferrer" className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-secondary text-foreground transition hover:bg-accent hover:text-accent-foreground" aria-label={`Open ${problem.name}`}><ExternalLink className="size-4" /></a>}</div></div><p className="mt-3 text-xs text-muted-foreground">Solved on {new Date(problem.solvedAt).toLocaleDateString()}</p></div>; })}</div></section>;
}

function ProblemTable({ problems }: { problems: Problem[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-muted-foreground"><tr><th className="py-3">Problem</th><th>Platform</th><th>Difficulty</th><th>Topic</th><th>Time</th><th>Date</th></tr></thead><tbody>{problems.map((problem) => <tr key={problem.id} className="border-t border-border"><td className="py-3 font-semibold">{problem.link ? <a className="transition hover:text-primary" href={problem.link} target="_blank" rel="noreferrer">{problem.name}</a> : problem.name}</td><td>{problem.platform}</td><td>{problem.difficulty}</td><td>{problem.topic}</td><td>{problem.timeTaken}m</td><td>{new Date(problem.solvedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>;
}

function Challenges({ challenges, users, problems }: { challenges: Challenge[]; users: RivalUser[]; problems: Problem[] }) {
  return <section className="animate-enter grid gap-4 lg:grid-cols-3">{challenges.map((challenge) => <div key={challenge.id} className="glass-panel rounded-2xl p-5"><Target className="mb-4 size-6 text-accent" /><h3 className="text-xl font-black">{challenge.title}</h3><p className="mb-4 text-sm text-muted-foreground">{challenge.topic} · Reward {challenge.reward}</p>{users.map((user) => { const count = problems.filter((problem) => problem.id === user.id && (problem.topic === challenge.topic || (challenge.topic === 'Easy' && problem.difficulty === 'Easy'))).length; return <div key={user.id} className="mb-3"><div className="mb-1 flex justify-between text-sm"><span>{user.emoji} {user.name}</span><span>{count}/{challenge.target}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, (count / challenge.target) * 100)}%` }} /></div></div>; })}</div>)}</section>;
}

function Analytics({ currentAccountId, users, problems }: { currentAccountId: string; users: RivalUser[]; problems: Problem[] }) {
  const friendId = getFriendId(currentAccountId, users);
  const mine = problems.filter((problem) => problem.accountId === currentAccountId);
  const friend = problems.filter((problem) => problem.accountId === friendId);
  const byTopic = useMemo(() => topics.slice(0, 6).map((topic) => ({ topic, mine: mine.filter((p) => p.topic === topic).length, friend: friend.filter((p) => p.topic === topic).length })), [mine, friend]);
  return <section className="glass-panel animate-enter rounded-2xl p-5"><h3 className="mb-5 text-2xl font-black">Analytics</h3><div className="space-y-4">{byTopic.map((row) => <div key={row.topic} className="grid items-center gap-3 sm:grid-cols-[140px_1fr_48px]"><span className="font-semibold">{row.topic}</span><div className="space-y-2"><div className="h-3 rounded-full bg-muted"><div className="h-3 rounded-full bg-primary" style={{ width: `${Math.min(100, row.mine * 18)}%` }} /></div><div className="h-3 rounded-full bg-muted"><div className="h-3 rounded-full bg-accent" style={{ width: `${Math.min(100, row.friend * 18)}%` }} /></div></div><span className="text-sm text-muted-foreground">{row.mine}/{row.friend}</span></div>)}</div><p className="mt-5 text-sm text-muted-foreground"><span className="text-primary">Primary</span> is you, <span className="text-accent">accent</span> is your friend.</p></section>;
}

function Profile({ currentAccountId, profiles, users, problems, onRefresh }: { currentAccountId: string; profiles: Profile[]; users: RivalUser[]; problems: Problem[]; onRefresh: () => Promise<void> }) {
  const profile = profiles.find((item) => item.account_id === currentAccountId)!;
  const user = mapUser(profile);
  const stats = userStats(problems, currentAccountId);
  const [rivalUsername, setRivalUsername] = useState(users.find((item) => item.id === profile.rival_user_id)?.username ?? "");
  const saveRival = async () => { const rival = users.find((item) => item.username.toLowerCase() === rivalUsername.trim().toLowerCase()); if (!rival || rival.id === currentAccountId) { toast.error("Enter a valid friend's username"); return; } const { error } = await supabase.from("profiles" as any).update({ rival_user_id: rival.id }).eq("account_id", currentAccountId); if (error) { toast.error(error.message); return; } toast.success("Rival updated"); await onRefresh(); };
  return <section className="glass-panel animate-enter rounded-2xl p-6"><div className="text-7xl">{user.emoji}</div><h3 className="mt-4 text-3xl font-black">{user.name}</h3><p className="text-primary">@{user.username} · {user.title}</p><div className="mt-6 grid gap-4 sm:grid-cols-4"><StatCard label="Solved" value={stats.total} Icon={Medal} /><StatCard label="This Week" value={stats.week} Icon={ListFilter} /><StatCard label="Hard Wins" value={stats.hard} Icon={Swords} /><StatCard label="Minutes" value={stats.minutes} Icon={Activity} /></div><div className="mt-6 rounded-xl border border-border bg-card/70 p-4"><h4 className="font-bold">Choose your friend</h4><p className="mt-1 text-sm text-muted-foreground">Enter your friend's username to compare directly.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={rivalUsername} onChange={(e) => setRivalUsername(e.target.value)} className="h-11 flex-1 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="friend_username" /><Button type="button" variant="rival" onClick={saveRival}>Save Rival</Button></div></div></section>;
}
