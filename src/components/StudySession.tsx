"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coffee,
  Flame,
  Pause,
  Play,
  Plus,
  Radio,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  Users2,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FocusClock } from "@/components/Focus";
import { supabase } from "@/integrations/supabase/client";
import {
  appendFocusSession,
  fmtDuration,
  focusTaskKey,
  focusTasksKey,
  loadFocusSessions,
  loadFocusSettings,
  loadFocusTasks,
  notifyFocus,
  playFocusChime,
  relativeTime,
  syncFocusSessionsFromCloud,
  type FocusMode,
  type FocusSession,
  type FocusSettings,
} from "@/lib/focus";
import type { MutualUser } from "@/types/rivals";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimerState {
  mode: FocusMode;
  remaining: number;
  task: string;
  running: boolean;
  pomos: number;
  sessionLabel: string;
}

interface RoomPresence {
  accountId: string;
  name: string;
  emoji: string;
  timer: TimerState;
  online_at: string;
}

interface PersistedTimerState {
  mode: FocusMode;
  accumSec: number;
  pomos: number;
  task: string;
  runStartMs: number | null;
  sessionStartMs: number | null;
}

interface PeriodStats {
  focusSec: number;
  sessions: number;
  completed: number;
}

interface Analytics {
  today: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
  streak: number;
  topTask: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STUDY_TIMER_KEY = (id: string) => `sync_study_timer_${id}`;
const FRIEND_PREF_KEY = (id: string) => `sync_study_friend_${id}`;
const PRESENCE_THROTTLE_MS = 2000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadPersisted(accountId: string): PersistedTimerState {
  if (typeof window === "undefined")
    return { mode: "focus", accumSec: 0, pomos: 0, task: "", runStartMs: null, sessionStartMs: null };
  try {
    const raw = localStorage.getItem(STUDY_TIMER_KEY(accountId));
    if (raw) return JSON.parse(raw) as PersistedTimerState;
  } catch {}
  return { mode: "focus", accumSec: 0, pomos: 0, task: "", runStartMs: null, sessionStartMs: null };
}

function buildAnalytics(sessions: FocusSession[]): Analytics {
  const focus = sessions.filter((s) => s.type === "focus");
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(todayStart); monthStart.setDate(monthStart.getDate() - 29);

  const statsFor = (from: Date): PeriodStats => {
    const rel = focus.filter((s) => new Date(s.startedAt) >= from);
    return {
      focusSec: rel.reduce((a, s) => a + s.durationSec, 0),
      sessions: rel.length,
      completed: rel.filter((s) => s.completed).length,
    };
  };

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const dayMap = new Map<string, number>();
  for (const s of focus) {
    const d = new Date(s.startedAt);
    dayMap.set(dayKey(d), (dayMap.get(dayKey(d)) ?? 0) + s.durationSec);
  }
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(todayStart); d.setDate(d.getDate() - i);
    if ((dayMap.get(dayKey(d)) ?? 0) > 0) streak++;
    else break;
  }

  const taskMap = new Map<string, number>();
  for (const s of focus) {
    if (!s.task || new Date(s.startedAt) < monthStart) continue;
    const k = s.task.trim();
    taskMap.set(k, (taskMap.get(k) ?? 0) + s.durationSec);
  }
  const topTask = taskMap.size > 0
    ? Array.from(taskMap.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  return { today: statsFor(todayStart), week: statsFor(weekStart), month: statsFor(monthStart), streak, topTask };
}

function mapRemoteSession(r: Record<string, unknown>): FocusSession {
  return {
    id: String(r.id),
    type: r.type as "focus" | "break",
    startedAt: String(r.started_at),
    durationSec: Number(r.duration_sec) || 0,
    completed: !!r.completed,
    task: (r.task as string | null) ?? undefined,
    plannedSec: r.planned_sec != null ? Number(r.planned_sec) : undefined,
    isLongBreak: r.is_long_break ? true : undefined,
  };
}

function sessionModeLabel(mode: FocusMode, pomosCompleted: number): string {
  if (mode === "longBreak") return "Long Break 🌴";
  if (mode === "break") return "Short Break ☕";
  return `Focus #${pomosCompleted + 1} 🎯`;
}

function sessionIcon(s: FocusSession) {
  if (s.type === "break") return s.isLongBreak ? "🌴" : "☕";
  return s.completed ? "✅" : "⏸️";
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StudySession({
  currentAccountId,
  currentUser,
  friends,
  pendingInvite,
  onClearPendingInvite,
}: {
  currentAccountId: string;
  currentUser: MutualUser;
  friends: MutualUser[];
  pendingInvite?: { roomId: string; fromId: string; fromName: string } | null;
  onClearPendingInvite?: () => void;
}) {
  // ── Friend selection (persisted) ──────────────────────────────────────────
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(FRIEND_PREF_KEY(currentAccountId));
      if (saved && friends.some((f) => f.id === saved)) return saved;
    }
    return friends[0]?.id ?? null;
  });

  const friend = useMemo(
    () => friends.find((f) => f.id === selectedFriendId) ?? friends[0] ?? null,
    [friends, selectedFriendId]
  );

  const selectFriend = (id: string) => {
    setSelectedFriendId(id);
    if (typeof window !== "undefined") localStorage.setItem(FRIEND_PREF_KEY(currentAccountId), id);
  };

  // Presence channel — stable, derived from sorted user ID pair
  const presenceChannelName = useMemo(() => {
    if (!friend) return `sync_study_solo_${currentAccountId}`;
    return `sync_study_${[currentAccountId, friend.id].sort().join("_")}`;
  }, [currentAccountId, friend]);

  // ── Timer state — initialised from localStorage ────────────────────────────
  const [settings] = useState<FocusSettings>(() => loadFocusSettings(currentAccountId));
  const persisted = useRef(loadPersisted(currentAccountId));

  const [mode, setMode] = useState<FocusMode>(() => persisted.current.mode);
  const [pomos, setPomos] = useState<number>(() => persisted.current.pomos);
  const [accumSec, setAccumSec] = useState<number>(() => persisted.current.accumSec);
  const [task, setTask] = useState<string>(() => {
    const p = persisted.current;
    if (p.task) return p.task;
    if (typeof window !== "undefined") return localStorage.getItem(focusTaskKey(currentAccountId)) ?? "";
    return "";
  });
  const [tasks, setTasks] = useState<string[]>(() => loadFocusTasks(currentAccountId));
  const [newTaskInput, setNewTaskInput] = useState("");
  const [running, setRunning] = useState<boolean>(() => persisted.current.runStartMs !== null);
  const [now, setNow] = useState(() => Date.now());

  const runStartRef = useRef<number | null>(persisted.current.runStartMs);
  const sessionStartRef = useRef<number | null>(persisted.current.sessionStartMs);
  const completedRef = useRef(false);
  const lastPresencePushRef = useRef(0);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Derived timer values ───────────────────────────────────────────────────
  const planned = (
    mode === "focus" ? settings.focusMin
    : mode === "longBreak" ? settings.longBreakMin
    : settings.breakMin
  ) * 60;
  const segmentSec = running && runStartRef.current !== null
    ? Math.max(0, Math.floor((now - runStartRef.current) / 1000))
    : 0;
  const elapsed = accumSec + segmentSec;
  const remaining = Math.max(0, planned - elapsed);
  const pct = planned > 0 ? Math.min(100, (elapsed / planned) * 100) : 0;
  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const sessionInProgress = sessionStartRef.current !== null;
  const sessionLabel = sessionModeLabel(mode, pomos);

  // ── Persist timer to localStorage ─────────────────────────────────────────
  // Called directly in start/pause/stop for immediate sync, and via useEffect for background changes
  const saveToStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    const state: PersistedTimerState = {
      mode,
      accumSec,
      pomos,
      task,
      runStartMs: runStartRef.current,
      sessionStartMs: sessionStartRef.current,
    };
    localStorage.setItem(STUDY_TIMER_KEY(currentAccountId), JSON.stringify(state));
  }, [mode, accumSec, pomos, task, currentAccountId]);

  useEffect(() => { saveToStorage(); }, [saveToStorage, running]);

  // Also save on page unload (handles fast SPA tab switches)
  useEffect(() => {
    const onUnload = () => saveToStorage();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [saveToStorage]);

  // ── Tick ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const align = 1000 - (Date.now() % 1000);
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      setNow(Date.now());
      intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    }, align);
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [running]);

  // ── Commit + advance ──────────────────────────────────────────────────────
  const commitAndAdvance = useCallback((commitSec: number, completed: boolean) => {
    const wasFocus = mode === "focus";
    const sessionStartIso = sessionStartRef.current !== null
      ? new Date(sessionStartRef.current).toISOString()
      : new Date().toISOString();
    if (commitSec > 0) {
      appendFocusSession(currentAccountId, {
        type: wasFocus ? "focus" : "break",
        startedAt: sessionStartIso,
        durationSec: commitSec,
        completed,
        plannedSec: planned,
        task: wasFocus ? task.trim() || undefined : undefined,
        isLongBreak: mode === "longBreak" ? true : undefined,
      });
    }
    let nextMode: FocusMode = "focus";
    let nextPomos = pomos;
    if (wasFocus && completed) {
      nextPomos = pomos + 1;
      nextMode = nextPomos >= settings.longBreakEvery ? "longBreak" : "break";
      if (nextMode === "longBreak") nextPomos = 0;
    }
    return { nextMode, nextPomos };
  }, [mode, pomos, settings, planned, task, currentAccountId]);

  // ── Auto-complete ─────────────────────────────────────────────────────────
  const refreshMyAnalytics = useCallback(() => {
    setMyAnalytics(buildAnalytics(loadFocusSessions(currentAccountId)));
  }, [currentAccountId]);

  useEffect(() => {
    if (!running || completedRef.current || elapsed < planned) return;
    completedRef.current = true;
    const wasFocus = mode === "focus";
    const { nextMode, nextPomos } = commitAndAdvance(planned, true);
    if (settings.soundEnabled) playFocusChime();
    if (settings.notificationsEnabled)
      notifyFocus(wasFocus ? "Focus complete" : "Break over", wasFocus ? "Take a break!" : "Back to focus.");
    toast.success(wasFocus ? `${sessionLabel} done! 🎉` : "Break over — back to it 🚀");
    runStartRef.current = null;
    sessionStartRef.current = null;
    setAccumSec(0); setMode(nextMode); setPomos(nextPomos); setRunning(false);
    completedRef.current = false;
    localStorage.removeItem(STUDY_TIMER_KEY(currentAccountId));
    setTimeout(refreshMyAnalytics, 200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, planned, running]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const start = () => {
    const t = Date.now();
    if (sessionStartRef.current === null) sessionStartRef.current = t;
    runStartRef.current = t;
    completedRef.current = false;
    setRunning(true);
    // Save immediately so a fast refresh sees the running state
    if (typeof window !== "undefined") {
      localStorage.setItem(STUDY_TIMER_KEY(currentAccountId), JSON.stringify({
        mode, accumSec, pomos, task,
        runStartMs: t,
        sessionStartMs: sessionStartRef.current,
      } as PersistedTimerState));
    }
  };

  const pause = () => {
    let seg = 0;
    if (running && runStartRef.current !== null) {
      seg = Math.max(0, Math.floor((Date.now() - runStartRef.current) / 1000));
      setAccumSec((s) => s + seg);
      runStartRef.current = null;
    }
    setRunning(false);
    // Save immediately with updated accumSec
    if (typeof window !== "undefined") {
      localStorage.setItem(STUDY_TIMER_KEY(currentAccountId), JSON.stringify({
        mode, accumSec: accumSec + seg, pomos, task,
        runStartMs: null,
        sessionStartMs: sessionStartRef.current,
      } as PersistedTimerState));
    }
  };

  const stop = () => {
    let seg = 0;
    if (running && runStartRef.current !== null)
      seg = Math.max(0, Math.floor((Date.now() - runStartRef.current) / 1000));
    const finalElapsed = accumSec + seg;
    if (finalElapsed > 0 && sessionStartRef.current !== null) {
      commitAndAdvance(finalElapsed, false);
      toast.success(`Logged ${fmtDuration(finalElapsed)}`);
    }
    runStartRef.current = null;
    sessionStartRef.current = null;
    setAccumSec(0); setRunning(false);
    completedRef.current = false;
    localStorage.removeItem(STUDY_TIMER_KEY(currentAccountId));
    setTimeout(refreshMyAnalytics, 200);
  };

  const switchMode = (m: FocusMode) => {
    if (sessionInProgress && !window.confirm("Switch mode? Current session will be discarded.")) return;
    runStartRef.current = null;
    sessionStartRef.current = null;
    setAccumSec(0); setRunning(false);
    completedRef.current = false;
    setMode(m);
  };

  // ── Task management ───────────────────────────────────────────────────────
  const addTask = () => {
    const name = newTaskInput.trim();
    if (!name || tasks.some((t) => t.toLowerCase() === name.toLowerCase())) return;
    const next = [...tasks, name];
    setTasks(next);
    localStorage.setItem(focusTasksKey(currentAccountId), JSON.stringify(next));
    setNewTaskInput("");
    if (!task.trim()) { setTask(name); localStorage.setItem(focusTaskKey(currentAccountId), name); }
  };

  const removeTask = (name: string) => {
    const next = tasks.filter((t) => t !== name);
    setTasks(next);
    localStorage.setItem(focusTasksKey(currentAccountId), JSON.stringify(next));
    if (task === name) { setTask(""); localStorage.removeItem(focusTaskKey(currentAccountId)); }
  };

  const switchTask = (name: string) => {
    setTask(name);
    localStorage.setItem(focusTaskKey(currentAccountId), name);
  };

  // ── Presence ──────────────────────────────────────────────────────────────
  const [friendPresence, setFriendPresence] = useState<RoomPresence | null>(null);
  const [membersOnline, setMembersOnline] = useState(0);

  const myTimerForPresence: TimerState = useMemo(() => ({
    mode, remaining, task, running, pomos, sessionLabel,
  }), [mode, remaining, task, running, pomos, sessionLabel]);

  const pushPresence = useCallback(async () => {
    const ch = presenceChannelRef.current;
    if (!ch) return;
    const t = Date.now();
    if (t - lastPresencePushRef.current < PRESENCE_THROTTLE_MS) return;
    lastPresencePushRef.current = t;
    await ch.track({
      accountId: currentAccountId,
      name: currentUser.name,
      emoji: currentUser.emoji,
      timer: myTimerForPresence,
      online_at: new Date().toISOString(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccountId, currentUser.name, currentUser.emoji, myTimerForPresence]);

  useEffect(() => {
    const ch = supabase.channel(presenceChannelName);
    presenceChannelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<RoomPresence>();
      const all = Object.values(state).flat();
      setMembersOnline(all.length);
      setFriendPresence(all.find((p) => p.accountId === friend?.id) ?? null);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          accountId: currentAccountId,
          name: currentUser.name,
          emoji: currentUser.emoji,
          timer: myTimerForPresence,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(ch);
      presenceChannelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceChannelName]);

  // Push timer updates — throttled normally but ALWAYS immediate when running changes
  const pushPresenceRef = useRef(pushPresence);
  pushPresenceRef.current = pushPresence;

  useEffect(() => {
    // Bypass throttle so start/pause are always reflected instantly for the friend
    lastPresencePushRef.current = 0;
    pushPresenceRef.current();
  }, [running]);

  useEffect(() => {
    pushPresence();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, Math.floor(remaining / 5), task, pomos]);

  // ── Nudge pending invite ───────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingInvite) return;
    toast(`📚 ${pendingInvite.fromName} is studying right now!`, {
      description: "They're on the Sync Study tab. Select them and join!",
      duration: 20000,
    });
    onClearPendingInvite?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInvite]);

  const sendNudge = () => {
    if (!friend) return;
    supabase.channel("rivals-live").send({
      type: "broadcast",
      event: "study_invite",
      payload: {
        to: friend.id,
        from: currentAccountId,
        fromName: `${currentUser.emoji} ${currentUser.name}`,
        roomId: presenceChannelName,
      },
    });
    toast.success(`Nudged ${friend.emoji} ${friend.name} to join! 📚`);
  };

  // ── Analytics ─────────────────────────────────────────────────────────────
  const [myAnalytics, setMyAnalytics] = useState<Analytics | null>(null);
  const [friendAnalytics, setFriendAnalytics] = useState<Analytics | null>(null);
  const [friendTodaySessions, setFriendTodaySessions] = useState<FocusSession[]>([]);

  useEffect(() => {
    refreshMyAnalytics();
    syncFocusSessionsFromCloud(currentAccountId).then((sessions) => {
      setMyAnalytics(buildAnalytics(sessions));
    });
  }, [currentAccountId, refreshMyAnalytics]);

  // Reload friend data whenever selected friend changes
  useEffect(() => {
    if (!friend) { setFriendAnalytics(null); setFriendTodaySessions([]); return; }
    setFriendAnalytics(null);
    setFriendTodaySessions([]);

    supabase
      .from("focus_sessions" as any)
      .select("*")
      .eq("account_id", friend.id)
      .then(({ data }) => {
        if (!data) return;
        const sessions = ((data as unknown) as Record<string, unknown>[]).map(mapRemoteSession);
        setFriendAnalytics(buildAnalytics(sessions));

        // Today's sessions sorted newest first
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const today = sessions
          .filter((s) => new Date(s.startedAt) >= todayStart)
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        setFriendTodaySessions(today);
      });
  }, [friend?.id]);

  // ── Friend timer derived ───────────────────────────────────────────────────
  const friendTimer = friendPresence?.timer ?? null;
  const friendMm = friendTimer ? Math.floor(friendTimer.remaining / 60).toString().padStart(2, "0") : "--";
  const friendSs = friendTimer ? (friendTimer.remaining % 60).toString().padStart(2, "0") : "--";
  const friendPlanned = (
    friendTimer?.mode === "focus" ? settings.focusMin
    : friendTimer?.mode === "longBreak" ? settings.longBreakMin
    : settings.breakMin
  ) * 60;
  const friendPct = friendTimer
    ? Math.min(100, ((friendPlanned - friendTimer.remaining) / friendPlanned) * 100)
    : 0;

  return (
    <section className="animate-enter space-y-5">

      {/* ── Friend picker ─────────────────────────────────────────────────── */}
      <FriendPicker
        friends={friends}
        selectedId={selectedFriendId}
        friendPresence={friendPresence}
        onSelect={selectFriend}
      />

      {/* ── Live banner — shows when friend is actively running ─────────── */}
      {friendPresence && friendTimer?.running && (
        <div className="relative overflow-hidden rounded-2xl border border-green-500/40 bg-green-500/10 p-4 shadow-[0_0_32px_rgba(34,197,94,0.15)]">
          {/* animated pulse ring */}
          <div className="absolute right-4 top-4 flex size-3 items-center justify-center">
            <span className="absolute inline-flex size-3 animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-green-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-green-500/20 text-lg">
              {friend?.emoji}
            </div>
            <div>
              <p className="font-black text-green-400">
                {friend?.name} is in a study session right now
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{friendTimer.sessionLabel}</span>
                {friendTimer.task && (
                  <> · working on <span className="font-semibold text-primary">{friendTimer.task}</span></>
                )}
                {" · "}{friendMm}:{friendSs} remaining
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Friend is online but timer is idle/paused */}
      {friendPresence && !friendTimer?.running && (
        <div className="rounded-2xl border border-border bg-card/50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wifi className="size-3.5 text-yellow-400" />
            <span className="font-semibold text-foreground">{friend?.name}</span> is on Sync Study but timer is paused
            {friendTimer?.sessionLabel && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">
                {friendTimer.sessionLabel}
              </span>
            )}
            <button
              type="button"
              onClick={sendNudge}
              className="ml-auto flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition"
            >
              <Bell className="size-3" /> Nudge
            </button>
          </p>
        </div>
      )}

      {/* Not in presence: nudge to join */}
      {friend && !friendPresence && (
        <div className="rounded-2xl border border-dashed border-border px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <WifiOff className="size-3.5" />
            {friend.emoji} {friend.name} isn't on Sync Study yet
            <button
              type="button"
              onClick={sendNudge}
              className="ml-auto flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-xs font-bold hover:bg-border transition"
            >
              <Bell className="size-3" /> Nudge
            </button>
          </p>
        </div>
      )}

      {/* ── Dual timers ──────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* My timer */}
        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-2xl">{currentUser.emoji}</span>
            <div>
              <p className="font-black">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground">Your timer</p>
            </div>
            <div
              className={`ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${
                running ? "bg-primary/15 text-primary"
                : sessionInProgress ? "bg-yellow-500/15 text-yellow-400"
                : "bg-secondary text-muted-foreground"
              }`}
            >
              <span className={`size-1.5 rounded-full ${running ? "animate-pulse bg-primary" : sessionInProgress ? "bg-yellow-400" : "bg-muted-foreground/40"}`} />
              {running ? sessionLabel : sessionInProgress ? "PAUSED" : "IDLE"}
            </div>
          </div>

          <div className="mb-4 flex gap-1.5">
            {(["focus", "break", "longBreak"] as FocusMode[]).map((m) => (
              <button key={m} type="button" onClick={() => switchMode(m)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${mode === m ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                {m === "focus" ? "🎯 Focus" : m === "break" ? "☕ Break" : "🌴 Long"}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center py-2">
            <FocusClock pct={pct} mm={mm} ss={ss} mode={mode} running={running} />
            <div className="mt-3 flex items-center gap-1.5">
              {Array.from({ length: settings.longBreakEvery }).map((_, i) => (
                <span key={i} className={`size-2 rounded-full transition ${i < pomos ? "bg-primary" : "bg-secondary"}`} />
              ))}
              <span className="ml-1 text-[10px] text-muted-foreground">{pomos}/{settings.longBreakEvery} pomodoros</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {!running ? (
                <Button variant="rival" size="sm" onClick={start}>
                  <Play className="size-4" /> {sessionInProgress ? "Resume" : "Start"}
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={pause}>
                  <Pause className="size-4" /> Pause
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={stop} disabled={!sessionInProgress && elapsed === 0}>
                <CheckCircle2 className="size-4" /> Stop & Log
              </Button>
            </div>
          </div>

          {mode === "focus" && (
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Working on</p>
              {tasks.map((t) => (
                <div key={t}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition ${task === t ? "border-primary bg-primary/10" : "border-border bg-card/50 hover:border-primary/40"}`}>
                  <button type="button" onClick={() => switchTask(t)} className="flex flex-1 items-center gap-2 text-left">
                    <span className={`size-2 shrink-0 rounded-full ${task === t && running ? "animate-pulse bg-primary" : task === t ? "bg-primary" : "bg-muted-foreground/30"}`} />
                    <span className={`truncate font-semibold ${task === t ? "text-primary" : ""}`}>{t}</span>
                  </button>
                  <button type="button" onClick={() => removeTask(t)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={newTaskInput} onChange={(e) => setNewTaskInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }}
                  placeholder="Add a task..."
                  className="h-9 flex-1 rounded-lg border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                <Button variant="secondary" size="sm" onClick={addTask} disabled={!newTaskInput.trim()}>
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Friend's timer */}
        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-2xl">{friend?.emoji ?? "👤"}</span>
            <div>
              <p className="font-black">{friend?.name ?? "No squad mate"}</p>
              <p className="text-xs text-muted-foreground">Live view · read-only</p>
            </div>
            {friendTimer && (
              <div className={`ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${friendTimer.running ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                <span className={`size-1.5 rounded-full ${friendTimer.running ? "animate-pulse bg-green-400" : "bg-yellow-400"}`} />
                {friendTimer.running ? "RUNNING" : "PAUSED"}
              </div>
            )}
          </div>

          {!friend ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
              <Users2 className="mb-3 size-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Add squad mates from Squad Requests to study together.</p>
            </div>
          ) : !friendPresence ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
              <div className="mb-3 size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">{friend.name} isn't on Sync Study yet.</p>
            </div>
          ) : (
            <>
              {/* Active session status card */}
              <div className={`rounded-xl border p-4 ${
                friendTimer?.running
                  ? "border-green-500/40 bg-green-500/8"
                  : "border-yellow-500/30 bg-yellow-500/8"
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`flex size-2.5 items-center justify-center rounded-full ${
                    friendTimer?.running ? "bg-green-400 animate-pulse" : "bg-yellow-400"
                  }`} />
                  <span className={`text-xs font-black uppercase tracking-wider ${
                    friendTimer?.running ? "text-green-400" : "text-yellow-400"
                  }`}>
                    {friendTimer?.running ? "Running" : "Paused"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {friendTimer?.pomos ?? 0}/{settings.longBreakEvery} pomodoros
                  </span>
                </div>
                <p className="text-2xl font-black">{friendTimer?.sessionLabel ?? "—"}</p>
                {friendTimer?.task && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Target className="size-3.5 text-primary" />
                    <span className="font-semibold text-foreground">{friendTimer.task}</span>
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {friendMm}:{friendSs} remaining
                </p>
              </div>

              {/* Mode pills (read-only) */}
              <div className="mt-4 flex gap-1.5">
                {(["focus", "break", "longBreak"] as FocusMode[]).map((m) => (
                  <div key={m}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                      friendTimer?.mode === m
                        ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                        : "bg-secondary text-muted-foreground opacity-40"
                    }`}>
                    {m === "focus" ? "🎯 Focus" : m === "break" ? "☕ Break" : "🌴 Long"}
                  </div>
                ))}
              </div>

              {/* Pomodoro dots */}
              <div className="mt-4 flex items-center gap-1.5">
                {Array.from({ length: settings.longBreakEvery }).map((_, i) => (
                  <span key={i} className={`size-2.5 rounded-full transition ${
                    i < (friendTimer?.pomos ?? 0) ? "bg-primary" : "bg-secondary"
                  }`} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Friend's session log ─────────────────────────────────────────── */}
      {friend && (
        <FriendSessionLog
          friend={friend}
          friendTimer={friendTimer}
          todaySessions={friendTodaySessions}
        />
      )}

      {/* ── Comparison metrics ───────────────────────────────────────────── */}
      <CompareMetrics
        me={currentUser}
        myData={myAnalytics}
        friend={friend}
        friendData={friendAnalytics}
      />
    </section>
  );
}

// ─── Friend Picker ────────────────────────────────────────────────────────────

function FriendPicker({
  friends,
  selectedId,
  friendPresence,
  onSelect,
}: {
  friends: MutualUser[];
  selectedId: string | null;
  friendPresence: RoomPresence | null;
  onSelect: (id: string) => void;
}) {
  if (friends.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <Users2 className="size-5 text-primary" />
          <div>
            <h3 className="text-xl font-black">Sync Study</h3>
            <p className="text-sm text-muted-foreground">Add squad mates from Squad Requests to study together.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users2 className="size-5 text-primary" />
          <h3 className="text-xl font-black">Sync Study</h3>
        </div>
        <p className="text-xs text-muted-foreground">{friends.length} squad mate{friends.length !== 1 ? "s" : ""}</p>
      </div>

      <div className={`grid gap-3 ${friends.length === 1 ? "grid-cols-1" : "sm:grid-cols-2"}`}>
        {friends.map((f) => {
          const isSelected = f.id === selectedId;
          const isOnline = friendPresence?.accountId === f.id;
          const isSyncing = isSelected && isOnline;

          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelect(f.id)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition hover:-translate-y-0.5 ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-glow"
                  : "border-border bg-card/50 hover:border-primary/40"
              }`}
            >
              <div className="relative">
                <span className="text-2xl">{f.emoji}</span>
                {isOnline && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-2.5 items-center justify-center rounded-full border border-background bg-green-400">
                    <span className="animate-ping absolute size-2 rounded-full bg-green-400 opacity-75" />
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-black truncate ${isSelected ? "text-primary" : ""}`}>{f.name}</p>
                <p className="text-xs text-muted-foreground truncate">{f.title}</p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                {isSyncing ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[9px] font-black text-green-400">
                    <Radio className="size-2.5" /> SYNCING
                  </span>
                ) : isOnline ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[9px] font-black text-green-400">
                    ONLINE
                  </span>
                ) : isSelected ? (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-black text-primary">
                    SELECTED
                  </span>
                ) : null}
                {!isSelected && (
                  <span className="text-[10px] text-muted-foreground">Tap to sync</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Friend Session Log ───────────────────────────────────────────────────────

function FriendSessionLog({
  friend,
  friendTimer,
  todaySessions,
}: {
  friend: MutualUser;
  friendTimer: TimerState | null;
  todaySessions: FocusSession[];
}) {
  const [expanded, setExpanded] = useState(true);

  const totalTodayFocus = todaySessions
    .filter((s) => s.type === "focus")
    .reduce((a, s) => a + s.durationSec, 0);

  return (
    <div className="glass-panel rounded-2xl">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-2">
          <Timer className="size-5 text-primary" />
          <h4 className="text-lg font-black">{friend.emoji} {friend.name}'s Session Log</h4>
          {totalTodayFocus > 0 && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black text-primary">
              {fmtDuration(totalTodayFocus)} today
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          {/* Live current session from presence */}
          {friendTimer && (
            <div className={`mb-3 flex items-center gap-3 rounded-xl border px-4 py-3 ${
              friendTimer.running
                ? "border-green-500/40 bg-green-500/10"
                : "border-yellow-500/30 bg-yellow-500/8"
            }`}>
              <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-card/80 text-base">
                {friendTimer.running ? "🔴" : "⏸️"}
                {friendTimer.running && (
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-green-400 animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-black ${friendTimer.running ? "text-green-400" : "text-yellow-400"}`}>
                  {friendTimer.running ? "LIVE NOW" : "PAUSED"} · {friendTimer.sessionLabel}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {friendTimer.task
                    ? <><Target className="inline size-3 mr-0.5" />{friendTimer.task} · </>
                    : ""}
                  {Math.floor(friendTimer.remaining / 60)}m {friendTimer.remaining % 60}s remaining
                </p>
              </div>
            </div>
          )}

          {/* DB sessions from today */}
          {todaySessions.length === 0 && !friendTimer ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No sessions logged today yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {todaySessions.map((s, i) => {
                const label =
                  s.type === "break"
                    ? s.isLongBreak ? "Long Break 🌴" : "Short Break ☕"
                    : s.completed
                      ? `Focus · ${s.task || "No task"}`
                      : `Focus (stopped) · ${s.task || "No task"}`;

                return (
                  <div
                    key={s.id ?? i}
                    className="flex items-center justify-between rounded-lg bg-card/60 px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-base">{sessionIcon(s)}</span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{label}</p>
                        <p className="text-[10px] text-muted-foreground">{relativeTime(s.startedAt)}</p>
                      </div>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="font-mono text-xs font-bold tabular-nums text-muted-foreground">
                        {fmtDuration(s.durationSec)}
                      </p>
                      {s.type === "focus" && s.completed && (
                        <p className="text-[9px] font-bold text-primary">DONE</p>
                      )}
                      {s.type === "focus" && !s.completed && (
                        <p className="text-[9px] font-bold text-muted-foreground">PARTIAL</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Comparison Metrics ───────────────────────────────────────────────────────

function CompareMetrics({
  me,
  myData,
  friend,
  friendData,
}: {
  me: MutualUser;
  myData: Analytics | null;
  friend: MutualUser | null;
  friendData: Analytics | null;
}) {
  const hasFriend = friend !== null;

  const rows: {
    icon: React.ReactNode;
    label: string;
    myVal: number | null;
    friendVal: number | null;
    fmt: (v: number) => string;
  }[] = [
    { icon: <Zap className="size-3.5 text-primary" />, label: "Today", myVal: myData?.today.focusSec ?? null, friendVal: friendData?.today.focusSec ?? null, fmt: fmtDuration },
    { icon: <Activity className="size-3.5 text-primary" />, label: "This Week", myVal: myData?.week.focusSec ?? null, friendVal: friendData?.week.focusSec ?? null, fmt: fmtDuration },
    { icon: <Calendar className="size-3.5 text-primary" />, label: "This Month", myVal: myData?.month.focusSec ?? null, friendVal: friendData?.month.focusSec ?? null, fmt: fmtDuration },
    { icon: <CheckCircle2 className="size-3.5 text-primary" />, label: "Sessions Today", myVal: myData?.today.completed ?? null, friendVal: friendData?.today.completed ?? null, fmt: (v) => String(v) },
    { icon: <CheckCircle2 className="size-3.5 text-primary" />, label: "Sessions This Week", myVal: myData?.week.completed ?? null, friendVal: friendData?.week.completed ?? null, fmt: (v) => String(v) },
    { icon: <Flame className="size-3.5 text-primary" />, label: "Day Streak", myVal: myData?.streak ?? null, friendVal: friendData?.streak ?? null, fmt: (v) => `${v}d` },
  ];

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-5 flex items-center gap-2">
        <BarChart3 className="size-5 text-primary" />
        <h4 className="text-xl font-black">Study Comparison</h4>
        <span className="ml-auto text-xs text-muted-foreground">Focus time only</span>
      </div>

      <div className="mb-3 grid gap-3" style={{ gridTemplateColumns: hasFriend ? "1fr 1fr 1fr" : "1fr 1fr" }}>
        <div />
        <div className="flex items-center gap-2">
          <span className="text-lg">{me.emoji}</span>
          <div>
            <p className="text-sm font-black">{me.name}</p>
            <p className="text-[10px] text-muted-foreground">You</p>
          </div>
        </div>
        {hasFriend && friend && (
          <div className="flex items-center gap-2">
            <span className="text-lg">{friend.emoji}</span>
            <div>
              <p className="text-sm font-black">{friend.name}</p>
              <p className="text-[10px] text-muted-foreground">{friendData ? "synced" : "loading..."}</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const mv = row.myVal;
          const fv = row.friendVal;
          const myWins = hasFriend && mv !== null && fv !== null && mv > fv;
          const friendWins = hasFriend && mv !== null && fv !== null && fv > mv;

          return (
            <div
              key={row.label}
              className="grid items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-2.5"
              style={{ gridTemplateColumns: hasFriend ? "1fr 1fr 1fr" : "1fr 1fr" }}
            >
              <div className="flex items-center gap-1.5">
                {row.icon}
                <span className="text-xs font-semibold text-muted-foreground">{row.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`font-mono text-sm font-black tabular-nums ${myWins ? "text-primary" : mv === null ? "text-muted-foreground" : ""}`}>
                  {mv !== null ? row.fmt(mv) : "—"}
                </span>
                {myWins && <TrendingUp className="size-3.5 text-primary" />}
              </div>
              {hasFriend && (
                <div className="flex items-center gap-1.5">
                  {friendData === null ? (
                    <span className="text-xs text-muted-foreground">Loading...</span>
                  ) : (
                    <>
                      <span className={`font-mono text-sm font-black tabular-nums ${friendWins ? "text-accent" : fv === null ? "text-muted-foreground" : ""}`}>
                        {fv !== null ? row.fmt(fv) : "—"}
                      </span>
                      {friendWins && <TrendingUp className="size-3.5 text-accent" />}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
