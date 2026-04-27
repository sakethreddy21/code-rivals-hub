import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Flame,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Medal,
  Plus,
  Search,
  ShieldCheck,
  Swords,
  Target,
  Trophy,
  User,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getFriendId, Problem, useDsaRivalsStore, userStats, UserId } from "@/lib/dsa-rivals-store";

export const Route = createFileRoute("/")({
  component: Index,
});

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "log", label: "Log Problem", icon: Plus },
  { id: "problems", label: "My Problems", icon: BookOpenCheck },
  { id: "challenges", label: "Challenges", icon: Target },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "profile", label: "Profile", icon: User },
] as const;

type ViewId = (typeof navItems)[number]["id"];

const platforms = ["LeetCode", "NeetCode", "Codeforces", "HackerRank"];
const difficulties = ["Easy", "Medium", "Hard"] as const;
const topics = ["Arrays", "Graphs", "DP", "Trees", "Heap", "Sliding Window", "Binary Search", "Backtracking"];

function Index() {
  const currentUserId = useDsaRivalsStore((state) => state.currentUserId);
  return currentUserId ? <CompetitionApp currentUserId={currentUserId} /> : <LoginPage />;
}

function LoginPage() {
  const login = useDsaRivalsStore((state) => state.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = login(username, password);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    toast.success("Welcome back to the arena");
  };

  return (
    <main className="rival-spotlight min-h-screen overflow-hidden px-4 py-8 text-foreground sm:px-6 lg:px-10">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-enter">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/70 px-4 py-2 text-sm text-muted-foreground">
            <Swords className="size-4 text-primary" /> Two friends. One streak war.
          </div>
          <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-normal sm:text-7xl">
            AlgoBuilding
            <span className="block text-primary">Competition Tracker</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            A focused competition hub for Alex and Sam to log solved problems, protect streaks, compare progress, and keep daily practice fun.
          </p>
          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            {["Live streaks", "Friend comparison", "Weekly challenges"].map((item) => (
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
            <p className="mt-2 text-sm text-muted-foreground">Login with your demo credentials to see only your personal tracker and your rival comparison.</p>
          </div>
          <label className="mb-2 block text-sm font-semibold" htmlFor="username">Username</label>
          <input id="username" value={username} onChange={(event) => setUsername(event.target.value)} className="mb-4 h-12 w-full rounded-lg border border-input bg-background/70 px-4 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30" placeholder="alex" />
          <label className="mb-2 block text-sm font-semibold" htmlFor="password">Password</label>
          <input id="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="mb-3 h-12 w-full rounded-lg border border-input bg-background/70 px-4 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30" placeholder="123456" />
          {error && <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button className="h-12 w-full" variant="rival" type="submit">Login <Zap /></Button>
          <div className="mt-5 rounded-lg bg-muted/70 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Demo Users</p>
            <p>alex / 123456 · sam / 123456</p>
          </div>
        </form>
      </section>
    </main>
  );
}

function CompetitionApp({ currentUserId }: { currentUserId: UserId }) {
  const users = useDsaRivalsStore((state) => state.users);
  const problems = useDsaRivalsStore((state) => state.problems);
  const logout = useDsaRivalsStore((state) => state.logout);
  const [view, setView] = useState<ViewId>("dashboard");
  const user = users.find((item) => item.id === currentUserId)!;
  const friend = users.find((item) => item.id === getFriendId(currentUserId))!;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      toast(`${friend.name} just solved a problem ${friend.emoji}`, { description: "Your rival is keeping the heat on." });
    }, 3800);
    return () => window.clearTimeout(timer);
  }, [friend.name, friend.emoji]);

  return (
    <div className="app-shell-bg min-h-screen text-foreground lg:flex">
      <aside className="glass-panel sticky top-0 z-20 border-x-0 border-t-0 px-4 py-4 lg:h-screen lg:w-72 lg:border-y-0 lg:border-l-0">
        <div className="flex items-center justify-between lg:block">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground shadow-glow"><Swords /></div>
            <div><p className="font-black">AlgoBuilding</p><p className="text-xs text-muted-foreground">Competition Tracker</p></div>
          </div>
          <Button className="lg:hidden" variant="ghost" size="icon" onClick={logout}><LogOut /></Button>
        </div>
        <nav className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setView(item.id)} className={`flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:bg-secondary ${view === item.id ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground"}`}>
                <Icon className="size-4" /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-6 hidden rounded-xl border border-border bg-card/80 p-4 lg:block">
          <p className="text-sm text-muted-foreground">Logged in as</p>
          <p className="mt-1 text-lg font-bold">{user.emoji} {user.name}</p>
          <p className="text-xs text-primary">{user.title}</p>
          <Button className="mt-4 w-full" variant="secondary" onClick={logout}><LogOut /> Logout</Button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        <Header user={user} friend={friend} />
        {view === "dashboard" && <Dashboard currentUserId={currentUserId} />}
        {view === "leaderboard" && <Leaderboard />}
        {view === "log" && <LogProblem />}
        {view === "problems" && <MyProblems currentUserId={currentUserId} />}
        {view === "challenges" && <Challenges />}
        {view === "analytics" && <Analytics currentUserId={currentUserId} />}
        {view === "profile" && <Profile currentUserId={currentUserId} />}
      </main>
    </div>
  );
}

function Header({ user, friend }: { user: { name: string; emoji: string }; friend: { name: string; emoji: string } }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <header className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card/70 p-5 shadow-card sm:flex-row sm:items-center">
      <div>
        <p className="text-sm font-semibold text-primary">Rival: {friend.name} {friend.emoji}</p>
        <h2 className="text-3xl font-black">{greeting}, {user.name}! {user.emoji}</h2>
      </div>
      <div className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground"><Flame className="mr-2 inline size-4 text-accent" /> Healthy pressure, daily progress.</div>
    </header>
  );
}

function Dashboard({ currentUserId }: { currentUserId: UserId }) {
  const problems = useDsaRivalsStore((state) => state.problems);
  const users = useDsaRivalsStore((state) => state.users);
  const mine = userStats(problems, currentUserId);
  const friendId = getFriendId(currentUserId);
  const rival = userStats(problems, friendId);
  const user = users.find((item) => item.id === currentUserId)!;
  const friend = users.find((item) => item.id === friendId)!;
  const recent = [...problems].sort((a, b) => +new Date(b.solvedAt) - +new Date(a.solvedAt)).slice(0, 6);

  return <section className="animate-enter space-y-6">
    <div className="grid gap-4 md:grid-cols-4">{([
      { label: "Total Solved", value: mine.total, Icon: Trophy },
      { label: "Today", value: mine.today, Icon: Zap },
      { label: "Current Streak", value: `${mine.streak} days`, Icon: Flame },
      { label: "Weekly Progress", value: mine.week, Icon: Activity },
    ] satisfies Array<{ label: string; value: React.ReactNode; Icon: LucideIcon }>).map((item) => <StatCard key={item.label} {...item} />)}</div>
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="glass-panel rounded-2xl p-5"><h3 className="mb-4 text-xl font-bold">Friend Comparison</h3><div className="grid gap-4 sm:grid-cols-2"><RivalCard user={user} stats={mine} highlight /><RivalCard user={friend} stats={rival} /></div></div>
      <QuickLog />
    </div>
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]"><RecentActivity problems={recent} users={users} /><Heatmap currentUserId={currentUserId} /></div>
  </section>;
}

function StatCard({ label, value, Icon }: { label: string; value: React.ReactNode; Icon: LucideIcon }) {
  return <div className="card-gradient rounded-2xl border border-border p-5 shadow-card transition hover:-translate-y-1"><Icon className="mb-4 size-5 text-primary" /><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>;
}

function RivalCard({ user, stats, highlight }: { user: { name: string; emoji: string; title: string }; stats: ReturnType<typeof userStats>; highlight?: boolean }) {
  return <div className={`rounded-xl border p-5 ${highlight ? "border-primary bg-primary/10" : "border-border bg-card/70"}`}><div className="text-3xl">{user.emoji}</div><h4 className="mt-2 text-xl font-black">{user.name}</h4><p className="text-sm text-muted-foreground">{user.title}</p><div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><span>{stats.total}<small className="block text-muted-foreground">total</small></span><span>{stats.week}<small className="block text-muted-foreground">week</small></span><span>{stats.streak}<small className="block text-muted-foreground">streak</small></span></div></div>;
}

function QuickLog() {
  return <div className="glass-panel rounded-2xl p-5"><h3 className="mb-4 text-xl font-bold">Quick Log Solved Problem</h3><LogProblem compact /></div>;
}

function LogProblem({ compact = false }: { compact?: boolean }) {
  const addProblem = useDsaRivalsStore((state) => state.addProblem);
  const [form, setForm] = useState({ name: "", link: "", platform: "LeetCode", difficulty: "Medium", topic: "Arrays", timeTaken: "25", notes: "" });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.name.trim()) return; addProblem({ ...form, difficulty: form.difficulty as Problem["difficulty"], timeTaken: Number(form.timeTaken) || 0 }); toast.success("Problem logged. Streak protected!"); setForm({ ...form, name: "", link: "", notes: "" }); };
  return <form onSubmit={submit} className={`grid gap-3 ${compact ? "" : "glass-panel animate-enter rounded-2xl p-5 md:grid-cols-2"}`}><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Problem name or link" /><input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Problem URL" /><Select value={form.platform} options={platforms} onChange={(value) => setForm({ ...form, platform: value })} /><Select value={form.difficulty} options={[...difficulties]} onChange={(value) => setForm({ ...form, difficulty: value })} /><Select value={form.topic} options={topics} onChange={(value) => setForm({ ...form, topic: value })} /><input value={form.timeTaken} onChange={(e) => setForm({ ...form, timeTaken: e.target.value })} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Time taken (min)" /><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-24 rounded-lg border border-input bg-background/70 px-3 py-3 outline-none focus:ring-2 focus:ring-primary/30 md:col-span-2" placeholder="Notes" /><Button variant="rival" className="md:col-span-2"><Plus /> Log Solved Problem</Button></form>;
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30">{options.map((option) => <option key={option}>{option}</option>)}</select>;
}

function RecentActivity({ problems, users }: { problems: Problem[]; users: { id: string; name: string; emoji: string }[] }) {
  return <div className="glass-panel rounded-2xl p-5"><h3 className="mb-4 text-xl font-bold">Recent Activity</h3><div className="space-y-3">{problems.map((problem) => { const user = users.find((item) => item.id === problem.userId)!; return <div key={problem.id} className="flex items-center justify-between rounded-lg bg-secondary/60 p-3"><div><p className="font-semibold">{user.emoji} {problem.name}</p><p className="text-xs text-muted-foreground">{problem.platform} · {problem.topic} · {problem.difficulty}</p></div><span className="text-xs text-muted-foreground">{new Date(problem.solvedAt).toLocaleDateString()}</span></div>; })}</div></div>;
}

function Heatmap({ currentUserId }: { currentUserId: UserId }) {
  const problems = useDsaRivalsStore((state) => state.problems).filter((problem) => problem.userId === currentUserId);
  const cells = Array.from({ length: 49 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (48 - index)); const count = problems.filter((problem) => new Date(problem.solvedAt).toDateString() === date.toDateString()).length; return count; });
  return <div className="glass-panel rounded-2xl p-5"><h3 className="mb-4 text-xl font-bold">Contribution Heatmap</h3><div className="grid grid-cols-7 gap-2">{cells.map((count, index) => <div key={index} title={`${count} solved`} className={`aspect-square rounded ${count === 0 ? "bg-muted" : count === 1 ? "bg-heat-1" : count === 2 ? "bg-heat-2" : count === 3 ? "bg-heat-3" : "bg-heat-4"}`} />)}</div></div>;
}

function Leaderboard() {
  const { users, problems } = useDsaRivalsStore();
  const ranked = [...users].sort((a, b) => userStats(problems, b.id).total - userStats(problems, a.id).total);
  return <section className="glass-panel animate-enter rounded-2xl p-5"><h3 className="mb-5 text-2xl font-black">Leaderboard</h3>{ranked.map((user, index) => <div key={user.id} className="mb-3 flex items-center justify-between rounded-xl bg-card/80 p-4"><div className="flex items-center gap-4"><span className="text-2xl">{index === 0 ? "🥇" : "🥈"}</span><div><p className="text-lg font-bold">{user.emoji} {user.name}</p><p className="text-sm text-muted-foreground">{user.title}</p></div></div><div className="text-right"><p className="text-2xl font-black">{userStats(problems, user.id).total}</p><p className="text-xs text-muted-foreground">total solved</p></div></div>)}</section>;
}

function MyProblems({ currentUserId }: { currentUserId: UserId }) {
  const problems = useDsaRivalsStore((state) => state.problems).filter((problem) => problem.userId === currentUserId);
  const [filter, setFilter] = useState("");
  const filtered = problems.filter((problem) => `${problem.platform} ${problem.difficulty} ${problem.topic} ${problem.name}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="glass-panel animate-enter rounded-2xl p-5"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row"><h3 className="text-2xl font-black">My Problems</h3><label className="flex items-center gap-2 rounded-lg border border-input bg-background/70 px-3"><Search className="size-4 text-muted-foreground" /><input value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 bg-transparent outline-none" placeholder="Filter platform, topic..." /></label></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-muted-foreground"><tr><th className="py-3">Problem</th><th>Platform</th><th>Difficulty</th><th>Topic</th><th>Time</th><th>Date</th></tr></thead><tbody>{filtered.map((problem) => <tr key={problem.id} className="border-t border-border"><td className="py-3 font-semibold">{problem.name}</td><td>{problem.platform}</td><td>{problem.difficulty}</td><td>{problem.topic}</td><td>{problem.timeTaken}m</td><td>{new Date(problem.solvedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div></section>;
}

function Challenges() {
  const { challenges, users, problems } = useDsaRivalsStore();
  return <section className="animate-enter grid gap-4 lg:grid-cols-3">{challenges.map((challenge) => <div key={challenge.id} className="glass-panel rounded-2xl p-5"><Target className="mb-4 size-6 text-accent" /><h3 className="text-xl font-black">{challenge.title}</h3><p className="mb-4 text-sm text-muted-foreground">{challenge.topic} · Reward {challenge.reward}</p>{users.map((user) => { const count = problems.filter((problem) => problem.userId === user.id && (problem.topic === challenge.topic || problem.difficulty === challenge.topic)).length; return <div key={user.id} className="mb-3"><div className="mb-1 flex justify-between text-sm"><span>{user.emoji} {user.name}</span><span>{count}/{challenge.target}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, (count / challenge.target) * 100)}%` }} /></div></div>; })}</div>)}</section>;
}

function Analytics({ currentUserId }: { currentUserId: UserId }) {
  const problems = useDsaRivalsStore((state) => state.problems);
  const mine = problems.filter((problem) => problem.userId === currentUserId);
  const friend = problems.filter((problem) => problem.userId === getFriendId(currentUserId));
  const byTopic = useMemo(() => topics.slice(0, 6).map((topic) => ({ topic, mine: mine.filter((p) => p.topic === topic).length, friend: friend.filter((p) => p.topic === topic).length })), [mine, friend]);
  return <section className="glass-panel animate-enter rounded-2xl p-5"><h3 className="mb-5 text-2xl font-black">Analytics</h3><div className="space-y-4">{byTopic.map((row) => <div key={row.topic} className="grid items-center gap-3 sm:grid-cols-[140px_1fr_48px]"><span className="font-semibold">{row.topic}</span><div className="space-y-2"><div className="h-3 rounded-full bg-muted"><div className="h-3 rounded-full bg-primary" style={{ width: `${Math.min(100, row.mine * 18)}%` }} /></div><div className="h-3 rounded-full bg-muted"><div className="h-3 rounded-full bg-accent" style={{ width: `${Math.min(100, row.friend * 18)}%` }} /></div></div><span className="text-sm text-muted-foreground">{row.mine}/{row.friend}</span></div>)}</div><p className="mt-5 text-sm text-muted-foreground"><span className="text-primary">Green</span> is you, <span className="text-accent">orange</span> is your friend.</p></section>;
}

function Profile({ currentUserId }: { currentUserId: UserId }) {
  const { users, problems } = useDsaRivalsStore();
  const user = users.find((item) => item.id === currentUserId)!;
  const stats = userStats(problems, currentUserId);
  return <section className="glass-panel animate-enter rounded-2xl p-6"><div className="text-7xl">{user.emoji}</div><h3 className="mt-4 text-3xl font-black">{user.name}</h3><p className="text-primary">{user.title}</p><div className="mt-6 grid gap-4 sm:grid-cols-4"><StatCard label="Solved" value={stats.total} Icon={Medal} /><StatCard label="This Week" value={stats.week} Icon={ListFilter} /><StatCard label="Hard Wins" value={stats.hard} Icon={Swords} /><StatCard label="Minutes" value={stats.minutes} Icon={Activity} /></div></section>;
}