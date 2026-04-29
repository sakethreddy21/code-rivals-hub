"use client";

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
  Trash2,
  Trophy,
  User,
  UserPlus,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import confetti from "canvas-confetti";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { 
  AppData, 
  Challenge, 
  Problem, 
  Profile as ProfileType, 
  MutualUser 
} from "@/types/rivals";
import { 
  difficulties, 
  getFriendId, 
  loadAppData, 
  mapUser, 
  platforms, 
  topics, 
  userStats,
  getStreakStatus 
} from "@/lib/rivals";

type ViewId = (typeof navItems)[number]["id"];

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "log", label: "Log Problem", icon: Plus },
  { id: "problems", label: "My Problems", icon: BookOpenCheck },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "hall-of-fame", label: "Hall of Fame", icon: Medal },
  { id: "requests", label: "Squad Requests", icon: UserPlus },
  { id: "profile", label: "Profile", icon: User },
] as const;

export default function Page() {
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AppData>({ profiles: [], problems: [], challenges: [] });

  useEffect(() => {
    const id = localStorage.getItem("rivals_account_id");
    setCurrentAccountId(id);
    setLoading(false);
  }, []);

  const refresh = async () => {
    try {
      setData(await loadAppData());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load app data");
    }
  };

  useEffect(() => {
    if (currentAccountId) refresh();
  }, [currentAccountId]);

  useEffect(() => {
    if (!currentAccountId) return;
    const channel = supabase
      .channel("rivals-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "problems" }, (payload) => {
        const newProblem = payload.new as any;
        const users = data.profiles.map(mapUser);
        const friendId = getFriendId(currentAccountId, users);
        
        if (newProblem.account_id === friendId) {
          const friend = users.find(u => u.id === friendId);
          const mine = userStats(data.problems, currentAccountId);
          const rival = userStats([...data.problems, newProblem], friendId);
          
          let tone = "🔥 Your mutual is cooking!";
          let desc = `${friend?.name} just solved ${newProblem.name}.`;
          
          if (rival.total > mine.total + 4) {
            tone = "🚨 THEY'RE PULLING AHEAD!";
            desc = `${friend?.name} is in their prime. Time to catch up?`;
          } else if (rival.total > mine.total) {
            tone = "⚔️ Duo on a roll!";
            desc = `They've taken the lead. Your streak is safe, but for how long?`;
          }

          toast(tone, {
            description: desc,
            icon: <Zap className="text-accent" />,
            duration: 6000,
          });
        }
        refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentAccountId, data]);

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
            AlgoBuilding<span className="block text-primary">The Arena</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            A live shared hub where mutuals log problems, compare progress, and cook together with shared challenges.
          </p>
          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            {["No Email Needed", "Simple Username", "The Squad Flow"].map((item) => (
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
              {busy ? <Loader2 className="animate-spin" /> : <Zap />} Enter The Arena
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
  return <main className="app-shell-bg flex min-h-screen items-center justify-center px-4 text-foreground"><form onSubmit={submit} className="glass-panel w-full max-w-lg rounded-2xl p-6"><UserPlus className="mb-4 size-8 text-primary" /><h1 className="text-3xl font-black">Set up your profile</h1><p className="mt-2 text-sm text-muted-foreground">This is what the squad will see on the leaderboard.</p><div className="mt-6 grid gap-3"><input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Username" /><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Display name" /><input required value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Emoji" /><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Title" /><Button variant="rival" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Save profile</Button></div></form></main>;
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

  return <div className="app-shell-bg min-h-screen text-foreground lg:flex"><aside className="glass-panel sticky top-0 z-20 border-x-0 border-t-0 px-4 py-4 lg:h-screen lg:w-72 lg:border-y-0 lg:border-l-0"><div className="flex items-center justify-between lg:block"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground shadow-glow"><Swords /></div><div><p className="font-black">AlgoBuilding</p><p className="text-xs text-muted-foreground">The Arena</p></div></div><Button className="lg:hidden" variant="ghost" size="icon" onClick={logout}><LogOut /></Button></div><nav className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setView(item.id)} className={`flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:bg-secondary ${view === item.id ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground"}`}><Icon className="size-4" /> {item.label}</button>; })}</nav><div className="mt-6 hidden rounded-xl border border-border bg-card/80 p-4 lg:block"><p className="text-sm text-muted-foreground">Logged in as</p><p className="mt-1 text-lg font-bold">{user.emoji} {user.name}</p><p className="text-xs text-primary">{user.title}</p><Button className="mt-4 w-full" variant="secondary" onClick={logout}><LogOut /> Logout</Button></div></aside><main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8"><Header user={user} friend={friend} />{view === "dashboard" && <Dashboard currentAccountId={currentAccountId} data={data} users={users} onRefresh={onRefresh} />}{view === "leaderboard" && <Leaderboard users={users} problems={data.problems} />}{view === "log" && <LogProblem currentAccountId={currentAccountId} data={data} onRefresh={onRefresh} />}{view === "problems" && <MyProblems currentAccountId={currentAccountId} problems={data.problems} />}{view === "analytics" && <Analytics currentAccountId={currentAccountId} users={users} problems={data.problems} />}{view === "hall-of-fame" && <HallOfFame users={users} problems={data.problems} />}{view === "requests" && <SquadRequests currentAccountId={currentAccountId} users={users} onRefresh={onRefresh} />}{view === "profile" && <Profile currentAccountId={currentAccountId} profiles={data.profiles} users={users} problems={data.problems} onRefresh={onRefresh} onLogout={onLogout} />}</main></div>;
}

function Header({ user, friend }: { user: MutualUser; friend: MutualUser }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return <header className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card/70 p-5 shadow-card sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-primary">Duo: {friend.name} {friend.emoji}</p><h2 className="text-3xl font-black">{greeting}, {user.name}! {user.emoji}</h2></div><div className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground"><Flame className="mr-2 inline size-4 text-accent" /> Cooking with the Squad.</div></header>;
}

function Dashboard({ currentAccountId, data, users, onRefresh }: { currentAccountId: string; data: AppData; users: MutualUser[]; onRefresh: () => Promise<void> }) {
  const mine = userStats(data.problems, currentAccountId);
  const friendId = getFriendId(currentAccountId, users);
  const rival = userStats(data.problems, friendId);
  const user = users.find((item) => item.id === currentAccountId)!;
  const friend = users.find((item) => item.id === friendId) ?? user;
  const [tab, setTab] = useState<"overview" | "today-target">("overview");

  const streakInfo = getStreakStatus(mine.solvedToday);

  return (
    <section className="animate-enter space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-1">
          <button
            type="button"
            onClick={() => setTab("overview")}
            className={`px-3 py-2 text-xs font-black transition ${
              tab === "overview"
                ? "rounded-md bg-primary text-primary-foreground shadow-glow"
                : "rounded-md text-muted-foreground hover:text-foreground"
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setTab("today-target")}
            className={`px-3 py-2 text-xs font-black transition ${
              tab === "today-target"
                ? "rounded-md bg-primary text-primary-foreground shadow-glow"
                : "rounded-md text-muted-foreground hover:text-foreground"
            }`}
          >
            Today Target
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          {tab === "today-target" ? "Post 4 links and race." : "Your arena overview."}
        </div>
      </div>

      {tab === "today-target" ? (
        <TodayTarget currentAccountId={currentAccountId} users={users} onRefresh={onRefresh} data={data} />
      ) : (
        <>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Solved" value={mine.total} Icon={Trophy} />
        <StatCard label="Today" value={mine.today} Icon={Zap} />
        <div className={`card-gradient relative overflow-hidden rounded-2xl border p-5 shadow-card transition hover:-translate-y-1 ${mine.solvedToday ? "border-green-500/50" : streakInfo.status === "Critical" ? "border-red-500 animate-pulse" : "border-yellow-500/50"}`}>
          <div className="flex items-center justify-between">
            <Flame className={`size-5 ${streakInfo.color}`} />
            {!mine.solvedToday && <Countdown />}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Current Streak</p>
          <p className="mt-1 text-3xl font-black">{mine.streak} days</p>
          <p className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${streakInfo.color}`}>
            {streakInfo.message}
          </p>
        </div>
        <StatCard label="Weekly Progress" value={mine.week} Icon={Activity} />
      </div>
      
      <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-5">
            <h3 className="mb-4 text-xl font-bold">Friend Comparison</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <MutualCard user={user} stats={mine} highlight />
              <MutualCard user={friend} stats={rival} />
            </div>
          </div>
          <WeeklyPledge currentAccountId={currentAccountId} stats={mine} />
        </div>
        <div className="space-y-6">
          <SquadActivity data={data} users={users} />
          <div className="glass-panel rounded-2xl p-5">
            <h3 className="mb-4 text-xl font-bold">Quick Log Problem</h3>
            <LogProblem currentAccountId={currentAccountId} data={data} compact onRefresh={onRefresh} />
          </div>
        </div>
      </div>
      <div className="grid gap-6">
        <Heatmap currentAccountId={currentAccountId} problems={data.problems} />
      </div>
        </>
      )}
    </section>
  );
}

function TodayTarget({ currentAccountId, users, onRefresh, data }: { currentAccountId: string; users: MutualUser[]; onRefresh?: () => Promise<void>; data?: AppData }) {
  const dayKey = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const [links, setLinks] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [solvedDraft, setSolvedDraft] = useState<Record<string, boolean>>({});
  const [solvedMeta, setSolvedMeta] = useState<Record<string, { difficulty: string; timeTaken: string }>>({});
  const [alreadyLogged, setAlreadyLogged] = useState<Record<string, boolean>>({});
  const [saveProgressBusy, setSaveProgressBusy] = useState(false);
  const [fetchedTitles, setFetchedTitles] = useState<Record<string, { name: string; platform: string; difficulty: string }>>({});
  const [presence, setPresence] = useState<Record<string, any>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const userNameById = useMemo(() => new Map(users.map((u) => [u.id, `${u.emoji} ${u.name}`])), [users]);

  const fetchTitle = async (url: string, slot: number) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/problem-metadata?url=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const meta = await res.json();
        setFetchedTitles(prev => ({ ...prev, [String(slot)]: meta }));
        // If no difficulty set for this slot yet, auto-set it from meta
        if (!solvedMeta[String(slot)]) {
          setSolvedMeta(prev => ({ 
            ...prev, 
            [String(slot)]: { difficulty: meta.difficulty || "Medium", timeTaken: "25" } 
          }));
        }
      }
    } catch (e) {
      console.error("Failed to fetch title", e);
    }
  };

  useEffect(() => {
    links.forEach((link, idx) => {
      if (link.trim() && !fetchedTitles[String(idx)]) {
        fetchTitle(link, idx);
      }
    });
  }, [links]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: row, error } = await (supabase as any)
        .from("today_targets")
        .select("links")
        .eq("day", dayKey)
        .maybeSingle();

      if (!mounted) return;

      if (!error && (row as any)?.links) {
        const arr = Array.isArray((row as any).links) ? ((row as any).links as string[]) : [];
        setLinks(arr.length > 0 ? arr : [""]);
        setTimeout(() => setIsInitialLoad(false), 500);
        return;
      }

      const local = localStorage.getItem(`today_targets_${dayKey}`);
      if (local) {
        try {
          const arr = JSON.parse(local) as string[];
          if (Array.isArray(arr)) setLinks(arr.length > 0 ? arr : [""]);
        } catch {}
      }
      setTimeout(() => setIsInitialLoad(false), 500);
    };
    load();
    return () => { mounted = false; };
  }, [dayKey]);

  useEffect(() => {
    if (isInitialLoad) return;
    const timer = setTimeout(() => {
      save();
    }, 1500);
    return () => clearTimeout(timer);
  }, [links]);

  useEffect(() => {
    let mounted = true;
    const loadSolved = async () => {
      const localKey = `today_target_solved_${dayKey}_${currentAccountId}`;
      const local = localStorage.getItem(localKey);
      if (local) {
        try {
          const obj = JSON.parse(local) as Record<string, boolean>;
          if (mounted && obj && typeof obj === "object") setSolvedDraft(obj);
        } catch {}
      }

      const loggedKey = `today_target_logged_${dayKey}_${currentAccountId}`;
      try {
        const saved = JSON.parse(localStorage.getItem(loggedKey) || "{}");
        if (mounted && saved && typeof saved === "object") setAlreadyLogged(saved);
      } catch {}

      const { data: rows, error } = await (supabase as any)
        .from("today_target_solutions")
        .select("slot, solved")
        .eq("day", dayKey)
        .eq("account_id", currentAccountId);

      if (!mounted) return;
      if (!error && Array.isArray(rows)) {
        const next: Record<string, boolean> = {};
        for (const row of rows as any[]) {
          next[String(row.slot)] = !!row.solved;
        }
        setSolvedDraft(next);
      }
    };
    loadSolved();
    return () => { mounted = false; };
  }, [dayKey, currentAccountId]);

  const deriveName = (url: string, idx: number) => {
    try {
      const pathname = new URL(url).pathname;
      const slug = pathname.split("/").filter(Boolean).pop() || "";
      return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || `Target ${idx + 1}`;
    } catch {
      return `Target ${idx + 1}`;
    }
  };

  const derivePlatform = (url: string) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes("leetcode")) return "LeetCode";
      if (host.includes("geeksforgeeks") || host.includes("gfg")) return "GeeksforGeeks";
      if (host.includes("codeforces")) return "Codeforces";
      if (host.includes("codechef")) return "CodeChef";
      if (host.includes("hackerrank")) return "HackerRank";
      if (host.includes("hackerearth")) return "HackerEarth";
      if (host.includes("atcoder")) return "AtCoder";
      return "Other";
    } catch {
      return "Other";
    }
  };

  const save = async () => {
    const cleaned = links.map((l) => l.trim());
    setBusy(true);
    try {
      const { error } = await (supabase as any)
        .from("today_targets")
        .upsert({ day: dayKey, links: cleaned }, { onConflict: "day" });

      if (error) {
        localStorage.setItem(`today_targets_${dayKey}`, JSON.stringify(cleaned));
        toast.success("Saved (local)", { description: "Create `today_targets` table in Supabase to sync across users." });
      } else {
        toast.success("Saved targets", { description: "Shared with the squad." });
      }
    } finally {
      setBusy(false);
    }
  };

  const saveProgress = async () => {
    const cleaned: Record<string, boolean> = {};
    for (let slot = 0; slot < links.length; slot++) {
      cleaned[String(slot)] = !!solvedDraft[String(slot)];
    }

    setSaveProgressBusy(true);
    const newAlreadyLogged = { ...alreadyLogged };
    let newlyLoggedCount = 0;

    try {
      const localKey = `today_target_solved_${dayKey}_${currentAccountId}`;
      localStorage.setItem(localKey, JSON.stringify(cleaned));

      for (let slot = 0; slot < links.length; slot++) {
        const slotKey = String(slot);
        const link = links[slot]?.trim();
        if (cleaned[slotKey] && link && !alreadyLogged[slotKey]) {
          const meta = solvedMeta[slotKey] ?? { difficulty: "Medium", timeTaken: "25" };
          const { error } = await supabase.from("problems" as any).insert({
            account_id: currentAccountId,
            name: deriveName(link, slot),
            link,
            platform: derivePlatform(link),
            difficulty: meta.difficulty,
            topic: "Target Problem",
            time_taken: Number(meta.timeTaken) || 0,
            notes: `Today’s Target -- Slot ${slot + 1}`,
          });
          if (!error) {
            newAlreadyLogged[slotKey] = true;
            newlyLoggedCount++;
          }
        }
      }

      const loggedKey = `today_target_logged_${dayKey}_${currentAccountId}`;
      localStorage.setItem(loggedKey, JSON.stringify(newAlreadyLogged));
      setAlreadyLogged(newAlreadyLogged);

      const rows = links.map((_, slot) => ({
        day: dayKey,
        slot,
        account_id: currentAccountId,
        solved: !!cleaned[String(slot)],
        solved_at: cleaned[String(slot)] ? new Date().toISOString() : null,
      }));

      const { error } = await (supabase as any)
        .from("today_target_solutions")
        .upsert(rows, { onConflict: "day,slot,account_id" });

      if (error) {
        toast.success("Progress saved (local)", { description: "Create `today_target_solutions` table to sync between users." });
      } else if (newlyLoggedCount > 0) {
        toast.success(`Progress saved · ${newlyLoggedCount} problem${newlyLoggedCount > 1 ? "s" : ""} logged!`);
      } else {
        toast.success("Progress saved");
      }

      await onRefresh?.();

      // Squad Goals Celebration Check
      const totalTargets = links.filter(l => l.trim()).length;
      if (totalTargets > 0) {
        const everyoneSolvedAll = users.every(u => {
          const solvedCount = links.filter((link, slot) => {
            if (!link.trim()) return false;
            return u.id === currentAccountId 
              ? !!cleaned[String(slot)] 
              : !!allSolved[String(slot)]?.has(u.id);
          }).length;
          return solvedCount === totalTargets;
        });

        if (everyoneSolvedAll) {
          confetti({
            particleCount: 200,
            spread: 100,
            origin: { y: 0.6 },
            colors: ["#6366f1", "#a855f7", "#ec4899", "#22c55e"]
          });
          toast.success("SQUAD GOALS ACHIEVED! 🏆", {
            description: "Everyone has completed all targets for today. Absolute cinema.",
            duration: 6000
          });
        }
      }
    } finally {
      setSaveProgressBusy(false);
    }
  };

  const [allSolved, setAllSolved] = useState<Record<string, Set<string>>>({});
  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      const { data: rows, error } = await (supabase as any)
        .from("today_target_solutions")
        .select("slot, account_id, solved")
        .eq("day", dayKey);
      if (!mounted) return;
      if (!error && Array.isArray(rows)) {
        const map: Record<string, Set<string>> = {};
        for (const row of rows as any[]) {
          if (!row.solved) continue;
          const k = String(row.slot);
          map[k] = map[k] ?? new Set<string>();
          map[k]!.add(String(row.account_id));
        }
        setAllSolved(map);
      } else {
        setAllSolved({});
      }
    };
    loadAll();
    
    // Subscribe to real-time changes & Presence
    const channel = supabase
      .channel(`today_arena_${dayKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'today_target_solutions',
          filter: `day=eq.${dayKey}`
        },
        () => {
          loadAll();
          onRefresh?.();
        }
      )
      .on('presence', { event: 'sync' }, () => {
        setPresence(channel.presenceState());
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ 
            id: currentAccountId, 
            online_at: new Date().toISOString(),
            name: users.find(u => u.id === currentAccountId)?.name
          });
        }
      });

    return () => { 
      mounted = false; 
      supabase.removeChannel(channel);
    };
  }, [dayKey, currentAccountId, users]);

  const difficultyTabs = ["Easy", "Medium", "Hard"] as const;
  const timeTabs = [{ label: "15m", value: "15" }, { label: "30m", value: "30" }, { label: "45m", value: "45" }, { label: "60m", value: "60" }] as const;

  const activePresenceCount = Object.keys(presence).length;
  const totalSlotsWithLinks = links.filter(l => l.trim()).length;
  const totalPossibleSolves = totalSlotsWithLinks * users.length;
  const currentTotalSolves = Object.values(allSolved).reduce((acc, set) => acc + (set?.size || 0), 0);
  const squadProgress = totalPossibleSolves > 0 ? Math.round((currentTotalSolves / totalPossibleSolves) * 100) : 0;

  return (
    <div className="space-y-6">
      {totalSlotsWithLinks > 0 && (
        <div className="glass-panel overflow-hidden rounded-2xl p-1">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Squad Progress</span>
            </div>
            <span className="text-[10px] font-black text-primary">{squadProgress}% COMPLETE</span>
          </div>
          <div className="h-1.5 w-full bg-secondary/30">
            <div 
              className="h-full bg-gradient-to-r from-primary via-accent to-primary shadow-glow transition-all duration-1000 ease-out" 
              style={{ width: `${squadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black">Today Target</h3>
              {activePresenceCount > 1 && (
                <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                  {activePresenceCount} IN ARENA
                </div>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Shared notice board. Changes are auto-saved. Mark solved to log progress.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="rival" onClick={saveProgress} disabled={saveProgressBusy}>
              {saveProgressBusy ? <Loader2 className="animate-spin" /> : <Zap />} Save My Progress
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {links.map((link, idx) => {
            const slotKey = String(idx);
            const isSolved = !!solvedDraft[slotKey];
            const isLogged = !!alreadyLogged[slotKey];
            const meta = solvedMeta[slotKey] ?? { difficulty: "Medium", timeTaken: "25" };

            return (
              <div key={idx} className="grid gap-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <input
                      value={link}
                      onChange={(e) => {
                        const next = [...links];
                        next[idx] = e.target.value;
                        setLinks(next);
                      }}
                      onBlur={() => link.trim() && fetchTitle(link, idx)}
                      className="h-11 w-full rounded-lg border border-input bg-background/70 px-3 pr-28 outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder={`Target ${idx + 1} link`}
                    />
                    {fetchedTitles[slotKey] && link.trim() && (
                      <div className="mt-1.5 flex items-center gap-2 px-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                          {fetchedTitles[slotKey].platform}
                        </span>
                        <span className="text-xs font-bold truncate max-w-[200px]">
                          {fetchedTitles[slotKey].name}
                        </span>
                      </div>
                    )}
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                      <label className={`inline-flex h-8 cursor-pointer select-none items-center gap-2 rounded-md border px-3 text-xs font-black transition ${isLogged && isSolved ? "border-green-500/50 bg-green-500/10 text-green-400" : "border-border bg-secondary/50"} ${!link.trim() ? "opacity-40" : ""}`}>
                        <input
                          type="checkbox"
                          className="accent-primary"
                          disabled={!link.trim()}
                          checked={isSolved}
                          onChange={(e) => setSolvedDraft((s) => ({ ...s, [slotKey]: e.target.checked }))}
                        />
                        {isLogged && isSolved ? "Logged" : "Solved"}
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {link.trim() && (
                      <Button variant="outline" size="sm" className="h-11 shrink-0 gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10" asChild>
                        <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" /> See the problem
                        </a>
                      </Button>
                    )}
                    {links.length > 1 && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {isSolved && link.trim() && !isLogged && (
                  <div className="ml-1 flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <span className="text-xs text-muted-foreground">Difficulty:</span>
                    <div className="inline-flex rounded-md border border-border bg-secondary/40 p-0.5">
                      {difficultyTabs.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSolvedMeta((m) => ({ ...m, [slotKey]: { ...meta, difficulty: d } }))}
                          className={`rounded-sm px-2 py-1 text-xs font-bold transition ${meta.difficulty === d ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">Time:</span>
                    <div className="inline-flex rounded-md border border-border bg-secondary/40 p-0.5">
                      {timeTabs.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setSolvedMeta((m) => ({ ...m, [slotKey]: { ...meta, timeTaken: t.value } }))}
                          className={`rounded-sm px-2 py-1 text-xs font-bold transition ${meta.timeTaken === t.value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-primary">→ Will log as solved</span>
                  </div>
                )}

                {isLogged && isSolved && (
                  <p className="ml-1 text-xs font-semibold text-green-400">✓ Logged to your problems</p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-secondary/60 px-2 py-1">Slot {idx + 1}</span>
                  <span className="rounded-full bg-secondary/60 px-2 py-1">
                    Solved by:{" "}
                    <span className="text-foreground">
                      {allSolved[slotKey] ? Array.from(allSolved[slotKey]!).map((id) => userNameById.get(id) ?? id).join(" · ") : "--"}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
          <Button 
            variant="outline" 
            className="w-full border-dashed py-8 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all"
            onClick={() => setLinks([...links, ""])}
          >
            <Plus className="mr-2 size-5" /> Add another target problem
          </Button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h4 className="mb-4 text-xl font-bold">Today’s Score</h4>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {users.map((u) => {
            const count = links.filter((_, slot) => allSolved[String(slot)]?.has(u.id)).length;
            const total = links.filter((l) => l.trim()).length;
            const isOnline = Object.values(presence).some(p => (p as any)[0]?.id === u.id);
            return (
              <div key={u.id} className={`relative flex items-center justify-between rounded-xl border p-4 transition ${u.id === currentAccountId ? "border-primary bg-primary/10" : "border-border bg-card/70"}`}>
                {isOnline && (
                  <div className="absolute -right-1 -top-1 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[8px] font-black text-accent-foreground shadow-glow">
                    <Flame className="size-2 animate-pulse" /> COOKING
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{u.emoji}</span>
                  <div>
                    <p className="font-bold leading-tight">{u.name}</p>
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-primary">{count}</p>
                  <p className="text-xs text-muted-foreground">of {total}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h4 className="mb-4 text-xl font-bold">Who solved what</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-3">Target</th>
                {users.map((u) => (
                  <th key={u.id} className="py-3">
                    {u.emoji} {u.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map((link, idx) => {
                const key = link.trim();
                return (
                  <tr key={idx} className="border-t border-border">
                    <td className="py-3 font-semibold">
                      <div className="flex items-center gap-3">
                        <span>Target {idx + 1}</span>
                        {key && (
                          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/10" asChild>
                            <a href={key.startsWith('http') ? key : `https://${key}`} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-3" /> See the problem
                            </a>
                          </Button>
                        )}
                        {!key && <span className="text-xs font-normal text-muted-foreground">(Empty)</span>}
                      </div>
                    </td>
                    {users.map((u) => {
                      const solvedFlag = !!key && !!allSolved[String(idx)]?.has(u.id);
                      return (
                        <td key={u.id} className="py-3">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${solvedFlag ? "bg-green-500/20 text-green-300" : "bg-secondary/40 text-muted-foreground"}`}>
                            {solvedFlag ? "Solved" : "--"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Note: "Solved" is <span className="font-semibold">manual</span>. Check boxes above then click <span className="font-semibold">Save My Progress</span> to log.
        </p>
      </div>
    </div>
  );
}

function SquadActivity({ data, users }: { data: AppData; users: MutualUser[] }) {
  const recentProblems = useMemo(() => {
    return [...data.problems]
      .sort((a, b) => new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime())
      .slice(0, 5);
  }, [data.problems]);

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-bold">Squad Activity</h3>
        <Activity className="size-4 text-primary" />
      </div>
      <div className="space-y-4">
        {recentProblems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No activity yet. Go cook! 🔥</p>
        ) : (
          recentProblems.map((p, i) => {
            const user = users.find(u => u.id === p.accountId);
            return (
              <div key={i} className="flex items-center gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <div className="text-2xl">{user?.emoji || "👤"}</div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-bold truncate">
                    <span className="text-primary">{user?.name || "Someone"}</span> solved {p.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {p.platform} · {new Date(p.solvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Countdown() {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const diff = end.getTime() - now.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours}h ${mins}m ${secs}s`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
      <Activity className="size-3" /> {timeLeft} left
    </div>
  );
}

function StatCard({ label, value, Icon }: { label: string; value: React.ReactNode; Icon: LucideIcon }) {
  return <div className="card-gradient rounded-2xl border border-border p-5 shadow-card transition hover:-translate-y-1"><Icon className="mb-4 size-5 text-primary" /><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>;
}

function MutualCard({ user, stats, highlight }: { user: MutualUser; stats: ReturnType<typeof userStats>; highlight?: boolean }) {
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
  const [linkBusy, setLinkBusy] = useState(false);

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

  const fetchFromLink = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLinkBusy(true);
    try {
      const res = await fetch(`/api/problem-metadata?url=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        throw new Error("Could not fetch problem details from link");
      }
      const meta = (await res.json()) as { name: string; platform: string; difficulty: string; topic: string };
      setForm((f) => ({
        ...f,
        link: trimmed,
        name: meta.name || f.name,
        platform: meta.platform || f.platform,
        // Set an initial difficulty from metadata; user can still override via tabs.
        difficulty: (meta.difficulty as any) || f.difficulty,
        topic: meta.topic || f.topic,
        customPlatform: "",
        customTopic: "",
      }));
    } catch (e) {
      // If we can't parse, still allow manual logging (non-compact mode).
      toast.error(e instanceof Error ? e.message : "Could not fetch problem details");
    } finally {
      setLinkBusy(false);
    }
  };

  const submit = async (event: React.SyntheticEvent) => { 
    event.preventDefault(); 
    if (compact) {
      if (!form.link.trim()) return;
      if (!form.name.trim()) {
        toast.error("Paste a supported link (e.g. GeeksforGeeks problem link)");
        return;
      }
    } else {
      if (!form.name.trim()) return;
    }

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

    // Celebration check
    const newStats = userStats([...(data?.problems || []), { solvedAt: new Date().toISOString() } as any], currentAccountId);
    if (newStats.streak === 7 || newStats.streak === 30 || newStats.streak === 100) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#a855f7", "#ec4899"]
      });
      toast.success(`AMAZING! ${newStats.streak} DAY STREAK! 🏆`, {
        description: "You're building an unstoppable momentum.",
        duration: 5000,
      });
    } else {
      toast.success("Problem logged. Streak protected!"); 
    }

    setForm({ ...form, name: "", link: "", notes: "", customPlatform: "", customTopic: "" }); 
    await onRefresh?.(); 
  };

  if (compact) {
    const difficultyTabs = ["Easy", "Medium", "Hard"] as const;
    const timeTabs = [
      { label: "15m", value: "15" },
      { label: "30m", value: "30" },
      { label: "45m", value: "45" },
      { label: "60m", value: "60" },
    ] as const;
    return (
      <form onSubmit={submit} className="grid gap-3">
        <div className="relative">
          <input
            required
            value={form.link}
            onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              // Let the input update first, then fetch.
              queueMicrotask(() => fetchFromLink(pasted));
            }}
            onBlur={() => fetchFromLink(form.link)}
            className="h-11 w-full rounded-lg border border-input bg-background/70 px-3 pr-12 outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Paste problem link (e.g. GeeksforGeeks)"
          />
          {linkBusy && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>

        <div className="grid gap-2">
          <div className="inline-flex w-fit rounded-lg border border-border bg-secondary/40 p-1">
            {difficultyTabs.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setForm((f) => ({ ...f, difficulty: d }))}
                className={`px-3 py-1.5 text-xs font-bold transition ${
                  form.difficulty === d
                    ? "rounded-md bg-primary text-primary-foreground shadow-glow"
                    : "rounded-md text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="inline-flex w-fit rounded-lg border border-border bg-secondary/40 p-1">
            {timeTabs.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, timeTaken: t.value }))}
                className={`px-3 py-1.5 text-xs font-bold transition ${
                  form.timeTaken === t.value
                    ? "rounded-md bg-accent text-accent-foreground"
                    : "rounded-md text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-secondary/60 px-2 py-1 text-muted-foreground">
            Difficulty: <span className="text-foreground">{form.difficulty}</span>
          </span>
          <span className="rounded-full bg-secondary/60 px-2 py-1 text-muted-foreground">
            Time: <span className="text-foreground">{form.timeTaken}m</span>
          </span>
          <span className="rounded-full bg-secondary/60 px-2 py-1 text-muted-foreground">{form.platform || "Platform"}</span>
          <span className="rounded-full bg-secondary/60 px-2 py-1 text-muted-foreground">{form.topic || "Topic"}</span>
        </div>

        {form.name && (
          <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
            <div className="text-sm font-semibold">{form.name}</div>
            <div className="text-xs text-muted-foreground truncate">{form.link}</div>
          </div>
        )}

        <Button variant="rival" className="h-11" disabled={linkBusy}>
          {linkBusy ? <Loader2 className="animate-spin" /> : <Plus />} Log Solved Problem
        </Button>
      </form>
    );
  }

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

function Heatmap({ currentAccountId, problems }: { currentAccountId: string; problems: Problem[] }) {
  const mine = useMemo(
    () => problems.filter((problem) => problem.accountId === currentAccountId),
    [problems, currentAccountId],
  );

  const {
    weeks,
    monthLabels,
    maxCount,
  } = useMemo(() => {
    const localDateKey = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    const countsByDay = new Map<string, number>();
    for (const p of mine) {
      const key = localDateKey(new Date(p.solvedAt));
      countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
    }

    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // GitHub calendar weeks start on Sunday.
    const start = new Date(end);
    start.setDate(start.getDate() - 364);
    start.setHours(0, 0, 0, 0);
    while (start.getDay() !== 0) start.setDate(start.getDate() - 1);

    const dates: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    while (dates.length % 7 !== 0) {
      const last = dates[dates.length - 1]!;
      const next = new Date(last);
      next.setDate(next.getDate() + 1);
      dates.push(next);
    }

    let computedMax = 0;
    const all = dates.map((d) => {
      const count = countsByDay.get(localDateKey(d)) ?? 0;
      if (count > computedMax) computedMax = count;
      return { date: d, count };
    });

    const computedWeeks: { days: { date: Date; count: number }[] }[] = [];
    for (let i = 0; i < all.length; i += 7) {
      computedWeeks.push({ days: all.slice(i, i + 7) });
    }

    const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "short" });
    const labels: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;
    computedWeeks.forEach((week, weekIndex) => {
      const month = week.days[0]!.date.getMonth();
      if (weekIndex === 0) {
        lastMonth = month;
        labels.push({ weekIndex, label: monthFormatter.format(week.days[0]!.date) });
        return;
      }
      if (month !== lastMonth) {
        lastMonth = month;
        labels.push({ weekIndex, label: monthFormatter.format(week.days[0]!.date) });
      }
    });

    return { weeks: computedWeeks, monthLabels: labels, maxCount: computedMax };
  }, [mine]);

  const [hovered, setHovered] = useState<{
    date: Date;
    count: number;
    anchor: { x: number; y: number };
  } | null>(null);

  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" }),
    [],
  );

  const levelFor = (count: number) => {
    if (count <= 0) return 0;
    if (maxCount <= 1) return 1;
    const scaled = Math.ceil((count / maxCount) * 4);
    return Math.max(1, Math.min(4, scaled));
  };

  const weekdayLabels = [
    { row: 1, label: "Mon" },
    { row: 3, label: "Wed" },
    { row: 5, label: "Fri" },
  ];

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-xl font-bold">Contribution Heatmap</h3>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span>Less</span>
          <span className="gh-heat-square gh-heat-0" aria-hidden />
          <span className="gh-heat-square gh-heat-1" aria-hidden />
          <span className="gh-heat-square gh-heat-2" aria-hidden />
          <span className="gh-heat-square gh-heat-3" aria-hidden />
          <span className="gh-heat-square gh-heat-4" aria-hidden />
          <span>More</span>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <div className="inline-block">
          <div className="gh-heatmap-months">
            {monthLabels.map((m) => (
              <div key={`${m.weekIndex}-${m.label}`} className="gh-heatmap-month" style={{ gridColumnStart: m.weekIndex + 2 }}>
                {m.label}
              </div>
            ))}
          </div>

          <div className="gh-heatmap-body">
            <div className="gh-heatmap-ylabels">
              {weekdayLabels.map((w) => (
                <div key={w.label} className="gh-heatmap-ylabel" style={{ gridRowStart: w.row + 1 }}>
                  {w.label}
                </div>
              ))}
            </div>

            <div className="gh-heatmap-weeks" role="grid" aria-label="Contribution calendar">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="gh-heatmap-week" role="row">
                  {week.days.map((d, dayIndex) => {
                    const level = levelFor(d.count);
                    const label = `${d.count} solved on ${dayFormatter.format(d.date)}`;
                    return (
                      <button
                        key={dayIndex}
                        type="button"
                        className={`gh-heat-square gh-heat-${level}`}
                        aria-label={label}
                        onMouseEnter={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const parent = (e.currentTarget.offsetParent as HTMLElement | null)?.getBoundingClientRect();
                          setHovered({
                            date: d.date,
                            count: d.count,
                            anchor: {
                              x: rect.left - (parent?.left ?? 0) + rect.width / 2,
                              y: rect.top - (parent?.top ?? 0),
                            },
                          });
                        }}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const parent = (e.currentTarget.offsetParent as HTMLElement | null)?.getBoundingClientRect();
                          setHovered({
                            date: d.date,
                            count: d.count,
                            anchor: {
                              x: rect.left - (parent?.left ?? 0) + rect.width / 2,
                              y: rect.top - (parent?.top ?? 0),
                            },
                          });
                        }}
                        onBlur={() => setHovered(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {hovered && (
          <div
            className="gh-heatmap-tooltip"
            style={{
              left: hovered.anchor.x,
              top: hovered.anchor.y,
              transform: "translate(-50%, calc(-100% - 10px))",
            }}
            role="status"
          >
            <div className="gh-heatmap-tooltip-inner">
              <div className="text-sm font-semibold">{hovered.count} solved</div>
              <div className="text-xs opacity-80">{dayFormatter.format(hovered.date)}</div>
            </div>
            <div className="gh-heatmap-tooltip-caret" aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}

function Leaderboard({ users, problems }: { users: MutualUser[]; problems: Problem[] }) {
  const ranked = [...users].sort((a, b) => userStats(problems, b.id).total - userStats(problems, a.id).total);
  return <section className="glass-panel animate-enter rounded-2xl p-5"><h3 className="mb-5 text-2xl font-black">Leaderboard</h3>{ranked.length === 0 && <p className="text-sm text-muted-foreground">No builders yet.</p>}{ranked.map((user, index) => <div key={user.id} className="mb-3 flex items-center justify-between rounded-xl bg-card/80 p-4"><div className="flex items-center gap-4"><span className="text-2xl">{index === 0 ? "🥇" : index === 1 ? "🥈" : "🏅"}</span><div><p className="text-lg font-bold">{user.emoji} {user.name}</p><p className="text-sm text-muted-foreground">@{user.username}</p></div></div><div className="text-right"><p className="text-2xl font-black">{userStats(problems, user.id).total}</p><p className="text-xs text-muted-foreground">total solved</p></div></div>)}</section>;
}

function MyProblems({ currentAccountId, problems }: { currentAccountId: string; problems: Problem[] }) {
  const mine = problems.filter((problem) => problem.accountId === currentAccountId);
  const [filter, setFilter] = useState("");
  const filtered = mine.filter((problem) => `${problem.platform} ${problem.difficulty} ${problem.topic} ${problem.name}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="glass-panel animate-enter rounded-2xl p-5"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row"><h3 className="text-2xl font-black">My Problems</h3><label className="flex items-center gap-2 rounded-lg border border-input bg-background/70 px-3"><Search className="size-4 text-muted-foreground" /><input value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 bg-transparent outline-none" placeholder="Filter platform, topic..." /></label></div><ProblemTable problems={filtered} /></section>;
}

function ProblemTable({ problems }: { problems: Problem[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-muted-foreground"><tr><th className="py-3">Problem</th><th>Platform</th><th>Difficulty</th><th>Topic</th><th>Time</th><th>Date</th></tr></thead><tbody>{problems.map((problem) => <tr key={problem.id} className="border-t border-border"><td className="py-3 font-semibold">{problem.link ? <a className="transition hover:text-primary" href={problem.link} target="_blank" rel="noreferrer">{problem.name}</a> : problem.name}</td><td>{problem.platform}</td><td>{problem.difficulty}</td><td>{problem.topic}</td><td>{problem.timeTaken}m</td><td>{new Date(problem.solvedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>;
}

function HallOfFame({ users, problems }: { users: MutualUser[]; problems: Problem[] }) {
  const ranked = [...users].map(user => ({
    ...user,
    stats: userStats(problems, user.id)
  })).sort((a, b) => b.stats.streak - a.stats.streak);

  return (
    <section className="glass-panel animate-enter rounded-2xl p-6">
      <div className="mb-8 text-center">
        <Medal className="mx-auto mb-4 size-12 text-primary" />
        <h3 className="text-4xl font-black">The Main Hall</h3>
        <p className="mt-2 text-muted-foreground text-lg">The arena of ultimate consistency.</p>
      </div>
      
      <div className="grid gap-4">
        {ranked.map((user, index) => (
          <div key={user.id} className={`flex items-center justify-between rounded-2xl p-5 transition-all ${index === 0 ? "bg-primary/20 border-2 border-primary shadow-glow scale-[1.02]" : "bg-card/70 border border-border"}`}>
            <div className="flex items-center gap-6">
              <span className="text-4xl font-black italic text-primary/50">#{index + 1}</span>
              <div>
                <p className="text-xl font-bold">{user.emoji} {user.name}</p>
                <p className="text-sm text-muted-foreground">Best Streak: {user.stats.streak} days</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 text-3xl font-black">
                <Flame className={user.stats.streak > 10 ? "text-orange-500 animate-bounce" : "text-primary"} />
                {user.stats.streak}
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Current Streak</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WeeklyPledge({ currentAccountId, stats }: { currentAccountId: string; stats: any }) {
  const [pledge, setPledge] = useState(() => localStorage.getItem(`pledge_${currentAccountId}`) || "5");
  const [isEditing, setIsEditing] = useState(false);
  const target = parseInt(pledge);
  const progress = (stats.week / target) * 100;

  const save = () => {
    localStorage.setItem(`pledge_${currentAccountId}`, pledge);
    setIsEditing(false);
    toast.success("Pledge committed!", { description: `You've skin in the game now. Don't miss those ${pledge} problems.` });
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border-l-4 border-l-accent">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <ShieldCheck className="size-5 text-accent" /> Weekly Pledge
        </h3>
        {isEditing ? (
          <button onClick={save} className="text-xs font-bold text-primary hover:underline">SAVE COMMITMENT</button>
        ) : (
          <button onClick={() => setIsEditing(true)} className="text-xs font-bold text-muted-foreground hover:text-foreground">EDIT PLEDGE</button>
        )}
      </div>
      
      {isEditing ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">How many problems will you solve this week?</p>
          <input 
            type="number" 
            value={pledge} 
            onChange={(e) => setPledge(e.target.value)}
            className="w-full h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm text-muted-foreground uppercase font-bold tracking-tighter">Your Commitment</p>
              <p className="text-2xl font-black">{stats.week} / {pledge} problems</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-accent">{Math.round(progress)}%</p>
              <p className="text-[10px] text-muted-foreground uppercase">of target</p>
            </div>
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${progress >= 100 ? "bg-green-500" : "bg-accent"}`} 
              style={{ width: `${Math.min(100, progress)}%` }} 
            />
          </div>
          <p className="text-xs italic text-muted-foreground">
            {progress >= 100 ? "✅ Pledge fulfilled! Bragging rights unlocked." : `🔥 You need ${Math.max(0, target - stats.week)} more by Sunday.`}
          </p>
        </div>
      )}
    </div>
  );
}

function Analytics({ currentAccountId, users, problems }: { currentAccountId: string; users: MutualUser[]; problems: Problem[] }) {
  const friendId = getFriendId(currentAccountId, users);
  const mine = useMemo(() => problems.filter((problem) => problem.accountId === currentAccountId), [problems, currentAccountId]);
  const friend = useMemo(() => problems.filter((problem) => problem.accountId === friendId), [problems, friendId]);

  const { weeklyBars, monthlyBars, mineAvg, friendAvg, pie } = useMemo(() => {
    const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const mineCountsByDay = new Map<string, number>();
    for (const p of mine) {
      const key = dayKey(startOfLocalDay(new Date(p.solvedAt)));
      mineCountsByDay.set(key, (mineCountsByDay.get(key) ?? 0) + 1);
    }
    const friendCountsByDay = new Map<string, number>();
    for (const p of friend) {
      const key = dayKey(startOfLocalDay(new Date(p.solvedAt)));
      friendCountsByDay.set(key, (friendCountsByDay.get(key) ?? 0) + 1);
    }

    const today = startOfLocalDay(new Date());

    // Weekly: last 7 days (including today)
    const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
    const weekly = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const mineSolved = mineCountsByDay.get(dayKey(d)) ?? 0;
      const friendSolved = friendCountsByDay.get(dayKey(d)) ?? 0;
      return { label: weekdayFmt.format(d), mine: mineSolved, friend: friendSolved };
    });

    // Monthly: last 6 months
    const monthFmt = new Intl.DateTimeFormat(undefined, { month: "short" });
    const monthMine = new Map<string, number>();
    const monthFriend = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthMine.set(key, 0);
      monthFriend.set(key, 0);
    }
    for (const p of mine) {
      const d = new Date(p.solvedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (monthMine.has(key)) monthMine.set(key, (monthMine.get(key) ?? 0) + 1);
    }
    for (const p of friend) {
      const d = new Date(p.solvedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (monthFriend.has(key)) monthFriend.set(key, (monthFriend.get(key) ?? 0) + 1);
    }
    const monthly = Array.from(monthMine.keys()).map((key) => {
      const [y, m] = key.split("-").map(Number);
      return {
        label: monthFmt.format(new Date(y!, m!, 1)),
        mine: monthMine.get(key) ?? 0,
        friend: monthFriend.get(key) ?? 0,
      };
    });

    // Daily average: last 30 days
    let last30Total = 0;
    let last30FriendTotal = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = dayKey(d);
      last30Total += mineCountsByDay.get(key) ?? 0;
      last30FriendTotal += friendCountsByDay.get(key) ?? 0;
    }
    const avg = last30Total / 30;
    const avgFriend = last30FriendTotal / 30;

    return {
      weeklyBars: weekly,
      monthlyBars: monthly,
      mineAvg: avg,
      friendAvg: avgFriend,
      pie: [
        { name: "You", value: Number(avg.toFixed(3)) },
        { name: "Rival", value: Number(avgFriend.toFixed(3)) },
      ],
    };
  }, [mine, friend]);

  return (
    <section className="animate-enter space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <h3 className="mb-3 text-2xl font-black">Monthly Progress</h3>
          <p className="mb-4 text-sm text-muted-foreground">Problems solved per month (last 6 months).</p>
          <ChartContainer
            className="h-[260px] w-full"
            config={{
              mine: { label: "You", color: "var(--color-primary)" },
              friend: { label: "Rival", color: "var(--color-accent)" },
            }}
          >
            <BarChart data={monthlyBars} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="mine" fill="var(--color-mine)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="friend" fill="var(--color-friend)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <h3 className="mb-3 text-2xl font-black">Daily Avg</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Last 30 days avg/day: <span className="font-bold text-foreground">{mineAvg.toFixed(2)}</span> vs{" "}
            <span className="font-bold text-foreground">{friendAvg.toFixed(2)}</span>.
          </p>
          <ChartContainer
            className="h-[260px] w-full"
            config={{
              you: { label: "You", color: "var(--color-primary)" },
              rival: { label: "Rival", color: "var(--color-accent)" },
            }}
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie
                data={[
                  { name: "You", value: pie[0]!.value, fill: "var(--color-you)" },
                  { name: "Rival", value: pie[1]!.value, fill: "var(--color-rival)" },
                ]}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={92}
                stroke="transparent"
              >
                <Cell fill="var(--color-you)" />
                <Cell fill="var(--color-rival)" />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h3 className="mb-3 text-2xl font-black">Weekly Progress</h3>
        <p className="mb-4 text-sm text-muted-foreground">Problems solved per day (last 7 days).</p>
        <ChartContainer
          className="h-[240px] w-full"
          config={{
            mine: { label: "You", color: "var(--color-primary)" },
            friend: { label: "Rival", color: "var(--color-accent)" },
          }}
        >
          <BarChart data={weeklyBars} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="mine" fill="var(--color-mine)" radius={[8, 8, 0, 0]} />
            <Bar dataKey="friend" fill="var(--color-friend)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>
    </section>
  );
}

function Profile({ currentAccountId, profiles, users, problems, onRefresh, onLogout }: { currentAccountId: string; profiles: ProfileType[]; users: MutualUser[]; problems: Problem[]; onRefresh: () => Promise<void>; onLogout: () => void }) {
  const profile = profiles.find((item) => item.account_id === currentAccountId)!;
  const user = mapUser(profile);
  const stats = userStats(problems, currentAccountId);
  const [mutualUsername, setMutualUsername] = useState(users.find((item) => item.id === profile.rival_user_id)?.username ?? "");
  const [resetting, setResetting] = useState(false);

  const saveMutual = async () => { 
    const mutual = users.find((item) => item.username.toLowerCase() === mutualUsername.trim().toLowerCase()); 
    if (!mutual || mutual.id === currentAccountId) { 
      toast.error("Enter a valid username from the squad"); 
      return; 
    } 
    const { error } = await supabase.from("profiles" as any).update({ rival_user_id: mutual.id }).eq("account_id", currentAccountId); 
    if (error) { toast.error(error.message); return; } 
    toast.success("Mutual duo updated"); 
    await onRefresh(); 
  };

  const handleReset = async () => {
    const confirmReset = window.confirm("Are you sure you want to reset all your data? This will delete your profile, all logged problems, and your account. This action cannot be undone.");
    if (!confirmReset) return;

    setResetting(true);
    try {
      // Delete problems
      await supabase.from("problems" as any).delete().eq("account_id", currentAccountId);
      // Delete profile
      await supabase.from("profiles" as any).delete().eq("account_id", currentAccountId);
      // Delete account
      await supabase.from("accounts" as any).delete().eq("id", currentAccountId);

      localStorage.removeItem("rivals_account_id");
      onLogout();
      toast.success("Account and data deleted successfully");
    } catch (error) {
      toast.error("Failed to reset data");
      console.error(error);
    } finally {
      setResetting(false);
    }
  };

  return <section className="glass-panel animate-enter rounded-2xl p-6"><div className="text-7xl">{user.emoji}</div><h3 className="mt-4 text-3xl font-black">{user.name}</h3><p className="text-primary">@{user.username} · {user.title}</p><div className="mt-6 grid gap-4 sm:grid-cols-4"><StatCard label="Solved" value={stats.total} Icon={Medal} /><StatCard label="This Week" value={stats.week} Icon={ListFilter} /><StatCard label="Hard Wins" value={stats.hard} Icon={Swords} /><StatCard label="Minutes" value={stats.minutes} Icon={Activity} /></div><div className="mt-6 rounded-xl border border-border bg-card/70 p-4"><h4 className="font-bold">Choose your main duo</h4><p className="mt-1 text-sm text-muted-foreground">Enter a mutual's username to compare directly.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={mutualUsername} onChange={(e) => setMutualUsername(e.target.value)} className="h-11 flex-1 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="mutual_username" /><Button type="button" variant="rival" onClick={saveMutual}>Save Mutual</Button></div></div><div className="mt-10 pt-6 border-t border-destructive/20"><h4 className="text-destructive font-bold">Danger Zone</h4><p className="mt-1 text-sm text-muted-foreground">Resetting your data will permanently delete your account and all progress.</p><Button type="button" variant="destructive" className="mt-4" onClick={handleReset} disabled={resetting}>{resetting ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Reset All Data</Button></div></section>;
}

function SquadRequests({ currentAccountId, users, onRefresh }: { currentAccountId: string; users: MutualUser[]; onRefresh: () => Promise<void> }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [targetUsername, setTargetUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fetchRequests = async () => {
      const { data, error } = await supabase.from("friendships" as any).select("*").or(`sender_id.eq.${currentAccountId},receiver_id.eq.${currentAccountId}`);
      if (!error) setRequests(data || []);
    };
    fetchRequests();
  }, [currentAccountId]);

  const sendRequest = async () => {
    const target = users.find(u => u.username.toLowerCase() === targetUsername.trim().toLowerCase());
    if (!target || target.id === currentAccountId) {
      toast.error("Valid mutual username required");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("friendships" as any).insert({ sender_id: currentAccountId, receiver_id: target.id });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Request sent to the squad!");
      setTargetUsername("");
    }
  };

  const updateRequest = async (id: string, status: string) => {
    const { error } = await supabase.from("friendships" as any).update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "accepted" ? "Squad member added! 🤝" : "Request declined");
      onRefresh();
    }
  };

  const incoming = requests.filter(r => r.receiver_id === currentAccountId && r.status === "pending");
  const outgoing = requests.filter(r => r.sender_id === currentAccountId && r.status === "pending");

  return (
    <section className="animate-enter space-y-6">
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-2xl font-black mb-2">Build Your Squad</h3>
        <p className="text-sm text-muted-foreground mb-6">Send requests to mutuals to start tracking progress together.</p>
        
        <div className="flex flex-col gap-2 sm:flex-row">
          <input 
            value={targetUsername} 
            onChange={(e) => setTargetUsername(e.target.value)} 
            className="h-11 flex-1 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" 
            placeholder="Search username..." 
          />
          <Button variant="rival" onClick={sendRequest} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Send Request
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass-panel rounded-2xl p-5">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <Zap className="size-4 text-primary" /> Incoming Requests
          </h4>
          <div className="space-y-3">
            {incoming.length === 0 && <p className="text-xs text-muted-foreground italic">No pending requests.</p>}
            {incoming.map(req => {
              const sender = users.find(u => u.id === req.sender_id);
              return (
                <div key={req.id} className="flex items-center justify-between rounded-xl bg-secondary/40 p-3 border border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{sender?.emoji}</span>
                    <span className="font-bold">{sender?.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="rival" onClick={() => updateRequest(req.id, "accepted")}>Accept</Button>
                    <Button size="sm" variant="ghost" onClick={() => updateRequest(req.id, "declined")}>Decline</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <Plus className="size-4 text-muted-foreground" /> Pending Outgoing
          </h4>
          <div className="space-y-3">
            {outgoing.length === 0 && <p className="text-xs text-muted-foreground italic">No sent requests.</p>}
            {outgoing.map(req => {
              const receiver = users.find(u => u.id === req.receiver_id);
              return (
                <div key={req.id} className="flex items-center justify-between rounded-xl bg-secondary/20 p-3 opacity-70">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{receiver?.emoji}</span>
                    <span className="font-bold">{receiver?.name}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Waiting...</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
