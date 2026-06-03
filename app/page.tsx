"use client";

import {
  Activity,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  BookOpenCheck,
  ChevronDown,
  Coffee,
  ExternalLink,
  Flame,
  Globe,
  LayoutDashboard,
  Link2,
  ListFilter,
  Loader2,
  CheckCircle2,
  Clock,
  LogOut,
  Medal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Timer,
  Trash2,
  Trophy,
  User,
  UserPlus,
  Users2,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import confetti from "canvas-confetti";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import {
  AppData,
  GfgStats,
  LeetCodeStats,
  PlatformConnection,
  Problem,
  Profile as ProfileType,
  MutualUser,
  Revision
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
import { StatCard, MutualCard, Select } from "@/components/atoms";
import { FocusTodo, FocusAnalytics } from "@/components/Focus";
import { RevisionView } from "@/components/Revision";
import { PlatformStats } from "@/components/PlatformStats";
import { StudySession } from "@/components/StudySession";

type ViewId = (typeof navItems)[number]["id"];

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "today-target", label: "Today Target", icon: Target },
  { id: "focus", label: "FocusTodo", icon: Timer },
  { id: "focus-analytics", label: "Focus Analytics", icon: BarChart3 },
  { id: "study-session", label: "Sync Study", icon: Users2 },
  { id: "revision", label: "Revision", icon: Repeat2 },
  { id: "problems", label: "My Problems", icon: BookOpenCheck },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "platform-stats", label: "Platform Stats", icon: Globe },
  { id: "hall-of-fame", label: "Hall of Fame", icon: Medal },
  { id: "requests", label: "Squad Requests", icon: UserPlus },
  { id: "profile", label: "Profile", icon: User },
] as const;

export default function Page() {
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AppData>({ profiles: [], friendships: [], problems: [], platformConnections: [], revisions: [] });

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

  // Auto-sync external platform stats (LeetCode/GFG). Supabase realtime covers
  // the rest of the app data, so we only poll the things that have no push channel.
  // `force` skips the freshness check (used by manual sync button).
  const syncPlatformConnections = async (accountId: string, force = false) => {
    const { data: connections } = await supabase
      .from("platform_connections" as any)
      .select("*")
      .eq("account_id", accountId);
    const myConnections = (connections ?? []) as any as PlatformConnection[];
    if (!myConnections.length) return;

    const FRESH_MS = 4 * 60 * 1000;
    const now = Date.now();
    let updated = false;
    for (const conn of myConnections) {
      try {
        if (!force && conn.last_synced_at && now - new Date(conn.last_synced_at).getTime() < FRESH_MS) {
          continue;
        }
        const apiPlatform = conn.platform === "LeetCode" ? "leetcode" : "gfg";
        const res = await fetch(
          `/api/platform-stats?platform=${apiPlatform}&username=${encodeURIComponent(conn.platform_username)}`
        );
        if (!res.ok) continue;
        const stats = await res.json();

        const oldTotal = (conn.stats as any)?.totalSolved ?? 0;
        if (stats.totalSolved !== oldTotal || !conn.stats) {
          await supabase
            .from("platform_connections" as any)
            .update({ stats, last_synced_at: new Date().toISOString() })
            .eq("id", conn.id);
          updated = true;
        }
      } catch {
        // Silently skip failed syncs
      }
    }
    if (updated) {
      setData(await loadAppData());
    }
  };

  useEffect(() => {
    if (currentAccountId) refresh();
  }, [currentAccountId]);

  // Periodic platform-stats refresh (external APIs — no realtime channel).
  // Runs every 5 minutes, only when the tab is visible. The function itself
  // skips connections that synced in the last 4 minutes, so this is cheap.
  useEffect(() => {
    if (!currentAccountId) return;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      syncPlatformConnections(currentAccountId);
    };

    const initialTimer = setTimeout(tick, 2000);
    const interval = setInterval(tick, 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [currentAccountId]);

  useEffect(() => {
    if (!currentAccountId) return;
    const channel = supabase
      .channel("rivals-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "revisions" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "today_revisions" }, () => refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "problems" }, (payload) => {
        const newProblem = payload.new as any;
        const users = data.profiles.map(p => mapUser(p, data.problems));
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
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => refresh())
      .on("broadcast", { event: "taunt" }, (payload) => {
        console.log("Taunt broadcast received:", payload);

        // Play exact track and show toast ONLY if this client is the target recipient
        if (payload.payload.to === currentAccountId) {
          const tracks = [
            '/audio1.m4a',
            '/audio2.m4a',
            '/audio3.m4a',
            '/aee-main-ajau-kya-apni-par-salman-khan-angry-meme-template-for-made-with-Voicemod.mp3'
          ];
          const track = payload.payload.track || tracks[Math.floor(Math.random() * tracks.length)];
          new Audio(track).play().catch((err) => console.error("Audio playback error:", err));

          toast(`🔔 ${payload.payload.nudgeName || "Wake up and code!"}`, {
            description: `${payload.payload.from} nudged you with: ${payload.payload.nudgeName || "a taunt"}`,
            duration: 6000,
            icon: <Flame className="text-orange-500" />
          });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentAccountId, data]);

  if (loading) return <LoadingScreen />;
  if (!currentAccountId) return <LoginPage onLogin={(id) => setCurrentAccountId(id)} />;

  const currentProfile = data.profiles.find((profile) => profile.account_id === currentAccountId);
  if (!currentProfile) return <ProfileSetup accountId={currentAccountId} onCreated={refresh} />;

  return <CompetitionApp
    currentAccountId={currentAccountId}
    data={data}
    onRefresh={refresh}
    onSync={() => syncPlatformConnections(currentAccountId, true)}
    onLogout={() => setCurrentAccountId(null)}
  />;
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
            A live shared hub where mutuals log problems, compare progress, and push each other to ship.
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

function CompetitionApp({ currentAccountId, data, onRefresh, onSync, onLogout }: { currentAccountId: string; data: AppData; onRefresh: () => Promise<void>; onSync: () => Promise<void>; onLogout: () => void }) {
  const [view, setView] = useState<ViewId>("dashboard");

  // Get all users in the application (for SquadRequests search lookup)
  const allUsers = useMemo(() => {
    return data.profiles.map(p => mapUser(p, data.problems));
  }, [data.profiles, data.problems]);

  const user = useMemo(() => {
    return allUsers.find((item) => item.id === currentAccountId)!;
  }, [allUsers, currentAccountId]);

  // Restrict squad to active friendships (status !== 'declined')
  const squadUsers = useMemo(() => {
    const friendships = data.friendships || [];
    return allUsers.filter((u) => {
      if (u.id === currentAccountId) return true;
      return friendships.some((f) => {
        return (
          ((f.sender_id === currentAccountId && f.receiver_id === u.id) ||
            (f.sender_id === u.id && f.receiver_id === currentAccountId)) &&
          f.status !== "declined"
        );
      });
    });
  }, [allUsers, currentAccountId, data.friendships]);

  const friendId = useMemo(() => {
    return getFriendId(currentAccountId, squadUsers);
  }, [currentAccountId, squadUsers]);

  const friend = useMemo(() => {
    return squadUsers.find((item) => item.id === friendId) ?? user;
  }, [squadUsers, friendId, user]);

  // Filter problems to only show those of the squad (self + linked friends)
  const squadData = useMemo(() => {
    const allowedUserIds = new Set(squadUsers.map((u) => u.id));
    return {
      ...data,
      problems: data.problems.filter((p) => allowedUserIds.has(p.accountId)),
    };
  }, [data, squadUsers]);

  const logout = () => {
    localStorage.removeItem("rivals_account_id");
    onLogout();
    toast.success("Logged out");
  };

  return (
    <div className="app-shell-bg min-h-screen text-foreground lg:flex">
      <aside className="glass-panel sticky top-0 z-20 border-x-0 border-t-0 px-4 py-4 lg:h-screen lg:w-72 lg:border-y-0 lg:border-l-0 lg:flex lg:flex-col lg:overflow-y-auto">
        <div className="flex items-center justify-between lg:block shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground shadow-glow">
              <Swords />
            </div>
            <div>
              <p className="font-black">AlgoBuilding</p>
              <p className="text-xs text-muted-foreground">The Arena</p>
            </div>
          </div>
          <Button className="lg:hidden" variant="ghost" size="icon" onClick={logout}>
            <LogOut />
          </Button>
        </div>

        <nav className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0 shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:bg-secondary ${
                  view === item.id ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-4" /> {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-6 hidden rounded-xl border border-border bg-card/80 p-4 lg:block lg:mt-auto shrink-0">
          <p className="text-sm text-muted-foreground">Logged in as</p>
          <p className="mt-1 text-lg font-bold">
            {user.emoji} {user.name}
          </p>
          <p className="text-xs text-primary">{user.title}</p>
          <Button className="mt-4 w-full" variant="secondary" onClick={logout}>
            <LogOut /> Logout
          </Button>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        <Header user={user} squadUsers={squadUsers} />
        {view === "dashboard" && <Dashboard currentAccountId={currentAccountId} data={squadData} users={squadUsers} onRefresh={onRefresh} onSync={onSync} />}
        {view === "today-target" && <TodayTargetView currentAccountId={currentAccountId} data={squadData} users={squadUsers} onRefresh={onRefresh} onSync={onSync} />}
        {view === "focus" && <FocusTodo currentAccountId={currentAccountId} />}
        {view === "focus-analytics" && <FocusAnalytics currentAccountId={currentAccountId} />}
        {view === "study-session" && (
          <StudySession
            currentAccountId={currentAccountId}
            currentUser={user}
            friends={squadUsers.filter((u) => u.id !== currentAccountId)}
          />
        )}
        {view === "revision" && <RevisionView currentAccountId={currentAccountId} problems={squadData.problems} revisions={squadData.revisions} onRefresh={onRefresh} />}
        {view === "problems" && <MyProblems currentAccountId={currentAccountId} problems={squadData.problems} revisions={squadData.revisions} />}
        {view === "analytics" && <Analytics currentAccountId={currentAccountId} users={squadUsers} problems={squadData.problems} />}
        {view === "platform-stats" && <PlatformStats currentAccountId={currentAccountId} data={squadData} users={squadUsers} onRefresh={onRefresh} />}
        {view === "hall-of-fame" && <HallOfFame users={squadUsers} problems={squadData.problems} revisions={squadData.revisions} />}
        {view === "requests" && <SquadRequests currentAccountId={currentAccountId} users={allUsers} onRefresh={onRefresh} />}
        {view === "profile" && <Profile currentAccountId={currentAccountId} profiles={data.profiles} users={squadUsers} problems={squadData.problems} revisions={squadData.revisions} onRefresh={onRefresh} onLogout={onLogout} />}
      </main>
    </div>
  );
}

function Header({ user, squadUsers }: { user: MutualUser; squadUsers: MutualUser[] }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const friends = squadUsers.filter(u => u.id !== user.id);
  const friendLabel = friends.length === 0 ? "None" : friends.map(f => `${f.emoji} ${f.name}`).join(" · ");
  return <header className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card/70 p-5 shadow-card sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-primary">Squad: {friendLabel}</p><h2 className="text-3xl font-black">{greeting}, {user.name}! {user.emoji}</h2></div><div className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground"><Flame className="mr-2 inline size-4 text-accent" /> Cooking with the Squad.</div></header>;
}

function Dashboard({ currentAccountId, data, users, onRefresh, onSync }: { currentAccountId: string; data: AppData; users: MutualUser[]; onRefresh: () => Promise<void>; onSync: () => Promise<void> }) {
  const mine = userStats(data.problems, currentAccountId, data.revisions);
  const user = users.find((item) => item.id === currentAccountId)!;
  const [presence, setPresence] = useState<Record<string, any>>({});

  useEffect(() => {
    const channel = supabase.channel('app_presence');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.log("Presence Sync:", state);
        setPresence(state);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log("Joined presence channel as", currentAccountId);
          const trackStatus = await channel.track({
            id: currentAccountId,
            account_id: currentAccountId,
            online_at: new Date().toISOString(),
            name: user.name
          });
          if (trackStatus !== 'ok') console.error("Presence track failed:", trackStatus);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentAccountId, user.name]);

  const streakInfo = getStreakStatus(mine.solvedToday);
  const myPlatformTotal = data.platformConnections
    .filter((c) => c.account_id === currentAccountId)
    .reduce((acc, c) => acc + ((c.stats as any)?.totalSolved ?? 0), 0);
  const isUserOnline = Object.values(presence).flat().some((p) => (p as any).id === user.id);

  const friends = users.filter(u => u.id !== currentAccountId);
  const nudgeFriend = (fId: string, track: string, nudgeName: string) => {
    const f = users.find(u => u.id === fId);

    // Play the chosen nudge sound locally for the sender immediately
    new Audio(track).play().catch((err) => console.error("Audio playback error:", err));

    supabase.channel("rivals-live").send({
      type: "broadcast",
      event: "taunt",
      payload: { from: user.name, to: fId, track, nudgeName },
    });
    toast.success(`Sent "${nudgeName}" to ${f?.name}! 🔔`, { description: "They'll feel that one." });
  };

  return (
    <section className="animate-enter space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Solved" value={mine.total} Icon={Trophy} />
        <StatCard label="Today" value={mine.today} Icon={Zap} />
        <div className="card-gradient rounded-2xl border border-border p-5 shadow-card transition hover:-translate-y-1">
          <Flame className={`mb-4 size-5 ${streakInfo.color}`} />
          <p className="text-sm text-muted-foreground">Current Streak</p>
          <p className="mt-1 text-3xl font-black">{mine.streak}<span className="ml-1 text-base font-bold text-muted-foreground">days</span></p>
        </div>
        <StatCard label="Weekly Progress" value={mine.week} Icon={Activity} />
      </div>

      {/* Squad Comparison — scrollable row of cards for all members */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">Squad Comparison</h3>
          {users.length > 2 && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
              {users.length} members · scroll →
            </span>
          )}
        </div>
        {friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">No squad members yet. Send requests from the Squad Requests tab!</p>
        ) : (
          <div className="-mx-1 overflow-x-auto pb-2">
            <div className="flex gap-4 px-1" style={{ minWidth: 'max-content' }}>
              {/* Always show yourself first */}
              <div className="w-64 shrink-0">
                <MutualCard user={user} stats={mine} platformTotal={myPlatformTotal} isOnline={isUserOnline} highlight />
              </div>
              {/* Then all friends */}
              {friends.map(f => {
                const fStats = userStats(data.problems, f.id, data.revisions);
                const fPlatformTotal = data.platformConnections
                  .filter(c => c.account_id === f.id)
                  .reduce((acc, c) => acc + ((c.stats as any)?.totalSolved ?? 0), 0);
                const fIsOnline = Object.values(presence).flat().some(p => (p as any).id === f.id);
                return (
                  <div key={f.id} className="w-64 shrink-0">
                    <MutualCard
                      user={f}
                      stats={fStats}
                      platformTotal={fPlatformTotal}
                      isOnline={fIsOnline}
                      onTaunt={(track, nudgeName) => nudgeFriend(f.id, track, nudgeName)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Heatmaps for all squad members */}
      <div className="grid gap-6">
        <Heatmap currentAccountId={currentAccountId} problems={data.problems} revisions={data.revisions} title={`${user.emoji} ${user.name}'s Contributions`} />
        {friends.length === 0 ? (
          <div className="glass-panel rounded-2xl p-5 text-sm text-muted-foreground">
            Send squad requests to see your friends' contribution heatmaps here.
          </div>
        ) : (
          friends.map(f => (
            <Heatmap key={f.id} currentAccountId={f.id} problems={data.problems} revisions={data.revisions} title={`${f.emoji} ${f.name}'s Contributions`} />
          ))
        )}
      </div>
      <SquadActivity data={data} users={users} />
    </section>
  );
}

function TodayTargetView({ currentAccountId, data, users, onRefresh, onSync }: { currentAccountId: string; data: AppData; users: MutualUser[]; onRefresh: () => Promise<void>; onSync: () => Promise<void> }) {
  const user = users.find((item) => item.id === currentAccountId)!;
  const [presence, setPresence] = useState<Record<string, any>>({});

  useEffect(() => {
    const channel = supabase
      .channel('today_target_presence')
      .on('presence', { event: 'sync' }, () => {
        setPresence(channel.presenceState());
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: currentAccountId,
            online_at: new Date().toISOString(),
            name: user.name
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentAccountId, user.name]);

  useEffect(() => {
    toast.info("Syncing platform stats...", { icon: <RefreshCw className="animate-spin size-4" />, duration: 2000 });
    onSync();
  }, []);

  return (
    <section className="animate-enter space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-2xl font-black">Today Target</h3>
        <p className="text-xs text-muted-foreground">Post 4 links and race.</p>
      </div>

      <TodayTarget
        currentAccountId={currentAccountId}
        users={users}
        onRefresh={onRefresh}
        data={data}
        presence={presence}
      />

      <TodayRevisionPanel currentAccountId={currentAccountId} problems={data.problems} onRefresh={onRefresh} />
    </section>
  );
}

function TodayTarget({
  currentAccountId,
  users,
  onRefresh,
  data,
  presence,
}: {
  currentAccountId: string;
  users: MutualUser[];
  onRefresh?: () => Promise<void>;
  data?: AppData;
  presence: Record<string, any>;
}) {
  const dayKey = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const [links, setLinks] = useState<string[]>([""]);
  const [carryOverLinks, setCarryOverLinks] = useState<{ link: string; day: string; slot: number }[]>([]);
  const [carryOverSolvedDraft, setCarryOverSolvedDraft] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [solvedDraft, setSolvedDraft] = useState<Record<string, boolean>>({});
  const [solvedMeta, setSolvedMeta] = useState<Record<string, { difficulty: string; timeTaken: string }>>({});
  const [alreadyLogged, setAlreadyLogged] = useState<Record<string, boolean>>({});
  const [saveProgressBusy, setSaveProgressBusy] = useState(false);
  const [fetchedTitles, setFetchedTitles] = useState<Record<string, { name: string; platform: string; difficulty: string; topic: string }>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hints, setHints] = useState<Record<string, string>>({});
  const [fetchingHint, setFetchingHint] = useState<Record<string, boolean>>({});
  const [bookmarkedLinks, setBookmarkedLinks] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`today_target_bookmarks_${currentAccountId}`);
      return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const userNameById = useMemo(() => new Map(users.map((u) => [u.id, `${u.emoji} ${u.name}`])), [users]);

  const toggleLinkBookmark = (link: string) => {
    setBookmarkedLinks(prev => {
      const next = new Set(prev);
      next.has(link) ? next.delete(link) : next.add(link);
      localStorage.setItem(`today_target_bookmarks_${currentAccountId}`, JSON.stringify([...next]));
      return next;
    });
  };

  const fetchTitle = async (url: string, slotKey: string | number) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/problem-metadata?url=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const meta = await res.json();
        setFetchedTitles((prev) => ({
          ...prev,
          [slotKey]: {
            name: meta.name,
            platform: meta.platform,
            difficulty: meta.difficulty,
            topic: meta.topic || "DSA",
          },
        }));
        if (!solvedMeta[String(slotKey)]) {
          setSolvedMeta(prev => ({
            ...prev,
            [String(slotKey)]: { difficulty: meta.difficulty || "Medium", timeTaken: "25" }
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
    carryOverLinks.forEach((co) => {
      const key = `${co.day}_${co.slot}`;
      if (co.link.trim() && !fetchedTitles[key]) {
        fetchTitle(co.link, key);
      }
    });
  }, [carryOverLinks]);

  const handleGetHint = async (slotKey: string, link: string) => {
    if (!link.trim() || fetchingHint[slotKey]) return;

    const meta = fetchedTitles[slotKey];
    setFetchingHint(prev => ({ ...prev, [slotKey]: true }));

    try {
      const res = await fetch("/api/problem-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: link,
          name: meta?.name || deriveName(link, 0),
          topic: meta?.topic || "DSA",
          difficulty: meta?.difficulty || "Medium"
        })
      });

      if (res.ok) {
        const { hint } = await res.json();
        setHints(prev => ({ ...prev, [slotKey]: hint }));
      } else {
        toast.error("Failed to get hint");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error fetching hint");
    } finally {
      setFetchingHint(prev => ({ ...prev, [slotKey]: false }));
    }
  };

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
      } else {
        const local = localStorage.getItem(`today_targets_${dayKey}`);
        if (local) {
          try {
            const arr = JSON.parse(local) as string[];
            if (Array.isArray(arr)) setLinks(arr.length > 0 ? arr : [""]);
          } catch { }
        }
      }
      setTimeout(() => setIsInitialLoad(false), 500);

      // Load carry-overs
      const { data: pastTargets } = await (supabase as any)
        .from("today_targets")
        .select("day, links")
        .lt("day", dayKey)
        .order("day", { ascending: true });

      if (pastTargets && mounted) {
        const { data: pastSolutions } = await (supabase as any)
          .from("today_target_solutions")
          .select("day, slot, solved")
          .lt("day", dayKey)
          .eq("account_id", currentAccountId);

        const pastCarryOvers: { link: string; day: string; slot: number }[] = [];
        for (const target of pastTargets) {
          const linksArr = Array.isArray(target.links) ? target.links : [];
          for (let i = 0; i < linksArr.length; i++) {
            const link = linksArr[i];
            if (!link?.trim()) continue;
            const sol = pastSolutions?.find((s: any) => s.day === target.day && String(s.slot) === String(i));
            if (!sol?.solved) {
              pastCarryOvers.push({ link, day: target.day, slot: i });
            }
          }
        }
        setCarryOverLinks(pastCarryOvers);
      }
    };
    load();
    return () => { mounted = false; };
  }, [dayKey, currentAccountId]);

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
        } catch { }
      }

      const carryLocalKey = `carry_over_solved_${currentAccountId}`;
      const carryLocal = localStorage.getItem(carryLocalKey);
      if (carryLocal && mounted) {
        try { setCarryOverSolvedDraft(JSON.parse(carryLocal)); } catch { }
      }

      const loggedKey = `today_target_logged_${dayKey}_${currentAccountId}`;
      try {
        const saved = JSON.parse(localStorage.getItem(loggedKey) || "{}");
        if (mounted && saved && typeof saved === "object") setAlreadyLogged(saved);
      } catch { }

      const { data: rows, error } = await (supabase as any)
        .from("today_target_solutions")
        .select("slot, solved")
        .eq("day", dayKey)
        .eq("account_id", currentAccountId);

      if (!mounted) return;
      if (!error && Array.isArray(rows) && rows.length > 0) {
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

  // Extract the problem slug from a URL (works for both LeetCode and GFG)
  const extractSlug = (url: string): string => {
    try {
      const pathname = new URL(url.startsWith("http") ? url : `https://${url}`).pathname;
      // Remove trailing slashes and get last meaningful segment
      const parts = pathname.split("/").filter(Boolean);
      // LeetCode: /problems/two-sum/ → "two-sum"
      // GFG: /problems/sort-an-array-of-0s-1s-and-2s4231/ → "sort-an-array-of-0s-1s-and-2s4231"
      const probIdx = parts.indexOf("problems");
      if (probIdx !== -1 && parts[probIdx + 1]) return parts[probIdx + 1];
      return parts[parts.length - 1] || "";
    } catch {
      return "";
    }
  };

  const deriveName = (url: string, idx: number) => {
    try {
      const slug = extractSlug(url);
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

  // URL Normalization Helper
  const normalizeUrl = (url: string | undefined | null): string => {
    if (!url) return "";
    let clean = url.trim().toLowerCase();

    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = "https://" + clean;
    }

    try {
      const parsed = new URL(clean);
      let host = parsed.hostname;
      if (host.startsWith("www.")) {
        host = host.substring(4);
      }
      let path = parsed.pathname;
      path = path.replace(/\/+$/, "");
      return `${host}${path}`;
    } catch {
      let fallback = url.trim().toLowerCase();
      fallback = fallback.replace(/^(https?:\/\/)?(www\.)?/, "");
      fallback = fallback.replace(/\/+$/, "");
      fallback = fallback.split("?")[0] || "";
      return fallback;
    }
  };

  // Auto-mark problems as solved when they match platform submissions
  const pendingAutoSave = useRef(false);
  const isAutoSaving = useRef(false);

  // Latest refs to prevent React stale closure bugs inside async setTimeout callbacks
  const latestProblemsRef = useRef(data?.problems);
  latestProblemsRef.current = data?.problems;

  const latestAlreadyLoggedRef = useRef(alreadyLogged);
  latestAlreadyLoggedRef.current = alreadyLogged;

  const latestLinksRef = useRef(links);
  latestLinksRef.current = links;

  const latestSolvedDraftRef = useRef(solvedDraft);
  latestSolvedDraftRef.current = solvedDraft;

  const latestCarryOverLinksRef = useRef(carryOverLinks);
  latestCarryOverLinksRef.current = carryOverLinks;

  const latestCarryOverSolvedDraftRef = useRef(carryOverSolvedDraft);
  latestCarryOverSolvedDraftRef.current = carryOverSolvedDraft;

  const latestSolvedMetaRef = useRef(solvedMeta);
  latestSolvedMetaRef.current = solvedMeta;

  // Unified concurrency lock shared between manual save and auto-save
  const isSavingInProgressRef = useRef(false);

  useEffect(() => {
    if (!data?.platformConnections?.length) return;
    if (!links.some((l) => l.trim()) && !carryOverLinks.some((c) => c.link.trim())) return;

    const myConnections = data.platformConnections.filter((c) => c.account_id === currentAccountId);
    if (!myConnections.length) return;

    // Collect all solved slugs from all platforms
    const allSolvedSlugs = new Set<string>();
    for (const conn of myConnections) {
      const stats = conn.stats as any;
      if (stats?.solvedSlugs && Array.isArray(stats.solvedSlugs)) {
        for (const slug of stats.solvedSlugs) {
          allSolvedSlugs.add(slug.toLowerCase());
        }
      }
    }

    if (allSolvedSlugs.size === 0) return;

    // Check each target link
    let autoMarked = false;
    const newDraft = { ...solvedDraft };
    links.forEach((link, idx) => {
      const slotKey = String(idx);
      // We only skip if it's already marked in the current draft.
      // Even if it was "alreadyLogged", if it's currently unchecked, we want to re-detect it.
      if (!link.trim() || newDraft[slotKey]) return;

      const slug = extractSlug(link).toLowerCase();
      if (slug && allSolvedSlugs.has(slug)) {
        newDraft[slotKey] = true;
        autoMarked = true;
      }
    });

    const newCarryDraft = { ...carryOverSolvedDraft };
    carryOverLinks.forEach((co) => {
      const slotKey = `${co.day}_${co.slot}`;
      if (!co.link.trim() || newCarryDraft[slotKey]) return;

      const slug = extractSlug(co.link).toLowerCase();
      if (slug && allSolvedSlugs.has(slug)) {
        newCarryDraft[slotKey] = true;
        autoMarked = true;
      }
    });

    if (autoMarked) {
      setSolvedDraft(newDraft);
      setCarryOverSolvedDraft(newCarryDraft);
      pendingAutoSave.current = true;
      toast.success("🎯 Auto-detected solved problems!", {
        description: "Saving progress automatically...",
        duration: 4000,
      });
    }
  }, [data?.platformConnections, links, carryOverLinks, currentAccountId]);

  // Auto-save when problems are auto-marked as solved
  useEffect(() => {
    if (!pendingAutoSave.current || isSavingInProgressRef.current) return;
    pendingAutoSave.current = false;

    // Small delay to let state settle, then trigger saveProgress
    const timer = setTimeout(async () => {
      if (isSavingInProgressRef.current) return;
      isSavingInProgressRef.current = true;
      isAutoSaving.current = true;

      const currentProblems = latestProblemsRef.current;
      const currentAlreadyLogged = latestAlreadyLoggedRef.current;
      const currentLinks = latestLinksRef.current;
      const currentSolvedDraft = latestSolvedDraftRef.current;
      const currentCarryOverLinks = latestCarryOverLinksRef.current;
      const currentCarryOverSolvedDraft = latestCarryOverSolvedDraftRef.current;
      const currentSolvedMeta = latestSolvedMetaRef.current;

      // Inline save logic for auto-detected problems
      const cleaned: Record<string, boolean> = {};
      for (let slot = 0; slot < currentLinks.length; slot++) {
        cleaned[String(slot)] = !!currentSolvedDraft[String(slot)];
      }

      const carryCleaned: Record<string, boolean> = {};
      for (const co of currentCarryOverLinks) {
        const key = `${co.day}_${co.slot}`;
        carryCleaned[key] = !!currentCarryOverSolvedDraft[key];
      }

      const newAlreadyLogged = { ...currentAlreadyLogged };
      let newlyLoggedCount = 0;
      const insertedUrls = new Set<string>();

      try {
        // Save to localStorage
        const localKey = `today_target_solved_${dayKey}_${currentAccountId}`;
        localStorage.setItem(localKey, JSON.stringify(cleaned));

        const carryLocalKey = `carry_over_solved_${currentAccountId}`;
        localStorage.setItem(carryLocalKey, JSON.stringify(carryCleaned));

        // Log newly solved problems to the problems table
        for (let slot = 0; slot < currentLinks.length; slot++) {
          const slotKey = String(slot);
          const link = currentLinks[slot]?.trim();
          if (cleaned[slotKey] && link && !currentAlreadyLogged[slotKey]) {
            const normLink = normalizeUrl(link);
            // Deduplicate against database history and already inserted items in this run to prevent duplicates
            const exists = insertedUrls.has(normLink) || currentProblems?.some(
              (p) => p.accountId === currentAccountId && normalizeUrl(p.link) === normLink
            );
            if (exists) {
              newAlreadyLogged[slotKey] = true;
              continue;
            }

            const meta = currentSolvedMeta[slotKey] ?? { difficulty: "Medium", timeTaken: "25" };
            const { error } = await supabase.from("problems" as any).insert({
              account_id: currentAccountId,
              name: deriveName(link, slot),
              link,
              platform: derivePlatform(link),
              difficulty: meta.difficulty,
              topic: "Target Problem",
              time_taken: Number(meta.timeTaken) || 0,
              notes: `Today's Target -- Auto-synced from platform`,
            });
            if (!error) {
              newAlreadyLogged[slotKey] = true;
              insertedUrls.add(normLink);
              newlyLoggedCount++;
            }
          }
        }

        for (const co of currentCarryOverLinks) {
          const slotKey = `${co.day}_${co.slot}`;
          const link = co.link.trim();
          if (carryCleaned[slotKey] && link && !currentAlreadyLogged[slotKey]) {
            const normLink = normalizeUrl(link);
            // Deduplicate against database history and already inserted items in this run to prevent duplicates
            const exists = insertedUrls.has(normLink) || currentProblems?.some(
              (p) => p.accountId === currentAccountId && normalizeUrl(p.link) === normLink
            );
            if (exists) {
              newAlreadyLogged[slotKey] = true;
              continue;
            }

            const meta = currentSolvedMeta[slotKey] ?? { difficulty: "Medium", timeTaken: "25" };
            const { error } = await supabase.from("problems" as any).insert({
              account_id: currentAccountId,
              name: deriveName(link, co.slot),
              link,
              platform: derivePlatform(link),
              difficulty: meta.difficulty,
              topic: "Target Problem",
              time_taken: Number(meta.timeTaken) || 0,
              notes: `Carry-Over from ${co.day} -- Auto-synced`,
            });
            if (!error) {
              newAlreadyLogged[slotKey] = true;
              insertedUrls.add(normLink);
              newlyLoggedCount++;
            }
          }
        }

        // Save solved state
        const loggedKey = `today_target_logged_${dayKey}_${currentAccountId}`;
        localStorage.setItem(loggedKey, JSON.stringify(newAlreadyLogged));
        setAlreadyLogged(newAlreadyLogged);

        // Persist to Supabase
        const rows = currentLinks.map((_, slot) => ({
          day: dayKey,
          slot,
          account_id: currentAccountId,
          solved: !!cleaned[String(slot)],
          solved_at: cleaned[String(slot)] ? new Date().toISOString() : null,
        }));

        const carryRows = currentCarryOverLinks.map(co => ({
          day: co.day,
          slot: co.slot,
          account_id: currentAccountId,
          solved: !!carryCleaned[`${co.day}_${co.slot}`],
          solved_at: carryCleaned[`${co.day}_${co.slot}`] ? new Date().toISOString() : null,
        }));

        const allRows = [...rows, ...carryRows];

        await (supabase as any)
          .from("today_target_solutions")
          .upsert(allRows, { onConflict: "day,slot,account_id" });

        if (newlyLoggedCount > 0) {
          toast.success(`✅ Auto-saved ${newlyLoggedCount} solved problem${newlyLoggedCount > 1 ? "s" : ""}!`);
        }

        // Remove successfully saved carry-overs from the state so they disappear from the UI
        setCarryOverLinks(prev => prev.filter(co => !carryCleaned[`${co.day}_${co.slot}`]));

        await onRefresh?.();
      } catch (e) {
        console.error("Auto-save error:", e);
      } finally {
        isAutoSaving.current = false;
        isSavingInProgressRef.current = false;
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [solvedDraft, carryOverSolvedDraft]);

  const save = async () => {
    const cleaned = links.map((l) => l.trim());
    setBusy(true);
    try {
      const { error } = await (supabase as any)
        .from("today_targets")
        .upsert({ day: dayKey, links: cleaned }, { onConflict: "day" });

      if (error) {
        localStorage.setItem(`today_targets_${dayKey}`, JSON.stringify(cleaned));
        toast.success("Saved (lcal)", { description: "Create `today_targets` table in Supabase to sync across users." });
      } else {
        toast.success("Saved targets", { description: "Shared with the squad." });
      }
    } finally {
      setBusy(false);
    }
  };

  const saveProgress = async () => {
    if (isSavingInProgressRef.current) return;
    isSavingInProgressRef.current = true;
    setSaveProgressBusy(true);

    const currentProblems = latestProblemsRef.current;
    const currentAlreadyLogged = latestAlreadyLoggedRef.current;
    const currentLinks = latestLinksRef.current;
    const currentSolvedDraft = latestSolvedDraftRef.current;
    const currentCarryOverLinks = latestCarryOverLinksRef.current;
    const currentCarryOverSolvedDraft = latestCarryOverSolvedDraftRef.current;
    const currentSolvedMeta = latestSolvedMetaRef.current;

    const cleaned: Record<string, boolean> = {};
    for (let slot = 0; slot < currentLinks.length; slot++) {
      cleaned[String(slot)] = !!currentSolvedDraft[String(slot)];
    }

    const carryCleaned: Record<string, boolean> = {};
    for (const co of currentCarryOverLinks) {
      const key = `${co.day}_${co.slot}`;
      carryCleaned[key] = !!currentCarryOverSolvedDraft[key];
    }

    const newAlreadyLogged = { ...currentAlreadyLogged };
    let newlyLoggedCount = 0;
    const insertedUrls = new Set<string>();

    const activeSolvedUrls = new Set<string>();
    for (let slot = 0; slot < currentLinks.length; slot++) {
      const link = currentLinks[slot]?.trim();
      if (link && cleaned[String(slot)]) {
        activeSolvedUrls.add(normalizeUrl(link));
      }
    }
    for (const co of currentCarryOverLinks) {
      const link = co.link.trim();
      const key = `${co.day}_${co.slot}`;
      if (link && carryCleaned[key]) {
        activeSolvedUrls.add(normalizeUrl(link));
      }
    }

    try {
      // Only consider target problems from the last 2 days for deletion.
      // This covers today + yesterday (handles midnight/timezone edge cases)
      // WITHOUT touching older historical solved problems.
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0);

      const { data: dbProblems } = await (supabase as any)
        .from("problems")
        .select("id, link, solved_at")
        .eq("account_id", currentAccountId)
        .eq("topic", "Target Problem")
        .gte("solved_at", twoDaysAgo.toISOString());

      if (dbProblems) {
        const toDelete: string[] = [];
        for (const p of dbProblems) {
          const normLink = normalizeUrl((p as any).link);
          // Only delete recent target problems that are no longer checked as solved
          if (!activeSolvedUrls.has(normLink)) {
            toDelete.push((p as any).id);
          }
        }

        if (toDelete.length > 0) {
          await (supabase as any)
            .from("problems")
            .delete()
            .in("id", toDelete);

          // Reset their logged status in newAlreadyLogged so they can be re-logged if checked again
          for (let slot = 0; slot < currentLinks.length; slot++) {
            const link = currentLinks[slot]?.trim();
            if (link && !cleaned[String(slot)]) {
              const normLink = normalizeUrl(link);
              if (!activeSolvedUrls.has(normLink)) {
                newAlreadyLogged[String(slot)] = false;
              }
            }
          }
          for (const co of currentCarryOverLinks) {
            const key = `${co.day}_${co.slot}`;
            const link = co.link.trim();
            if (link && !carryCleaned[key]) {
              const normLink = normalizeUrl(link);
              if (!activeSolvedUrls.has(normLink)) {
                newAlreadyLogged[key] = false;
              }
            }
          }
        }
      }

      const localKey = `today_target_solved_${dayKey}_${currentAccountId}`;
      localStorage.setItem(localKey, JSON.stringify(cleaned));

      const carryLocalKey = `carry_over_solved_${currentAccountId}`;
      localStorage.setItem(carryLocalKey, JSON.stringify(carryCleaned));

      for (let slot = 0; slot < currentLinks.length; slot++) {
        const slotKey = String(slot);
        const link = currentLinks[slot]?.trim();
        if (cleaned[slotKey] && link && !currentAlreadyLogged[slotKey]) {
          const normLink = normalizeUrl(link);
          // Deduplicate against database history and already inserted items in this run to prevent duplicates
          const exists = insertedUrls.has(normLink) || currentProblems?.some(
            (p) => p.accountId === currentAccountId && normalizeUrl(p.link) === normLink
          );
          if (exists) {
            newAlreadyLogged[slotKey] = true;
            continue;
          }

          const meta = currentSolvedMeta[slotKey] ?? { difficulty: "Medium", timeTaken: "25" };
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
            insertedUrls.add(normLink);
            newlyLoggedCount++;
          }
        }
      }

      for (const co of currentCarryOverLinks) {
        const slotKey = `${co.day}_${co.slot}`;
        const link = co.link.trim();
        if (carryCleaned[slotKey] && link && !currentAlreadyLogged[slotKey]) {
          const normLink = normalizeUrl(link);
          // Deduplicate against database history and already inserted items in this run to prevent duplicates
          const exists = insertedUrls.has(normLink) || currentProblems?.some(
            (p) => p.accountId === currentAccountId && normalizeUrl(p.link) === normLink
          );
          if (exists) {
            newAlreadyLogged[slotKey] = true;
            continue;
          }

          const meta = currentSolvedMeta[slotKey] ?? { difficulty: "Medium", timeTaken: "25" };
          const { error } = await supabase.from("problems" as any).insert({
            account_id: currentAccountId,
            name: deriveName(link, co.slot),
            link,
            platform: derivePlatform(link),
            difficulty: meta.difficulty,
            topic: "Target Problem",
            time_taken: Number(meta.timeTaken) || 0,
            notes: `Carry-Over from ${co.day}`,
          });
          if (!error) {
            newAlreadyLogged[slotKey] = true;
            insertedUrls.add(normLink);
            newlyLoggedCount++;
          }
        }
      }

      const loggedKey = `today_target_logged_${dayKey}_${currentAccountId}`;
      localStorage.setItem(loggedKey, JSON.stringify(newAlreadyLogged));
      setAlreadyLogged(newAlreadyLogged);

      const rows = currentLinks.map((_, slot) => ({
        day: dayKey,
        slot,
        account_id: currentAccountId,
        solved: !!cleaned[String(slot)],
        solved_at: cleaned[String(slot)] ? new Date().toISOString() : null,
      }));

      const carryRows = currentCarryOverLinks.map(co => ({
        day: co.day,
        slot: co.slot,
        account_id: currentAccountId,
        solved: !!carryCleaned[`${co.day}_${co.slot}`],
        solved_at: carryCleaned[`${co.day}_${co.slot}`] ? new Date().toISOString() : null,
      }));

      const allRows = [...rows, ...carryRows];

      // Delete any obsolete slots in today_target_solutions that are now beyond currentLinks length
      await (supabase as any)
        .from("today_target_solutions")
        .delete()
        .eq("day", dayKey)
        .eq("account_id", currentAccountId)
        .gte("slot", currentLinks.length);

      const { error } = await (supabase as any)
        .from("today_target_solutions")
        .upsert(allRows, { onConflict: "day,slot,account_id" });

      if (error) {
        console.error("Supabase Save Error:", error);
        toast.error("Failed to sync with database", {
          description: error.message.includes("check constraint")
            ? "Too many target links! Database limit reached."
            : error.message
        });
      } else {
        if (newlyLoggedCount > 0) {
          toast.success(`Progress saved · ${newlyLoggedCount} problem${newlyLoggedCount > 1 ? "s" : ""} logged!`);
        } else {
          toast.success("Progress saved");
        }
        // Remove successfully saved carry-overs from the state
        setCarryOverLinks(prev => prev.filter(co => !carryCleaned[`${co.day}_${co.slot}`]));
      }

      await onRefresh?.();

      // Squad Goals Celebration Check
      const totalTargets = currentLinks.filter(l => l.trim()).length;
      if (totalTargets > 0) {
        const everyoneSolvedAll = users.every(u => {
          const solvedCount = currentLinks.filter((link, slot) => {
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
      isSavingInProgressRef.current = false;
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
      .subscribe();

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

      {/* ── Minimalist Header & Live multiplayer Standings ─────────────────── */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/40 pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black tracking-tight">Today's Targets</h3>
              {activePresenceCount > 1 && (
                <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                  {activePresenceCount} IN ARENA
                </div>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your targets below. Mark solved to auto-detect and log.
            </p>
          </div>

          {/* Standings Row — multiplayer indicator pills */}
          <div className="flex flex-wrap gap-2 items-center">
            {users.map((u) => {
              const count = links.filter((_, slot) => allSolved[String(slot)]?.has(u.id)).length;
              const total = links.filter((l) => l.trim()).length;
              const isOnline = Object.values(presence).flat().some(p => (p as any).id === u.id);
              const isSelf = u.id === currentAccountId;
              return (
                <div
                  key={u.id}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${isSelf
                    ? "border-primary/40 bg-primary/10 text-primary shadow-glow-sm"
                    : "border-border bg-card/60 text-foreground"
                    }`}
                >
                  <span className="relative flex h-2 w-2">
                    {isOnline && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                    )}
                    <span className={`relative inline-flex h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-neutral-600"}`}></span>
                  </span>
                  <span>{u.emoji} {u.name}</span>
                  <span className="font-mono font-black bg-background/50 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">
                    {count}/{total}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Interactive slots list ────────────────────────────────────────── */}
        <div className="grid gap-6">
          {links.map((link, idx) => {
            const slotKey = String(idx);
            const isSolved = !!solvedDraft[slotKey];
            const isLogged = !!alreadyLogged[slotKey];
            const meta = solvedMeta[slotKey] ?? { difficulty: "Medium", timeTaken: "25" };

            return (
              <div key={idx} className="grid gap-2 border-b border-border/30 pb-5 last:border-0 last:pb-0">
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
                      placeholder={`Target ${idx + 1} link (e.g. LeetCode / GFG)`}
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
                      {isSolved && !isLogged && (
                        <div className="hidden items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400 sm:flex">
                          <CheckCircle2 className="size-3" />
                          SYNCED
                        </div>
                      )}
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
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-11 shrink-0 gap-2 border border-primary/10 bg-primary/5 text-primary hover:bg-primary/10"
                          onClick={() => handleGetHint(slotKey, link)}
                          disabled={fetchingHint[slotKey]}
                        >
                          {fetchingHint[slotKey] ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                          {hints[slotKey] ? "Another Hint" : "Get AI Hint"}
                        </Button>
                        <Button variant="outline" size="sm" className="h-11 shrink-0 gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10" asChild>
                          <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-4" /> See the problem
                          </a>
                        </Button>
                        <button
                          type="button"
                          title={bookmarkedLinks.has(link) ? "Remove bookmark" : "Bookmark problem"}
                          onClick={() => toggleLinkBookmark(link)}
                          className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-bold transition ${bookmarkedLinks.has(link)
                            ? "border-accent bg-accent/10 text-accent hover:bg-accent/20"
                            : "border-border bg-secondary/40 text-muted-foreground hover:border-accent/40 hover:text-accent"
                            }`}
                        >
                          {bookmarkedLinks.has(link) ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
                        </button>
                      </>
                    )}
                    {links.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          // Re-key all slot-indexed state maps so the removed
                          // slot's solved/logged state never bleeds into adjacent slots
                          const rekey = <T,>(obj: Record<string, T>): Record<string, T> => {
                            const next: Record<string, T> = {};
                            for (let i = 0; i < links.length; i++) {
                              if (i === idx) continue;
                              const newSlot = i < idx ? i : i - 1;
                              if (obj[String(i)] !== undefined) next[String(newSlot)] = obj[String(i)]!;
                            }
                            return next;
                          };
                          const newSolvedDraft = rekey(solvedDraft);
                          const newAlreadyLogged = rekey(alreadyLogged);
                          setLinks(links.filter((_, i) => i !== idx));
                          setSolvedDraft(newSolvedDraft);
                          setSolvedMeta(rekey);
                          setAlreadyLogged(newAlreadyLogged);
                          setFetchedTitles(rekey);
                          setHints(rekey);
                          // Persist immediately so a page reload doesn't resurrect removed state
                          localStorage.setItem(`today_target_solved_${dayKey}_${currentAccountId}`, JSON.stringify(newSolvedDraft));
                          localStorage.setItem(`today_target_logged_${dayKey}_${currentAccountId}`, JSON.stringify(newAlreadyLogged));
                        }}
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

                {hints[slotKey] && (
                  <div className="ml-1 mt-1 mb-3 rounded-lg border border-accent/20 bg-accent/5 p-4 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-accent/20 p-1">
                        <Zap className="size-3 text-accent" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-1">AI Coach Hint</p>
                        <p className="text-sm text-foreground leading-relaxed">{hints[slotKey]}</p>
                      </div>
                    </div>
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
        </div>

        {/* ── bottom action row ────────────────────────────────────────────── */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/40 pt-5">
          <Button
            variant="outline"
            className="border-dashed text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all h-10 px-4"
            onClick={() => setLinks([...links, ""])}
          >
            <Plus className="mr-1.5 size-4" /> Add another target
          </Button>

          <Button variant="rival" className="h-10 font-bold" onClick={saveProgress} disabled={saveProgressBusy}>
            {saveProgressBusy ? <Loader2 className="animate-spin mr-1.5 size-4" /> : <Zap className="mr-1.5 size-4" />}
            Save My Progress
          </Button>
        </div>

        {/* ── Carry-overs section ──────────────────────────────────────────── */}
        {carryOverLinks.length > 0 && (
          <div className="mt-8 border-t border-border/40 pt-6 animate-in fade-in duration-500">
            <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Flame className="size-4 text-orange-500" />
              Carry-Over Targets
            </h4>
            <div className="grid gap-4">
              {carryOverLinks.map((co) => {
                const slotKey = `${co.day}_${co.slot}`;
                const isSolved = !!carryOverSolvedDraft[slotKey];
                const isLogged = !!alreadyLogged[slotKey];
                const meta = solvedMeta[slotKey] ?? { difficulty: "Medium", timeTaken: "25" };
                const link = co.link;

                return (
                  <div key={slotKey} className="grid gap-2 opacity-90 transition-opacity hover:opacity-100">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <input
                          readOnly
                          value={link}
                          className="h-11 w-full rounded-lg border border-input bg-background/50 px-3 pr-28 outline-none"
                        />
                        {fetchedTitles[slotKey] && link.trim() && (
                          <div className="mt-1.5 flex items-center gap-2 px-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                              {fetchedTitles[slotKey].platform}
                            </span>
                            <span className="text-xs font-bold truncate max-w-[200px] text-muted-foreground">
                              {fetchedTitles[slotKey].name}
                            </span>
                          </div>
                        )}
                        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                          {isSolved && !isLogged && (
                            <div className="hidden items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400 sm:flex">
                              <CheckCircle2 className="size-3" />
                              SYNCED
                            </div>
                          )}
                          <label className={`inline-flex h-8 cursor-pointer select-none items-center gap-2 rounded-md border px-3 text-xs font-black transition ${isLogged && isSolved ? "border-green-500/50 bg-green-500/10 text-green-400" : "border-border bg-secondary/50"}`}>
                            <input
                              type="checkbox"
                              className="accent-primary"
                              checked={isSolved}
                              onChange={(e) => setCarryOverSolvedDraft((s) => ({ ...s, [slotKey]: e.target.checked }))}
                            />
                            {isLogged && isSolved ? "Logged" : "Solved"}
                          </label>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button variant="outline" size="sm" className="h-11 shrink-0 gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10" asChild>
                          <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-4" /> See the problem
                          </a>
                        </Button>
                        <button
                          type="button"
                          title={bookmarkedLinks.has(link) ? "Remove bookmark" : "Bookmark problem"}
                          onClick={() => toggleLinkBookmark(link)}
                          className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-bold transition ${bookmarkedLinks.has(link)
                            ? "border-accent bg-accent/10 text-accent hover:bg-accent/20"
                            : "border-border bg-secondary/40 text-muted-foreground hover:border-accent/40 hover:text-accent"
                            }`}
                        >
                          {bookmarkedLinks.has(link) ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {isSolved && !isLogged && (
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
                      <span className="rounded-full bg-orange-500/10 text-orange-500/80 px-2 py-1">From {co.day}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Today's Revision Panel — sits inside TodayTargetView
───────────────────────────────────────────────────────────────────────── */

type RevisionItem = {
  id: string;
  name: string;
  link: string;
  platform: string;
  difficulty: string;
  topic: string;
  done: boolean;
  addedAt: string;
  source: "picked" | "new";
  problemId?: string | null;
};

function difficultyBadgeClass(d: string) {
  if (d === "Easy") return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
  if (d === "Hard") return "text-rose-400 bg-rose-400/10 border-rose-400/20";
  return "text-amber-400 bg-amber-400/10 border-amber-400/20";
}

function deriveRevisionName(url: string) {
  try {
    const parts = new URL(url.startsWith("http") ? url : `https://${url}`).pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("problems");
    const slug = idx !== -1 ? parts[idx + 1] : parts[parts.length - 1];
    return (slug || "Problem").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch { return "Problem"; }
}

function deriveRevisionPlatform(url: string) {
  try {
    const h = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase();
    if (h.includes("leetcode")) return "LeetCode";
    if (h.includes("geeksforgeeks") || h.includes("gfg")) return "GeeksforGeeks";
    if (h.includes("codeforces")) return "Codeforces";
    if (h.includes("codechef")) return "CodeChef";
    if (h.includes("hackerrank")) return "HackerRank";
    if (h.includes("atcoder")) return "AtCoder";
    return "Other";
  } catch { return "Other"; }
}

function TodayRevisionPanel({
  currentAccountId,
  problems,
  onRefresh,
}: {
  currentAccountId: string;
  problems: Problem[];
  onRefresh?: () => void;
}) {
  const dayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const [items, setItems] = useState<RevisionItem[]>([]);
  // Maps today_revisions.id → the revisions table row id, so undo can delete by exact id
  const [revisionIdMap, setRevisionIdMap] = useState<Record<string, string>>({});

  const fetchTodayRevisions = async () => {
    const { data: res, error } = await supabase
      .from("today_revisions" as any)
      .select("*")
      .eq("account_id", currentAccountId)
      .eq("day", dayKey);
    if (!error && res) {
      setItems(res.map((r: any) => ({
        id: r.id,
        name: r.name,
        link: r.link,
        platform: r.platform,
        difficulty: r.difficulty,
        topic: r.topic,
        done: r.done,
        addedAt: r.added_at,
        source: r.problem_id ? "picked" as const : "new" as const,
        problemId: r.problem_id,
      })));
    }
  };

  useEffect(() => {
    fetchTodayRevisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccountId, dayKey]);

  // ── Link input state ───────────────────────────────────────────────────
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [fetchedMeta, setFetchedMeta] = useState<{ name: string; platform: string; difficulty: string; topic: string } | null>(null);

  // ── Picker state ───────────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const myProblems = useMemo(
    () => problems.filter((p) => p.accountId === currentAccountId).sort((a, b) => new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime()),
    [problems, currentAccountId]
  );

  const filteredProblems = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return myProblems.slice(0, 50);
    return myProblems.filter((p) => p.name.toLowerCase().includes(q) || p.platform.toLowerCase().includes(q) || p.topic.toLowerCase().includes(q)).slice(0, 50);
  }, [myProblems, pickerSearch]);

  const addedIds = useMemo(() => new Set(items.map((i) => i.problemId).filter(Boolean)), [items]);

  // ── Fetch metadata for a link ──────────────────────────────────────────
  const fetchMetaForLink = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) { setFetchedMeta(null); return; }
    setFetchingMeta(true);
    try {
      const res = await fetch(`/api/problem-metadata?url=${encodeURIComponent(trimmed)}`);
      const meta = res.ok ? await res.json() : null;
      setFetchedMeta({
        name: meta?.name || deriveRevisionName(trimmed),
        platform: meta?.platform || deriveRevisionPlatform(trimmed),
        difficulty: meta?.difficulty || "Medium",
        topic: meta?.topic || "DSA",
      });
    } catch {
      setFetchedMeta({ name: deriveRevisionName(trimmed), platform: deriveRevisionPlatform(trimmed), difficulty: "Medium", topic: "DSA" });
    } finally {
      setFetchingMeta(false);
    }
  };

  const commitLinkItem = async () => {
    const link = linkDraft.trim();
    if (!link) return;
    const meta = fetchedMeta;
    const newId = `new_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const { error } = await supabase
      .from("today_revisions" as any)
      .insert({
        id: newId,
        account_id: currentAccountId,
        day: dayKey,
        name: meta?.name || deriveRevisionName(link),
        link,
        platform: meta?.platform || deriveRevisionPlatform(link),
        difficulty: meta?.difficulty || "Medium",
        topic: meta?.topic || "DSA",
        done: false,
        added_at: new Date().toISOString(),
      });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Added "${meta?.name || deriveRevisionName(link)}" to revision`);
      setLinkDraft("");
      setFetchedMeta(null);
      setLinkInputOpen(false);
      fetchTodayRevisions();
    }
  };

  const addFromPicker = async (p: Problem) => {
    if (addedIds.has(p.id)) { toast.info("Already in revision list"); return; }
    const { error } = await supabase
      .from("today_revisions" as any)
      .insert({
        id: p.id,
        account_id: currentAccountId,
        day: dayKey,
        problem_id: p.id,
        name: p.name,
        link: p.link,
        platform: p.platform,
        difficulty: p.difficulty,
        topic: p.topic,
        done: false,
        added_at: new Date().toISOString(),
      });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Added "${p.name}" to revision`);
      fetchTodayRevisions();
    }
  };

  const toggleDone = async (id: string) => {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    const newDone = !item.done;

    const { error: updateError } = await supabase
      .from("today_revisions" as any)
      .update({ done: newDone })
      .eq("id", id);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    if (newDone) {
      const { data: inserted, error: insertError } = await supabase
        .from("revisions" as any)
        .insert({
          account_id: currentAccountId,
          problem_id: item.problemId || null,
          name: item.name,
          link: item.link,
          platform: item.platform,
          difficulty: item.difficulty,
          topic: item.topic,
          revised_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insertError) {
        toast.error(insertError.message);
      } else {
        // Store the exact revision row id so undo can delete it precisely
        if (inserted) {
          setRevisionIdMap(prev => ({ ...prev, [id]: (inserted as any).id }));
        }
        toast.success("Revision logged!");
      }
    } else {
      const revId = revisionIdMap[id];
      if (revId) {
        // Delete by exact revision row id — no ambiguity
        const { error: deleteError } = await supabase
          .from("revisions" as any)
          .delete()
          .eq("id", revId);
        if (deleteError) {
          toast.error(deleteError.message);
        } else {
          setRevisionIdMap(prev => { const next = { ...prev }; delete next[id]; return next; });
          toast.success("Revision undone");
        }
      } else {
        // Fallback: delete by account + problem_id/link within today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { error: deleteError } = await supabase
          .from("revisions" as any)
          .delete()
          .eq("account_id", currentAccountId)
          .eq(item.problemId ? "problem_id" : "link", item.problemId || item.link)
          .gte("revised_at", todayStart.toISOString());
        if (deleteError) {
          toast.error(deleteError.message);
        } else {
          toast.success("Revision undone");
        }
      }
    }

    fetchTodayRevisions();
    onRefresh?.();
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase
      .from("today_revisions" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Removed from revision list");
      fetchTodayRevisions();
    }
  };

  const doneCount = items.filter((i) => i.done).length;
  const revisionPct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div className="glass-panel rounded-2xl p-5 space-y-5">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Repeat2 className="size-5 text-accent" />
            <h3 className="text-xl font-black">Revision Problems</h3>
            {items.length > 0 && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-accent">
                {doneCount}/{items.length} done
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Revise problems today — pick from your solved list or paste a link.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            id="revision-from-solved-btn"
            variant="secondary"
            size="sm"
            className="h-9 gap-2 border border-accent/20 bg-accent/10 text-accent hover:bg-accent/20 font-bold"
            onClick={() => { setPickerOpen((o) => !o); setLinkInputOpen(false); }}
          >
            <BookOpen className="size-4" /> From Solved
          </Button>
          <Button
            id="revision-add-link-btn"
            variant="secondary"
            size="sm"
            className="h-9 gap-2 border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 font-bold"
            onClick={() => { setLinkInputOpen((o) => !o); setPickerOpen(false); setLinkDraft(""); setFetchedMeta(null); }}
          >
            <Plus className="size-4" /> Add Problem
          </Button>
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────── */}
      {items.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span className="font-semibold uppercase tracking-widest text-[10px]">Revision Progress</span>
            <span className="font-mono font-bold text-foreground">{revisionPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/40">
            <div
              className={`h-full rounded-full transition-all duration-700 ${revisionPct === 100 ? "bg-green-500 shadow-glow" : "bg-gradient-to-r from-accent via-primary to-accent"}`}
              style={{ width: `${revisionPct}%` }}
            />
          </div>
          {revisionPct === 100 && <p className="mt-1.5 text-xs font-bold text-green-400">🎉 All revision problems done for today!</p>}
        </div>
      )}

      {/* ── Link input — same aesthetic as Today's Target slots ─────── */}
      {linkInputOpen && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Add Revision Problem via Link</span>
            <button type="button" onClick={() => { setLinkInputOpen(false); setLinkDraft(""); setFetchedMeta(null); }} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="relative flex-1">
              <input
                autoFocus
                value={linkDraft}
                onChange={(e) => { setLinkDraft(e.target.value); setFetchedMeta(null); }}
                onBlur={() => { if (linkDraft.trim()) fetchMetaForLink(linkDraft); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); linkDraft.trim() && !fetchingMeta ? (fetchedMeta ? commitLinkItem() : fetchMetaForLink(linkDraft)) : undefined; }
                }}
                placeholder="Paste problem link — e.g. https://leetcode.com/problems/two-sum/"
                className="h-11 w-full rounded-lg border border-input bg-background/70 px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              {fetchingMeta && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Fetched title badge — identical to Today's Target */}
              {fetchedMeta && linkDraft.trim() && (
                <div className="mt-1.5 flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                    {fetchedMeta.platform}
                  </span>
                  <span className="text-xs font-bold truncate max-w-[220px]">{fetchedMeta.name}</span>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${difficultyBadgeClass(fetchedMeta.difficulty)}`}>
                    {fetchedMeta.difficulty}
                  </span>
                </div>
              )}
            </div>

            <div className="flex shrink-0 gap-2">
              {linkDraft.trim() && (
                <Button variant="outline" size="sm" className="h-11 gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10" asChild>
                  <a href={linkDraft.startsWith("http") ? linkDraft : `https://${linkDraft}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> See problem
                  </a>
                </Button>
              )}
              <Button
                variant="rival"
                size="sm"
                className="h-11"
                disabled={!linkDraft.trim() || fetchingMeta}
                onClick={() => { fetchedMeta ? commitLinkItem() : fetchMetaForLink(linkDraft); }}
              >
                {fetchedMeta ? <><Plus className="size-4" /> Add to Revision</> : fetchingMeta ? <><Loader2 className="size-4 animate-spin" /> Fetching…</> : <><Zap className="size-4" /> Fetch & Add</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── From Solved picker ─────────────────────────────────────── */}
      {pickerOpen && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 animate-in fade-in slide-in-from-top-1 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-accent">Pick from Your Solved Problems</p>
            <button type="button" onClick={() => setPickerOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input autoFocus value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Search by name, platform, or topic..." className="h-10 w-full rounded-lg border border-input bg-background/70 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          {myProblems.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No solved problems yet. Add some in <span className="font-semibold text-foreground">My Problems</span>.</p>
          ) : filteredProblems.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No matches found.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {filteredProblems.map((p) => {
                const alreadyAdded = addedIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition ${alreadyAdded ? "border-border bg-card/30 opacity-50 cursor-not-allowed" : "border-border bg-card/60 hover:border-accent/40 hover:bg-accent/5 cursor-pointer"}`}
                    onClick={() => !alreadyAdded && addFromPicker(p)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-bold">{p.name}</span>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${difficultyBadgeClass(p.difficulty)}`}>{p.difficulty}</span>
                        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{p.platform}</span>
                        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{p.topic}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Solved {new Date(p.solvedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {alreadyAdded ? (
                        <span className="text-[10px] font-bold text-muted-foreground">Added</span>
                      ) : (
                        <span className="rounded-md bg-accent/20 px-2 py-1 text-[10px] font-black text-accent hover:bg-accent/30 transition">
                          + Add
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Revision problem list — Today's Target slot style ───────── */}
      {items.length === 0 && !linkInputOpen && !pickerOpen ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Repeat2 className="size-7" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">No revision problems for today</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click <span className="font-semibold text-foreground">From Solved</span> or{" "}
            <span className="font-semibold text-foreground">Add Problem</span> above to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => {
            const isSolved = item.done;
            return (
              <div key={item.id} className="grid gap-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <div className={`flex h-11 w-full items-center rounded-lg border px-3 pr-32 text-sm transition ${isSolved ? "border-green-500/40 bg-green-500/5" : "border-input bg-background/70"}`}>
                      {item.link ? (
                        <a href={item.link.startsWith("http") ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className={`truncate font-medium hover:underline ${isSolved ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {item.link}
                        </a>
                      ) : (
                        <span className={`truncate ${isSolved ? "line-through text-muted-foreground" : "text-muted-foreground"}`}>{item.name}</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 px-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${isSolved ? "text-green-400 bg-green-400/10 border-green-400/20" : "text-primary bg-primary/10 border-primary/20"}`}>
                        {item.platform}
                      </span>
                      <span className={`text-xs font-bold truncate max-w-[200px] ${isSolved ? "line-through text-muted-foreground" : ""}`}>{item.name}</span>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${difficultyBadgeClass(item.difficulty)}`}>{item.difficulty}</span>
                      <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{item.topic}</span>
                    </div>
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                      {isSolved && (
                        <div className="hidden items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400 sm:flex">
                          <CheckCircle2 className="size-3" /> DONE
                        </div>
                      )}
                      <label className={`inline-flex h-8 cursor-pointer select-none items-center gap-2 rounded-md border px-3 text-xs font-black transition ${isSolved ? "border-green-500/50 bg-green-500/10 text-green-400" : "border-border bg-secondary/50"}`}>
                        <input type="checkbox" className="accent-primary" checked={isSolved} onChange={() => toggleDone(item.id)} />
                        {isSolved ? "Revised" : "Revised?"}
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.link && (
                      <Button variant="outline" size="sm" className="h-11 shrink-0 gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10" asChild>
                        <a href={item.link.startsWith("http") ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" /> See the problem
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => removeItem(item.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {isSolved && <p className="ml-1 text-xs font-semibold text-green-400">✓ Marked as revised for today</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add more buttons ──────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="flex gap-2 border-t border-border pt-3">
          <Button variant="outline" className="flex-1 border-dashed py-7 text-muted-foreground hover:text-accent hover:border-accent/50 hover:bg-accent/5 transition-all" onClick={() => { setPickerOpen(true); setLinkInputOpen(false); }}>
            <BookOpen className="mr-2 size-4" /> Add from Solved
          </Button>
          <Button variant="outline" className="flex-1 border-dashed py-7 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all" onClick={() => { setLinkInputOpen(true); setPickerOpen(false); setLinkDraft(""); setFetchedMeta(null); }}>
            <Plus className="mr-2 size-4" /> Add New Problem
          </Button>
        </div>
      )}
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
    <div className="glass-panel rounded-xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="size-4 text-primary" />
        <h3 className="text-sm font-bold">Squad Activity</h3>
      </div>
      {recentProblems.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {recentProblems.map((p, i) => {
            const user = users.find(u => u.id === p.accountId);
            return (
              <li key={i} className="flex items-center gap-3 py-2 text-sm">
                <span className="text-base shrink-0">{user?.emoji || "👤"}</span>
                <span className="flex-1 truncate">
                  <span className="font-semibold text-primary">{user?.name || "Someone"}</span>
                  <span className="text-muted-foreground"> · {p.name}</span>
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(p.solvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
function Heatmap({
  currentAccountId,
  problems,
  revisions = [],
  title = "Contribution Heatmap",
}: {
  currentAccountId: string;
  problems: Problem[];
  revisions?: Revision[];
  title?: string;
}) {
  const mineProblems = useMemo(
    () => problems.filter((problem) => problem.accountId === currentAccountId),
    [problems, currentAccountId],
  );

  const mineRevisions = useMemo(
    () => (revisions || []).filter((r) => r.accountId === currentAccountId),
    [revisions, currentAccountId],
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

    const countsByDay = new Map<
      string,
      { solved: number; revised: number; solvedProblems: string[]; revisedProblems: string[] }
    >();

    for (const p of mineProblems) {
      const key = localDateKey(new Date(p.solvedAt));
      const existing = countsByDay.get(key) || { solved: 0, revised: 0, solvedProblems: [], revisedProblems: [] };
      countsByDay.set(key, {
        ...existing,
        solved: existing.solved + 1,
        solvedProblems: [...existing.solvedProblems, p.name],
      });
    }
    // Deduplicate revisions by unique problem per day (problem_id or link)
    // so toggling done multiple times doesn't inflate the count
    const seenRevisions = new Map<string, Set<string>>(); // date -> Set of unique keys
    for (const r of mineRevisions) {
      const dateKey = localDateKey(new Date(r.revisedAt));
      const uniqueKey = r.problemId || r.link || r.id;
      if (!seenRevisions.has(dateKey)) seenRevisions.set(dateKey, new Set());
      if (seenRevisions.get(dateKey)!.has(uniqueKey)) continue; // skip duplicate
      seenRevisions.get(dateKey)!.add(uniqueKey);

      const existing = countsByDay.get(dateKey) || { solved: 0, revised: 0, solvedProblems: [], revisedProblems: [] };
      countsByDay.set(dateKey, {
        ...existing,
        revised: existing.revised + 1,
        revisedProblems: [...existing.revisedProblems, r.name || "Custom Problem"],
      });
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
      const counts = countsByDay.get(localDateKey(d)) || { solved: 0, revised: 0, solvedProblems: [], revisedProblems: [] };
      const total = counts.solved + counts.revised;
      if (total > computedMax) computedMax = total;
      return {
        date: d,
        solved: counts.solved,
        revised: counts.revised,
        total,
        solvedProblems: counts.solvedProblems,
        revisedProblems: counts.revisedProblems,
      };
    });

    const computedWeeks: {
      days: {
        date: Date;
        solved: number;
        revised: number;
        total: number;
        solvedProblems: string[];
        revisedProblems: string[];
      }[];
    }[] = [];
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
  }, [mineProblems, mineRevisions]);

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

  const getTooltipText = (solved: number, revised: number) => {
    if (solved === 0 && revised === 0) return "No contributions";
    const parts = [];
    if (solved > 0) {
      parts.push(`${solved} solved`);
    }
    if (revised > 0) {
      parts.push(`${revised} ${revised === 1 ? "revision" : "revisions"}`);
    }
    return parts.join(", ");
  };

  const weekdayLabels = [
    { row: 1, label: "Mon" },
    { row: 3, label: "Wed" },
    { row: 5, label: "Fri" },
  ];

  return (
    <TooltipProvider delayDuration={50}>
      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-xl font-bold">{title}</h3>
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
                      const level = levelFor(d.total);
                      return (
                        <Tooltip key={dayIndex}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={`gh-heat-square gh-heat-${level} transition-all duration-150 hover:scale-110`}
                              aria-label={`${d.solved} solved, ${d.revised} revised on ${dayFormatter.format(d.date)}`}
                            />
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="center"
                            className="z-50 max-w-[280px] min-w-[180px] rounded-lg border border-border bg-popover px-3 py-2 text-left text-popover-foreground shadow-xl animate-in fade-in-50 duration-150"
                          >
                            <div className="text-xs text-muted-foreground mb-1 font-semibold">
                              {dayFormatter.format(d.date)}
                            </div>
                            <div className="text-sm font-bold border-b border-border/50 pb-1 mb-1">
                              {getTooltipText(d.solved, d.revised)}
                            </div>
                            {d.solvedProblems.length > 0 && (
                              <div className="mt-1.5 text-[11px]">
                                <span className="text-primary font-bold">Solved:</span>
                                <ul className="list-disc pl-3.5 mt-0.5 space-y-0.5 text-muted-foreground">
                                  {d.solvedProblems.map((name, i) => (
                                    <li key={i} className="truncate max-w-[240px]" title={name}>{name}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {d.revisedProblems.length > 0 && (
                              <div className="mt-1.5 text-[11px]">
                                <span className="text-accent font-bold">Revised:</span>
                                <ul className="list-disc pl-3.5 mt-0.5 space-y-0.5 text-muted-foreground">
                                  {d.revisedProblems.map((name, i) => (
                                    <li key={i} className="truncate max-w-[240px]" title={name}>{name}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

const DS_TOPICS = ["Arrays", "Strings", "Hashing", "Two Pointers", "Sorting", "Binary Search", "Sliding Window", "Linked List", "Stack", "Queue", "Trees", "Graphs", "Heap", "DP", "Greedy", "Backtracking", "Recursion", "Math", "Bit Manipulation", "Other"] as const;
type DsTopic = typeof DS_TOPICS[number];

function useBookmarks(storageKey: string) {
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  const toggle = (id: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  };
  return { bookmarks, toggle };
}

function getTopicGroup(p: Problem): DsTopic {
  const combined = `${p.topic || ""} ${p.name || ""}`.toLowerCase();
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

const DS_ICON_MAP: Record<string, string> = {
  Arrays: "🔢", Graphs: "🕸️", DP: "🧠", Trees: "🌲", Heap: "⛰️",
  "Sliding Window": "🪟", "Binary Search": "🔍", Backtracking: "↩️",
  Strings: "🔤", "Linked List": "🔗", Stack: "📚", Queue: "🚦",
  Hashing: "🗝️", "Two Pointers": "✌️", Sorting: "🗂️", Greedy: "🤑",
  Recursion: "🔄", Math: "➗", "Bit Manipulation": "0️⃣", Other: "📦",
};

function MyProblems({ currentAccountId, problems, revisions = [] }: { currentAccountId: string; problems: Problem[]; revisions?: Revision[] }) {
  const [filter, setFilter] = useState("");
  const [diff, setDiff] = useState<"All" | "Easy" | "Medium" | "Hard">("All");
  const [activeDs, setActiveDs] = useState<DsTopic | "All">("All");
  const [dsSubTab, setDsSubTab] = useState<"All" | "Bookmarked">("All");
  const { bookmarks, toggle: toggleBookmark } = useBookmarks(`bookmarks_${currentAccountId}`);

  const mine = useMemo(
    () => problems.filter((p) => p.accountId === currentAccountId),
    [problems, currentAccountId]
  );

  const counts = useMemo(() => ({
    total: mine.length,
    easy: mine.filter((p) => p.difficulty === "Easy").length,
    medium: mine.filter((p) => p.difficulty === "Medium").length,
    hard: mine.filter((p) => p.difficulty === "Hard").length,
  }), [mine]);

  // Group problems by DS topic
  const byTopic = useMemo(() => {
    const map: Partial<Record<DsTopic, Problem[]>> = {};
    for (const p of mine) {
      const g = getTopicGroup(p);
      if (!map[g]) map[g] = [];
      map[g]!.push(p);
    }
    return map;
  }, [mine]);

  const activeTopics = DS_TOPICS; // Show all topics as tabs so the user can see them

  const applyFilters = (list: Problem[]) => {
    const q = filter.toLowerCase();
    return list
      .filter((p) => diff === "All" || p.difficulty === diff)
      .filter((p) => `${p.platform} ${p.difficulty} ${p.topic} ${p.name}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime());
  };

  const diffFilters: Array<{ key: typeof diff; label: string; count: number; tone: string }> = [
    { key: "All", label: "All", count: counts.total, tone: "text-foreground" },
    { key: "Easy", label: "Easy", count: counts.easy, tone: "text-green-500" },
    { key: "Medium", label: "Medium", count: counts.medium, tone: "text-yellow-500" },
    { key: "Hard", label: "Hard", count: counts.hard, tone: "text-red-500" },
  ];

  return (
    <section className="animate-enter space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-2xl font-black">My Problems</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {counts.total} solved · <span className="text-green-500">{counts.easy} easy</span> · <span className="text-yellow-500">{counts.medium} medium</span> · <span className="text-red-500">{counts.hard} hard</span>
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-input bg-background/70 px-3 sm:w-72">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-10 flex-1 bg-transparent text-sm outline-none"
            placeholder="Search name, platform, topic..."
          />
        </label>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Left Sidebar (DS Topics) - 30% on desktop */}
        <div className="flex flex-col gap-1 md:sticky md:top-24 md:w-[30%] shrink-0 max-h-[75vh] overflow-y-auto rounded-xl border border-border bg-secondary/10 p-2">
          <button
            type="button"
            onClick={() => { setActiveDs("All"); setDsSubTab("All"); }}
            className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-bold transition ${activeDs === "All"
              ? "bg-primary text-primary-foreground shadow-glow"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
          >
            <span className="flex items-center gap-3">📋 All Topics</span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${activeDs === "All" ? "bg-white/20" : "bg-secondary"}`}>{counts.total}</span>
          </button>

          <div className="my-2 h-px bg-border/50" />

          {activeTopics.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { setActiveDs(t); setDsSubTab("All"); }}
              className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-bold transition ${activeDs === t
                ? "bg-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
            >
              <span className="flex items-center gap-3"><span className="text-lg leading-none">{DS_ICON_MAP[t]}</span> {t}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${activeDs === t ? "bg-white/20" : "bg-secondary"}`}>{byTopic[t]?.length ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Right Content (Problems & Filters) - 70% on desktop */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Bookmarked sub-tab + Difficulty filter row */}
          <div className="flex flex-wrap items-center gap-3">
            {activeDs !== "All" && (
              <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/30 p-1">
                {(["All", "Bookmarked"] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDsSubTab(tab)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${dsSubTab === tab
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                      }`}
                  >
                    {tab === "Bookmarked" && <Bookmark className="size-3" />}
                    {tab}
                    {tab === "Bookmarked" && (
                      <span className="rounded-full bg-accent/20 px-1.5 text-[10px]">
                        {(byTopic[activeDs as DsTopic] ?? []).filter(p => bookmarks.has(p.id)).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/30 p-1">
              {diffFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setDiff(f.key)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${diff === f.key
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : `${f.tone} hover:bg-secondary`
                    }`}
                >
                  {f.label}
                  <span className={`rounded-full px-1.5 text-[10px] ${diff === f.key ? "bg-primary-foreground/20" : "bg-secondary"}`}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Problems — grouped with section headings when All Topics */}
          {activeDs === "All" ? (
            <div className="space-y-8">
              {activeTopics.map(topic => {
                const list = applyFilters(
                  (byTopic[topic] ?? []).filter(p => dsSubTab === "Bookmarked" ? bookmarks.has(p.id) : true)
                );
                if (list.length === 0) return null;
                return (
                  <div key={topic}>
                    {/* Section heading */}
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2">
                        <span className="text-lg">{DS_ICON_MAP[topic]}</span>
                        <span className="text-base font-black text-primary">{topic}</span>
                        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-black text-primary">{list.length}</span>
                      </div>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                    <ProblemList problems={list} bookmarks={bookmarks} onToggleBookmark={toggleBookmark} revisions={revisions} />
                  </div>
                );
              })}
              {mine.length === 0 && (
                <div className="glass-panel rounded-xl p-10 text-center text-sm text-muted-foreground">
                  No problems yet. Start solving!
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Section heading for selected DS */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2">
                  <span className="text-lg">{DS_ICON_MAP[activeDs]}</span>
                  <span className="text-base font-black text-primary">{activeDs}</span>
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-black text-primary">
                    {(byTopic[activeDs as DsTopic] ?? []).length}
                  </span>
                  {dsSubTab === "Bookmarked" && (
                    <span className="flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-black text-accent">
                      <Bookmark className="size-3" /> Bookmarked
                    </span>
                  )}
                </div>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <ProblemList
                problems={applyFilters(
                  (byTopic[activeDs as DsTopic] ?? []).filter(p => dsSubTab === "Bookmarked" ? bookmarks.has(p.id) : true)
                )}
                bookmarks={bookmarks}
                onToggleBookmark={toggleBookmark}
                revisions={revisions}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ProblemList({
  problems,
  bookmarks,
  onToggleBookmark,
  revisions = [],
}: {
  problems: Problem[];
  bookmarks?: Set<string>;
  onToggleBookmark?: (id: string) => void;
  revisions?: Revision[];
}) {
  const [viewingCode, setViewingCode] = useState<string | null>(null);

  const revisionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of revisions || []) {
      if (r.problemId) {
        map.set(r.problemId, (map.get(r.problemId) || 0) + 1);
      }
    }
    return map;
  }, [revisions]);

  function getRevisionBadge(count: number) {
    if (!count) return null;
    let colorClass = "";
    if (count === 1) {
      colorClass = "text-rose-400 bg-rose-400/10 border-rose-400/20";
    } else if (count === 2) {
      colorClass = "text-amber-400 bg-amber-400/10 border-amber-400/20";
    } else if (count === 3) {
      colorClass = "text-blue-400 bg-blue-400/10 border-blue-400/20";
    } else {
      colorClass = "text-emerald-400 bg-emerald-400/10 border-emerald-400/20 shadow-glow font-black animate-pulse";
    }
    return (
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${colorClass}`}>
        Revised {count}x
      </span>
    );
  }

  if (problems.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-10 text-center text-sm text-muted-foreground">
        No problems match your filters.
      </div>
    );
  }

  const borderByDiff: Record<string, string> = {
    Easy: "border-l-green-500",
    Medium: "border-l-yellow-500",
    Hard: "border-l-red-500",
  };

  return (
    <>
      <ul className="space-y-2">
        {problems.map((p) => {
          const isBookmarked = bookmarks?.has(p.id) ?? false;
          const revCount = revisionCounts.get(p.id) || 0;
          return (
            <li
              key={p.id}
              className={`group flex items-center gap-4 rounded-xl border border-border border-l-[3px] ${borderByDiff[p.difficulty] ?? ""} bg-card/50 px-4 py-3 transition hover:-translate-y-px hover:border-primary/40 hover:bg-card`}
            >
              <div className="min-w-0 flex-1">
                {p.link ? (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 text-sm font-semibold transition hover:text-primary"
                  >
                    <span className="truncate">{p.name}</span>
                    <ExternalLink className="size-3 shrink-0 opacity-0 transition group-hover:opacity-60" />
                  </a>
                ) : (
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="font-bold uppercase tracking-wider">{p.platform}</span>
                  <span className="opacity-50">·</span>
                  <span className="font-semibold text-primary">{p.topic}</span>
                  <span className="opacity-50">·</span>
                  <span>{p.timeTaken}m</span>
                  <span className="opacity-50">·</span>
                  <span>{new Date(p.solvedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  {revCount > 0 && (
                    <>
                      <span className="opacity-50">·</span>
                      {getRevisionBadge(revCount)}
                    </>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {onToggleBookmark && (
                  <button
                    type="button"
                    onClick={() => onToggleBookmark(p.id)}
                    title={isBookmarked ? "Remove bookmark" : "Bookmark this problem"}
                    className={`rounded-md border p-2 transition ${isBookmarked
                      ? "border-accent bg-accent/10 text-accent hover:bg-accent/20"
                      : "border-border text-muted-foreground hover:border-accent/40 hover:text-accent"
                      }`}
                  >
                    {isBookmarked ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
                  </button>
                )}
                {p.code && (
                  <button
                    type="button"
                    onClick={() => setViewingCode(p.code!)}
                    title="View solution"
                    className="rounded-md border border-border p-2 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                  >
                    <BookOpenCheck className="size-4" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {viewingCode && (
        <div
          className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setViewingCode(null)}
        >
          <div
            className="glass-panel animate-in zoom-in-95 w-full max-w-4xl rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/20 p-2">
                  <ShieldCheck className="size-5 text-primary" />
                </div>
                <h4 className="text-lg font-bold">Solution</h4>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setViewingCode(null)}>
                <LogOut className="size-4" /> Close
              </Button>
            </div>
            <pre className="scrollbar-thin scrollbar-thumb-primary/20 max-h-[60vh] overflow-auto rounded-xl border border-border bg-background/50 p-6 font-mono text-[11px] leading-relaxed text-foreground">
              <code>{viewingCode}</code>
            </pre>
          </div>
        </div>
      )}
    </>
  );
}

function HallOfFame({ users, problems, revisions = [] }: { users: MutualUser[]; problems: Problem[]; revisions?: Revision[] }) {
  const ranked = [...users].map(user => ({
    ...user,
    stats: userStats(problems, user.id, revisions)
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

// Accent colours for chart bars — one per user. Index 0 = current user (primary).
const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(262 83% 68%)",  // violet
  "hsl(340 82% 62%)",  // rose
  "hsl(173 58% 52%)",  // teal
  "hsl(38 96% 56%)",   // amber
];

function Analytics({ currentAccountId, users, problems }: { currentAccountId: string; users: MutualUser[]; problems: Problem[] }) {
  const friends = users.filter(u => u.id !== currentAccountId);
  // For charts, allow user to pick which friend to compare against (default first friend)
  const [selectedFriendId, setSelectedFriendId] = useState<string>(() => friends[0]?.id ?? "");

  const mine = useMemo(() => problems.filter((problem) => problem.accountId === currentAccountId), [problems, currentAccountId]);
  const friendProblems = useMemo(
    () => problems.filter((problem) => problem.accountId === selectedFriendId),
    [problems, selectedFriendId]
  );
  const selectedFriend = users.find(u => u.id === selectedFriendId);

  const { weeklyBars, monthlyBars, mineAvg, friendAvg, pieData } = useMemo(() => {
    const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const mineCountsByDay = new Map<string, number>();
    for (const p of mine) {
      const key = dayKey(startOfLocalDay(new Date(p.solvedAt)));
      mineCountsByDay.set(key, (mineCountsByDay.get(key) ?? 0) + 1);
    }
    const friendCountsByDay = new Map<string, number>();
    for (const p of friendProblems) {
      const key = dayKey(startOfLocalDay(new Date(p.solvedAt)));
      friendCountsByDay.set(key, (friendCountsByDay.get(key) ?? 0) + 1);
    }

    const today = startOfLocalDay(new Date());

    // Weekly: last 7 days (including today)
    const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
    const weekly = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return { label: weekdayFmt.format(d), mine: mineCountsByDay.get(dayKey(d)) ?? 0, friend: friendCountsByDay.get(dayKey(d)) ?? 0 };
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
    for (const p of friendProblems) {
      const d = new Date(p.solvedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (monthFriend.has(key)) monthFriend.set(key, (monthFriend.get(key) ?? 0) + 1);
    }
    const monthly = Array.from(monthMine.keys()).map((key) => {
      const [y, m] = key.split("-").map(Number);
      return { label: monthFmt.format(new Date(y!, m!, 1)), mine: monthMine.get(key) ?? 0, friend: monthFriend.get(key) ?? 0 };
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
      pieData: [
        { name: "You", value: Number(avg.toFixed(3)), fill: CHART_COLORS[0]! },
        { name: selectedFriend?.name ?? "Rival", value: Number(avgFriend.toFixed(3)), fill: CHART_COLORS[1]! },
      ],
    };
  }, [mine, friendProblems, selectedFriend]);

  return (
    <section className="animate-enter space-y-6">
      {/* Friend picker when multiple friends */}
      {friends.length > 1 && (
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-muted-foreground">Compare against</h3>
          <div className="flex flex-wrap gap-2">
            {friends.map((f, idx) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFriendId(f.id)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${selectedFriendId === f.id
                  ? "border-primary bg-primary/10 text-primary shadow-glow-sm"
                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: CHART_COLORS[(idx + 1) % CHART_COLORS.length] }}
                />
                {f.emoji} {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <h3 className="mb-1 text-2xl font-black">Monthly Progress</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            You vs {selectedFriend ? `${selectedFriend.emoji} ${selectedFriend.name}` : "—"} · last 6 months.
          </p>
          <ChartContainer
            className="h-[260px] w-full"
            config={{
              mine: { label: "You", color: CHART_COLORS[0]! },
              friend: { label: selectedFriend?.name ?? "Rival", color: CHART_COLORS[1]! },
            }}
          >
            <BarChart data={monthlyBars} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="mine" fill={CHART_COLORS[0]!} radius={[8, 8, 0, 0]} />
              <Bar dataKey="friend" fill={CHART_COLORS[1]!} radius={[8, 8, 0, 0]} />
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
              You: { label: "You", color: CHART_COLORS[0]! },
              Rival: { label: selectedFriend?.name ?? "Rival", color: CHART_COLORS[1]! },
            }}
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={92}
                stroke="transparent"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h3 className="mb-1 text-2xl font-black">Weekly Progress</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          You vs {selectedFriend ? `${selectedFriend.emoji} ${selectedFriend.name}` : "—"} · last 7 days.
        </p>
        <ChartContainer
          className="h-[240px] w-full"
          config={{
            mine: { label: "You", color: CHART_COLORS[0]! },
            friend: { label: selectedFriend?.name ?? "Rival", color: CHART_COLORS[1]! },
          }}
        >
          <BarChart data={weeklyBars} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="mine" fill={CHART_COLORS[0]!} radius={[8, 8, 0, 0]} />
            <Bar dataKey="friend" fill={CHART_COLORS[1]!} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>
    </section>
  );
}



function Profile({ currentAccountId, profiles, users, problems, revisions = [], onRefresh, onLogout }: { currentAccountId: string; profiles: ProfileType[]; users: MutualUser[]; problems: Problem[]; revisions?: Revision[]; onRefresh: () => Promise<void>; onLogout: () => void }) {
  const profile = profiles.find((item) => item.account_id === currentAccountId)!;
  const user = mapUser(profile, problems);
  const stats = userStats(problems, currentAccountId, revisions);
  const duoId = profile.rival_user_id ?? null;
  const duo = duoId ? users.find((item) => item.id === duoId) ?? null : null;
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

  return <section className="glass-panel animate-enter rounded-2xl p-6"><div className="text-7xl">{user.emoji}</div><h3 className="mt-4 text-3xl font-black">{user.name}</h3><p className="text-primary">@{user.username} · {user.title}</p><div className="mt-6 grid gap-4 sm:grid-cols-4"><StatCard label="Solved" value={stats.total} Icon={Medal} /><StatCard label="This Week" value={stats.week} Icon={ListFilter} /><StatCard label="Hard Wins" value={stats.hard} Icon={Swords} /><StatCard label="Minutes" value={stats.minutes} Icon={Activity} /></div><div className="mt-6 rounded-xl border border-border bg-card/70 p-4"><h4 className="font-bold">Choose your main duo</h4><p className="mt-1 text-sm text-muted-foreground">Enter a mutual's username to compare directly.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={mutualUsername} onChange={(e) => setMutualUsername(e.target.value)} className="h-11 flex-1 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="mutual_username" /><Button type="button" variant="rival" onClick={saveMutual}>Save Mutual</Button></div></div><div className="mt-6 space-y-4">{duo ? <Heatmap currentAccountId={duo.id} problems={problems} revisions={revisions} title={`${duo.emoji} ${duo.name}'s Contributions`} /> : <div className="glass-panel rounded-2xl p-5 text-sm text-muted-foreground">Set a duo above to see their contribution heatmap.</div>}<Heatmap currentAccountId={currentAccountId} problems={problems} revisions={revisions} title={`${user.emoji} ${user.name}'s Contributions`} /></div><div className="mt-10 pt-6 border-t border-destructive/20"><h4 className="text-destructive font-bold">Danger Zone</h4><p className="mt-1 text-sm text-muted-foreground">Resetting your data will permanently delete your account and all progress.</p><Button type="button" variant="destructive" className="mt-4" onClick={handleReset} disabled={resetting}>{resetting ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Reset All Data</Button></div></section>;
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
