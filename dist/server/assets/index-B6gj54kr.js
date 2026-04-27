import { r as reactExports, j as jsxRuntimeExports } from "./react-core-iclSsBan.js";
import { g as twMerge, h as clsx, j as cva, k as toast } from "./vendor-CJMdJXvN.js";
import { S as Slot } from "./radix-Cp-It47m.js";
import { c as createClient } from "./supabase-C6_Pzch3.js";
import { L as LoaderCircle, S as Swords, a as ShieldCheck, F as Flame, Z as Zap, U as UserPlus, b as LogOut, c as LayoutDashboard, T as Trophy, P as Plus, B as BookOpenCheck, d as Target, C as ChartColumn, e as User, A as Activity, f as Search, E as ExternalLink, M as Medal, g as ListFilter } from "./lucide-vV39RTsi.js";
import "node:events";
import "./react-dom-EHc2Jb4T.js";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        rival: "bg-primary text-primary-foreground shadow-glow hover:bg-primary/90 hover:shadow-card active:scale-[0.98]",
        ember: "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 active:scale-[0.98]"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
const Button = reactExports.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Comp, { className: cn(buttonVariants({ variant, size, className })), ref, ...props });
  }
);
Button.displayName = "Button";
function createSupabaseClient() {
  const SUPABASE_URL = "https://metqzcvrunllgbfrnxyy.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fcdNohmbppdl8S4UDZd2Vg_ODd9szFP";
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : void 0,
      persistSession: true,
      autoRefreshToken: true
    }
  });
}
let _supabase;
const supabase = new Proxy({}, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  }
});
const platforms = ["LeetCode", "NeetCode", "Codeforces", "HackerRank", "Custom..."];
const difficulties = ["Easy", "Medium", "Hard"];
const topics = ["Arrays", "Graphs", "DP", "Trees", "Heap", "Sliding Window", "Binary Search", "Backtracking", "Custom..."];
function mapProblem(problem) {
  return {
    id: problem.id,
    accountId: problem.account_id,
    name: problem.name,
    link: problem.link,
    platform: problem.platform,
    difficulty: problem.difficulty,
    topic: problem.topic,
    timeTaken: problem.time_taken,
    notes: problem.notes,
    solvedAt: problem.solved_at
  };
}
function mapUser(profile) {
  return {
    id: profile.account_id,
    name: profile.display_name,
    emoji: profile.emoji,
    title: profile.title,
    username: profile.username,
    rivalUserId: profile.rival_user_id
  };
}
function userStats(problems, accountId) {
  const mine = problems.filter((problem) => problem.accountId === accountId);
  const now = /* @__PURE__ */ new Date();
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
    minutes: mine.reduce((sum, problem) => sum + problem.timeTaken, 0)
  };
}
function getFriendId(currentAccountId, users) {
  const current = users.find((user) => user.id === currentAccountId);
  return current?.rivalUserId || users.find((user) => user.id !== currentAccountId)?.id || currentAccountId;
}
async function loadAppData() {
  const [profilesResult, problemsResult, challengesResult] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("problems").select("*").order("solved_at", { ascending: false }),
    supabase.from("challenges").select("*").order("id", { ascending: true })
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (problemsResult.error) throw problemsResult.error;
  if (challengesResult.error) throw challengesResult.error;
  return {
    profiles: profilesResult.data ?? [],
    problems: (problemsResult.data ?? []).map(mapProblem),
    challenges: challengesResult.data ?? []
  };
}
const navItems = [{
  id: "dashboard",
  label: "Dashboard",
  icon: LayoutDashboard
}, {
  id: "leaderboard",
  label: "Leaderboard",
  icon: Trophy
}, {
  id: "log",
  label: "Log Problem",
  icon: Plus
}, {
  id: "problems",
  label: "My Problems",
  icon: BookOpenCheck
}, {
  id: "friend-problems",
  label: "Friend Solved",
  icon: Swords
}, {
  id: "challenges",
  label: "Challenges",
  icon: Target
}, {
  id: "analytics",
  label: "Analytics",
  icon: ChartColumn
}, {
  id: "profile",
  label: "Profile",
  icon: User
}];
function Index() {
  const [currentAccountId, setCurrentAccountId] = reactExports.useState(localStorage.getItem("rivals_account_id"));
  const [loading, setLoading] = reactExports.useState(true);
  const [data, setData] = reactExports.useState({
    profiles: [],
    problems: [],
    challenges: []
  });
  const refresh = async () => {
    try {
      setData(await loadAppData());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load app data");
    }
  };
  reactExports.useEffect(() => {
    setLoading(false);
    if (currentAccountId) refresh();
  }, [currentAccountId]);
  reactExports.useEffect(() => {
    if (!currentAccountId) return;
    const channel = supabase.channel("rivals-live").on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "profiles"
    }, () => refresh()).on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "problems"
    }, () => refresh()).on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "challenges"
    }, () => refresh()).on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "accounts"
    }, () => refresh()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentAccountId]);
  if (loading) return /* @__PURE__ */ jsxRuntimeExports.jsx(LoadingScreen, {});
  if (!currentAccountId) return /* @__PURE__ */ jsxRuntimeExports.jsx(LoginPage, { onLogin: (id) => setCurrentAccountId(id) });
  const currentProfile = data.profiles.find((profile) => profile.account_id === currentAccountId);
  if (!currentProfile) return /* @__PURE__ */ jsxRuntimeExports.jsx(ProfileSetup, { accountId: currentAccountId, onCreated: refresh });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(CompetitionApp, { currentAccountId, data, onRefresh: refresh, onLogout: () => setCurrentAccountId(null) });
}
function LoadingScreen() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("main", { className: "app-shell-bg flex min-h-screen items-center justify-center text-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-panel rounded-2xl p-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "mx-auto mb-3 size-6 animate-spin text-primary" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Loading AlgoBuilding..." })
  ] }) });
}
function LoginPage({
  onLogin
}) {
  const [username, setUsername] = reactExports.useState("");
  const [password, setPassword] = reactExports.useState("");
  const [busy, setBusy] = reactExports.useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter both username and password");
      return;
    }
    setBusy(true);
    const uname = username.trim().toLowerCase();
    const {
      data: account,
      error: findError
    } = await supabase.from("accounts").select("*").eq("username", uname).maybeSingle();
    if (findError) {
      toast.error(findError.message);
      setBusy(false);
      return;
    }
    if (account) {
      const acc = account;
      if (acc.password === password) {
        localStorage.setItem("rivals_account_id", acc.id);
        onLogin(acc.id);
        toast.success("Welcome back!");
      } else {
        toast.error("Invalid password for this username");
      }
    } else {
      const {
        data: newAccount,
        error: createError
      } = await supabase.from("accounts").insert({
        username: uname,
        password
      }).select().single();
      if (createError) {
        toast.error(createError.message);
      } else {
        const nAcc = newAccount;
        localStorage.setItem("rivals_account_id", nAcc.id);
        onLogin(nAcc.id);
        toast.success("Account created! Welcome to the arena.");
      }
    }
    setBusy(false);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("main", { className: "rival-spotlight min-h-screen overflow-hidden px-4 py-8 text-foreground sm:px-6 lg:px-10", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "animate-enter", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/70 px-4 py-2 text-sm text-muted-foreground", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Swords, { className: "size-4 text-primary" }),
        " Two friends. One streak war."
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "max-w-3xl text-5xl font-black leading-tight tracking-normal sm:text-7xl", children: [
        "AlgoBuilding",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "block text-primary", children: "Competition Tracker" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-6 max-w-2xl text-lg leading-8 text-muted-foreground", children: "A live competition hub where friends log solved problems, compare progress, and push each other with shared challenges." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-8 grid max-w-2xl gap-3 sm:grid-cols-3", children: ["No Email Needed", "Simple Username", "Live rivalry"].map((item) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-lg border border-border bg-card/70 p-4 text-sm font-semibold shadow-card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldCheck, { className: "mb-3 size-5 text-primary" }),
        " ",
        item
      ] }, item)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: submit, className: "glass-panel animate-enter rounded-2xl p-6 sm:p-8", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-8", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl text-primary-foreground shadow-glow", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Flame, {}) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-2xl font-bold", children: "Enter the arena" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "Enter a username and password. New here? Your account will be created automatically." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "mb-2 block text-sm font-semibold", htmlFor: "username", children: "Username" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "username", value: username, onChange: (event) => setUsername(event.target.value), className: "h-12 w-full rounded-lg border border-input bg-background/70 px-4 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30", placeholder: "Pick a username", type: "text", required: true })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "mb-2 block text-sm font-semibold", htmlFor: "password", children: "Password" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "password", value: password, onChange: (event) => setPassword(event.target.value), type: "password", className: "h-12 w-full rounded-lg border border-input bg-background/70 px-4 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30", placeholder: "Any password works", required: true })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { className: "mt-2 h-12 w-full", variant: "rival", type: "submit", disabled: busy, children: [
          busy ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "animate-spin" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Zap, {}),
          " Enter Arena"
        ] })
      ] })
    ] })
  ] }) });
}
function ProfileSetup({
  accountId,
  onCreated
}) {
  const [form, setForm] = reactExports.useState({
    username: "",
    displayName: "",
    emoji: "🚀",
    title: "Algo Builder"
  });
  const [busy, setBusy] = reactExports.useState(false);
  reactExports.useEffect(() => {
    supabase.from("accounts").select("username").eq("id", accountId).single().then(({
      data
    }) => {
      if (data) setForm((f) => ({
        ...f,
        username: data.username,
        displayName: data.username
      }));
    });
  }, [accountId]);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    const {
      error
    } = await supabase.from("profiles").insert({
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
  return /* @__PURE__ */ jsxRuntimeExports.jsx("main", { className: "app-shell-bg flex min-h-screen items-center justify-center px-4 text-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: submit, className: "glass-panel w-full max-w-lg rounded-2xl p-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(UserPlus, { className: "mb-4 size-8 text-primary" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-3xl font-black", children: "Set up your profile" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "This is what your friend will see on the leaderboard." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 grid gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { required: true, value: form.username, onChange: (e) => setForm({
        ...form,
        username: e.target.value
      }), className: "h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30", placeholder: "Username" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { required: true, value: form.displayName, onChange: (e) => setForm({
        ...form,
        displayName: e.target.value
      }), className: "h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30", placeholder: "Display name" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { required: true, value: form.emoji, onChange: (e) => setForm({
        ...form,
        emoji: e.target.value
      }), className: "h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30", placeholder: "Emoji" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { required: true, value: form.title, onChange: (e) => setForm({
        ...form,
        title: e.target.value
      }), className: "h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30", placeholder: "Title" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "rival", disabled: busy, children: [
        busy ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "animate-spin" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(UserPlus, {}),
        " Save profile"
      ] })
    ] })
  ] }) });
}
function CompetitionApp({
  currentAccountId,
  data,
  onRefresh,
  onLogout
}) {
  const [view, setView] = reactExports.useState("dashboard");
  const users = data.profiles.map(mapUser);
  const user = users.find((item) => item.id === currentAccountId);
  const friendId = getFriendId(currentAccountId, users);
  const friend = users.find((item) => item.id === friendId) ?? user;
  const logout = () => {
    localStorage.removeItem("rivals_account_id");
    onLogout();
    toast.success("Logged out");
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app-shell-bg min-h-screen text-foreground lg:flex", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("aside", { className: "glass-panel sticky top-0 z-20 border-x-0 border-t-0 px-4 py-4 lg:h-screen lg:w-72 lg:border-y-0 lg:border-l-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between lg:block", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex size-11 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground shadow-glow", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Swords, {}) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-black", children: "AlgoBuilding" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Competition Tracker" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { className: "lg:hidden", variant: "ghost", size: "icon", onClick: logout, children: /* @__PURE__ */ jsxRuntimeExports.jsx(LogOut, {}) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("nav", { className: "mt-6 flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0", children: navItems.map((item) => {
        const Icon = item.icon;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { onClick: () => setView(item.id), className: `flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:bg-secondary ${view === item.id ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground"}`, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "size-4" }),
          " ",
          item.label
        ] }, item.id);
      }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 hidden rounded-xl border border-border bg-card/80 p-4 lg:block", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Logged in as" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1 text-lg font-bold", children: [
          user.emoji,
          " ",
          user.name
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-primary", children: user.title }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { className: "mt-4 w-full", variant: "secondary", onClick: logout, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LogOut, {}),
          " Logout"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("main", { className: "mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Header, { user, friend }),
      view === "dashboard" && /* @__PURE__ */ jsxRuntimeExports.jsx(Dashboard, { currentAccountId, data, users }),
      view === "leaderboard" && /* @__PURE__ */ jsxRuntimeExports.jsx(Leaderboard, { users, problems: data.problems }),
      view === "log" && /* @__PURE__ */ jsxRuntimeExports.jsx(LogProblem, { currentAccountId, data, onRefresh }),
      view === "problems" && /* @__PURE__ */ jsxRuntimeExports.jsx(MyProblems, { currentAccountId, problems: data.problems }),
      view === "friend-problems" && /* @__PURE__ */ jsxRuntimeExports.jsx(FriendProblems, { currentAccountId, users, problems: data.problems }),
      view === "challenges" && /* @__PURE__ */ jsxRuntimeExports.jsx(Challenges, { challenges: data.challenges, users, problems: data.problems }),
      view === "analytics" && /* @__PURE__ */ jsxRuntimeExports.jsx(Analytics, { currentAccountId, users, problems: data.problems }),
      view === "profile" && /* @__PURE__ */ jsxRuntimeExports.jsx(Profile, { currentAccountId, profiles: data.profiles, users, problems: data.problems, onRefresh })
    ] })
  ] });
}
function Header({
  user,
  friend
}) {
  const hour = (/* @__PURE__ */ new Date()).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card/70 p-5 shadow-card sm:flex-row sm:items-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm font-semibold text-primary", children: [
        "Rival: ",
        friend.name,
        " ",
        friend.emoji
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "text-3xl font-black", children: [
        greeting,
        ", ",
        user.name,
        "! ",
        user.emoji
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Flame, { className: "mr-2 inline size-4 text-accent" }),
      " Live shared progress."
    ] })
  ] });
}
function Dashboard({
  currentAccountId,
  data,
  users
}) {
  const mine = userStats(data.problems, currentAccountId);
  const friendId = getFriendId(currentAccountId, users);
  const rival = userStats(data.problems, friendId);
  const user = users.find((item) => item.id === currentAccountId);
  const friend = users.find((item) => item.id === friendId) ?? user;
  const recent = [...data.problems].sort((a, b) => +new Date(b.solvedAt) - +new Date(a.solvedAt)).slice(0, 6);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "animate-enter space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-4 md:grid-cols-4", children: [{
      label: "Total Solved",
      value: mine.total,
      Icon: Trophy
    }, {
      label: "Today",
      value: mine.today,
      Icon: Zap
    }, {
      label: "Current Streak",
      value: `${mine.streak} days`,
      Icon: Flame
    }, {
      label: "Weekly Progress",
      value: mine.week,
      Icon: Activity
    }].map((item) => /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { ...item }, item.label)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-6 lg:grid-cols-[1fr_0.9fr]", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-panel rounded-2xl p-5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mb-4 text-xl font-bold", children: "Friend Comparison" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(RivalCard, { user, stats: mine, highlight: true }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(RivalCard, { user: friend, stats: rival })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-panel rounded-2xl p-5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mb-4 text-xl font-bold", children: "Quick Log Solved Problem" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(LogProblem, { currentAccountId, data, compact: true })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-6 lg:grid-cols-[1fr_0.9fr]", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(RecentActivity, { problems: recent, users }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Heatmap, { currentAccountId, problems: data.problems })
    ] })
  ] });
}
function StatCard({
  label,
  value,
  Icon
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card-gradient rounded-2xl border border-border p-5 shadow-card transition hover:-translate-y-1", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "mb-4 size-5 text-primary" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-3xl font-black", children: value })
  ] });
}
function RivalCard({
  user,
  stats,
  highlight
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `rounded-xl border p-5 ${highlight ? "border-primary bg-primary/10" : "border-border bg-card/70"}`, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-3xl", children: user.emoji }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "mt-2 text-xl font-black", children: user.name }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: user.title }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-4 grid grid-cols-3 gap-2 text-center text-sm", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        stats.total,
        /* @__PURE__ */ jsxRuntimeExports.jsx("small", { className: "block text-muted-foreground", children: "total" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        stats.week,
        /* @__PURE__ */ jsxRuntimeExports.jsx("small", { className: "block text-muted-foreground", children: "week" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        stats.streak,
        /* @__PURE__ */ jsxRuntimeExports.jsx("small", { className: "block text-muted-foreground", children: "streak" })
      ] })
    ] })
  ] });
}
function LogProblem({
  currentAccountId,
  data,
  compact = false,
  onRefresh
}) {
  const [form, setForm] = reactExports.useState({
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
  const dynamicOptions = reactExports.useMemo(() => {
    if (!data) return {
      platforms,
      topics
    };
    const existingPlatforms = Array.from(new Set(data.problems.map((p) => p.platform)));
    const existingTopics = Array.from(new Set(data.problems.map((p) => p.topic)));
    const finalPlatforms = Array.from(/* @__PURE__ */ new Set([...platforms.filter((p) => p !== "Custom..."), ...existingPlatforms])).sort();
    const finalTopics = Array.from(/* @__PURE__ */ new Set([...topics.filter((t) => t !== "Custom..."), ...existingTopics])).sort();
    return {
      platforms: [...finalPlatforms, "Custom..."],
      topics: [...finalTopics, "Custom..."]
    };
  }, [data]);
  const submit = async (event) => {
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
    const {
      error
    } = await supabase.from("problems").insert({
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
    setForm({
      ...form,
      name: "",
      link: "",
      notes: "",
      customPlatform: "",
      customTopic: ""
    });
    await onRefresh?.();
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: submit, className: `grid gap-3 ${compact ? "" : "glass-panel animate-enter rounded-2xl p-5 md:grid-cols-2"}`, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { required: true, value: form.name, onChange: (e) => setForm({
      ...form,
      name: e.target.value
    }), className: "h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30", placeholder: "Problem name" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: form.link, onChange: (e) => setForm({
      ...form,
      link: e.target.value
    }), className: "h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30", placeholder: "Problem URL" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Select, { value: form.platform, options: dynamicOptions.platforms, onChange: (value) => setForm({
        ...form,
        platform: value
      }) }),
      form.platform === "Custom..." && /* @__PURE__ */ jsxRuntimeExports.jsx("input", { required: true, value: form.customPlatform, onChange: (e) => setForm({
        ...form,
        customPlatform: e.target.value
      }), className: "h-11 w-full rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30 animate-in slide-in-from-top-1", placeholder: "Enter platform name" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Select, { value: form.topic, options: dynamicOptions.topics, onChange: (value) => setForm({
        ...form,
        topic: value
      }) }),
      form.topic === "Custom..." && /* @__PURE__ */ jsxRuntimeExports.jsx("input", { required: true, value: form.customTopic, onChange: (e) => setForm({
        ...form,
        customTopic: e.target.value
      }), className: "h-11 w-full rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30 animate-in slide-in-from-top-1", placeholder: "Enter topic name" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Select, { value: form.difficulty, options: [...difficulties], onChange: (value) => setForm({
      ...form,
      difficulty: value
    }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: form.timeTaken, onChange: (e) => setForm({
      ...form,
      timeTaken: e.target.value
    }), className: "h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30", placeholder: "Time taken (min)" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { value: form.notes, onChange: (e) => setForm({
      ...form,
      notes: e.target.value
    }), className: "min-h-24 rounded-lg border border-input bg-background/70 px-3 py-3 outline-none focus:ring-2 focus:ring-primary/30 md:col-span-2", placeholder: "Notes" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "rival", className: "md:col-span-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Plus, {}),
      " Log Solved Problem"
    ] })
  ] });
}
function Select({
  value,
  options,
  onChange
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("select", { value, onChange: (event) => onChange(event.target.value), className: "h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30", children: options.map((option) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: option }, option)) });
}
function RecentActivity({
  problems,
  users
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-panel rounded-2xl p-5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mb-4 text-xl font-bold", children: "Recent Activity" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", children: problems.map((problem) => {
      const user = users.find((item) => item.id === problem.accountId);
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between rounded-lg bg-secondary/60 p-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "font-semibold", children: [
            user?.emoji ?? "🚀",
            " ",
            problem.name
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground", children: [
            problem.platform,
            " · ",
            problem.topic,
            " · ",
            problem.difficulty
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: new Date(problem.solvedAt).toLocaleDateString() })
      ] }, problem.id);
    }) })
  ] });
}
function Heatmap({
  currentAccountId,
  problems
}) {
  const mine = problems.filter((problem) => problem.accountId === currentAccountId);
  const cells = Array.from({
    length: 49
  }, (_, index) => {
    const date = /* @__PURE__ */ new Date();
    date.setDate(date.getDate() - (48 - index));
    return mine.filter((problem) => new Date(problem.solvedAt).toDateString() === date.toDateString()).length;
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-panel rounded-2xl p-5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mb-4 text-xl font-bold", children: "Contribution Heatmap" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-7 gap-2", children: cells.map((count, index) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { title: `${count} solved`, className: `aspect-square rounded ${count === 0 ? "bg-muted" : count === 1 ? "bg-heat-1" : count === 2 ? "bg-heat-2" : count === 3 ? "bg-heat-3" : "bg-heat-4"}` }, index)) })
  ] });
}
function Leaderboard({
  users,
  problems
}) {
  const ranked = [...users].sort((a, b) => userStats(problems, b.id).total - userStats(problems, a.id).total);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "glass-panel animate-enter rounded-2xl p-5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mb-5 text-2xl font-black", children: "Leaderboard" }),
    ranked.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "No builders yet." }),
    ranked.map((user, index) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-3 flex items-center justify-between rounded-xl bg-card/80 p-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-2xl", children: index === 0 ? "🥇" : index === 1 ? "🥈" : "🏅" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-lg font-bold", children: [
            user.emoji,
            " ",
            user.name
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-muted-foreground", children: [
            "@",
            user.username
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-right", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-2xl font-black", children: userStats(problems, user.id).total }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "total solved" })
      ] })
    ] }, user.id))
  ] });
}
function MyProblems({
  currentAccountId,
  problems
}) {
  const mine = problems.filter((problem) => problem.accountId === currentAccountId);
  const [filter, setFilter] = reactExports.useState("");
  const filtered = mine.filter((problem) => `${problem.platform} ${problem.difficulty} ${problem.topic} ${problem.name}`.toLowerCase().includes(filter.toLowerCase()));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "glass-panel animate-enter rounded-2xl p-5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-4 flex flex-col justify-between gap-3 sm:flex-row", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-2xl font-black", children: "My Problems" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "flex items-center gap-2 rounded-lg border border-input bg-background/70 px-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Search, { className: "size-4 text-muted-foreground" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: filter, onChange: (e) => setFilter(e.target.value), className: "h-10 bg-transparent outline-none", placeholder: "Filter platform, topic..." })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ProblemTable, { problems: filtered })
  ] });
}
function FriendProblems({
  currentAccountId,
  users,
  problems
}) {
  const friendId = getFriendId(currentAccountId, users);
  const friend = users.find((item) => item.id === friendId) ?? users.find((item) => item.id === currentAccountId);
  const solvedByMe = new Set(problems.filter((problem) => problem.accountId === currentAccountId).map((problem) => problem.name.toLowerCase()));
  const friendProblems = problems.filter((problem) => problem.accountId === friendId);
  const [filter, setFilter] = reactExports.useState("");
  const filtered = friendProblems.filter((problem) => `${problem.platform} ${problem.difficulty} ${problem.topic} ${problem.name}`.toLowerCase().includes(filter.toLowerCase()));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "glass-panel animate-enter rounded-2xl p-5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-4 flex flex-col justify-between gap-3 sm:flex-row", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { className: "text-2xl font-black", children: [
          friend.name,
          "'s Solved Problems"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "See what your friend solved and choose your next target." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "flex items-center gap-2 rounded-lg border border-input bg-background/70 px-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Search, { className: "size-4 text-muted-foreground" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: filter, onChange: (e) => setFilter(e.target.value), className: "h-10 bg-transparent outline-none", placeholder: "Filter friend problems..." })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-3", children: [
      filtered.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "No friend problems yet. Invite your friend to sign up and log problems." }),
      filtered.map((problem) => {
        const alreadySolved = solvedByMe.has(problem.name.toLowerCase());
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-border bg-card/80 p-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col justify-between gap-3 sm:flex-row sm:items-center", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-lg font-bold", children: problem.name }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1 text-sm text-muted-foreground", children: [
                problem.platform,
                " · ",
                problem.topic,
                " · ",
                problem.difficulty,
                " · ",
                problem.timeTaken,
                "m"
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `rounded-full px-3 py-1 text-xs font-semibold ${alreadySolved ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`, children: alreadySolved ? "You solved it" : "Try this next" }),
              problem.link && /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: problem.link, target: "_blank", rel: "noreferrer", className: "inline-flex size-9 items-center justify-center rounded-md border border-border bg-secondary text-foreground transition hover:bg-accent hover:text-accent-foreground", "aria-label": `Open ${problem.name}`, children: /* @__PURE__ */ jsxRuntimeExports.jsx(ExternalLink, { className: "size-4" }) })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-3 text-xs text-muted-foreground", children: [
            "Solved on ",
            new Date(problem.solvedAt).toLocaleDateString()
          ] })
        ] }, problem.id);
      })
    ] })
  ] });
}
function ProblemTable({
  problems
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full min-w-[720px] text-left text-sm", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { className: "text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "py-3", children: "Problem" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Platform" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Difficulty" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Topic" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Time" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Date" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: problems.map((problem) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-t border-border", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-3 font-semibold", children: problem.link ? /* @__PURE__ */ jsxRuntimeExports.jsx("a", { className: "transition hover:text-primary", href: problem.link, target: "_blank", rel: "noreferrer", children: problem.name }) : problem.name }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: problem.platform }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: problem.difficulty }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: problem.topic }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
        problem.timeTaken,
        "m"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: new Date(problem.solvedAt).toLocaleDateString() })
    ] }, problem.id)) })
  ] }) });
}
function Challenges({
  challenges,
  users,
  problems
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("section", { className: "animate-enter grid gap-4 lg:grid-cols-3", children: challenges.map((challenge) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-panel rounded-2xl p-5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Target, { className: "mb-4 size-6 text-accent" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-xl font-black", children: challenge.title }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-4 text-sm text-muted-foreground", children: [
      challenge.topic,
      " · Reward ",
      challenge.reward
    ] }),
    users.map((user) => {
      const count = problems.filter((problem) => problem.id === user.id && (problem.topic === challenge.topic || challenge.topic === "Easy" && problem.difficulty === "Easy")).length;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-1 flex justify-between text-sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            user.emoji,
            " ",
            user.name
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            count,
            "/",
            challenge.target
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-2 rounded-full bg-muted", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-2 rounded-full bg-primary", style: {
          width: `${Math.min(100, count / challenge.target * 100)}%`
        } }) })
      ] }, user.id);
    })
  ] }, challenge.id)) });
}
function Analytics({
  currentAccountId,
  users,
  problems
}) {
  const friendId = getFriendId(currentAccountId, users);
  const mine = problems.filter((problem) => problem.accountId === currentAccountId);
  const friend = problems.filter((problem) => problem.accountId === friendId);
  const byTopic = reactExports.useMemo(() => topics.slice(0, 6).map((topic) => ({
    topic,
    mine: mine.filter((p) => p.topic === topic).length,
    friend: friend.filter((p) => p.topic === topic).length
  })), [mine, friend]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "glass-panel animate-enter rounded-2xl p-5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mb-5 text-2xl font-black", children: "Analytics" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-4", children: byTopic.map((row) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid items-center gap-3 sm:grid-cols-[140px_1fr_48px]", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold", children: row.topic }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-3 rounded-full bg-muted", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-3 rounded-full bg-primary", style: {
          width: `${Math.min(100, row.mine * 18)}%`
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-3 rounded-full bg-muted", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-3 rounded-full bg-accent", style: {
          width: `${Math.min(100, row.friend * 18)}%`
        } }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-sm text-muted-foreground", children: [
        row.mine,
        "/",
        row.friend
      ] })
    ] }, row.topic)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-5 text-sm text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-primary", children: "Primary" }),
      " is you, ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-accent", children: "accent" }),
      " is your friend."
    ] })
  ] });
}
function Profile({
  currentAccountId,
  profiles,
  users,
  problems,
  onRefresh
}) {
  const profile = profiles.find((item) => item.account_id === currentAccountId);
  const user = mapUser(profile);
  const stats = userStats(problems, currentAccountId);
  const [rivalUsername, setRivalUsername] = reactExports.useState(users.find((item) => item.id === profile.rival_user_id)?.username ?? "");
  const saveRival = async () => {
    const rival = users.find((item) => item.username.toLowerCase() === rivalUsername.trim().toLowerCase());
    if (!rival || rival.id === currentAccountId) {
      toast.error("Enter a valid friend's username");
      return;
    }
    const {
      error
    } = await supabase.from("profiles").update({
      rival_user_id: rival.id
    }).eq("account_id", currentAccountId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rival updated");
    await onRefresh();
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "glass-panel animate-enter rounded-2xl p-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-7xl", children: user.emoji }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mt-4 text-3xl font-black", children: user.name }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-primary", children: [
      "@",
      user.username,
      " · ",
      user.title
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 grid gap-4 sm:grid-cols-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { label: "Solved", value: stats.total, Icon: Medal }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { label: "This Week", value: stats.week, Icon: ListFilter }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { label: "Hard Wins", value: stats.hard, Icon: Swords }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { label: "Minutes", value: stats.minutes, Icon: Activity })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 rounded-xl border border-border bg-card/70 p-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "font-bold", children: "Choose your friend" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Enter your friend's username to compare directly." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 flex flex-col gap-2 sm:flex-row", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: rivalUsername, onChange: (e) => setRivalUsername(e.target.value), className: "h-11 flex-1 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30", placeholder: "friend_username" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { type: "button", variant: "rival", onClick: saveRival, children: "Save Rival" })
      ] })
    ] })
  ] });
}
export {
  Index as component
};
