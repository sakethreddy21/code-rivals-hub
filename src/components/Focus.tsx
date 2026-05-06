"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Coffee,
  Flame,
  Medal,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Target,
  Timer,
  Trash2,
  Trophy,
  Zap,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { StatCard } from "@/components/atoms";
import {
  appendFocusSession,
  fmtDuration,
  focusSessionsKey,
  focusSettingsKey,
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
  type FocusSettings,
} from "@/lib/focus";

export function FocusClock({ pct, mm, ss, mode, running }: { pct: number; mm: string; ss: string; mode: FocusMode; running: boolean }) {
  const ringR = 132;
  const ringC = 2 * Math.PI * ringR;
  const clamped = Math.max(0, Math.min(100, pct));
  const ringDash = ringC * (clamped / 100);

  const isFocus = mode === "focus";
  const accent = isFocus ? "oklch(0.74 0.18 151.1)" : "oklch(0.75 0.17 58.5)";
  const accentGlow = isFocus ? "oklch(0.74 0.18 151.1 / 0.4)" : "oklch(0.75 0.17 58.5 / 0.4)";

  return (
    <div className="relative size-64 sm:size-72">
      <svg viewBox="0 0 300 300" className="size-full">
        <circle cx="150" cy="150" r="140" fill="oklch(0.13 0.02 188)" stroke="oklch(0.22 0.02 188)" strokeWidth="1" />

        <circle cx="150" cy="150" r={ringR} fill="none" stroke="oklch(0.20 0.02 188)" strokeWidth="3" />
        <circle
          cx="150"
          cy="150"
          r={ringR}
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${ringDash} ${ringC}`}
          transform="rotate(-90 150 150)"
          style={{ filter: `drop-shadow(0 0 6px ${accentGlow})`, transition: "stroke-dasharray 0.4s linear" }}
        />

        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * 30 - 90) * (Math.PI / 180);
          const x1 = 150 + Math.cos(a) * 120;
          const y1 = 150 + Math.sin(a) * 120;
          const x2 = 150 + Math.cos(a) * 114;
          const y2 = 150 + Math.sin(a) * 114;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="oklch(0.35 0.02 188)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-mono text-5xl font-black tabular-nums sm:text-6xl ${running ? "" : "opacity-60"}`}
          style={{ color: accent, textShadow: `0 0 16px ${accentGlow}` }}
        >
          {mm}:{ss}
        </span>
        <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
          {mode === "focus" ? "Focus" : mode === "longBreak" ? "Long Break" : "Break"}
        </span>
      </div>
    </div>
  );
}

export function FocusTodo({ currentAccountId }: { currentAccountId: string }) {
  const [settings, setSettings] = useState<FocusSettings>(() => loadFocusSettings(currentAccountId));
  const [task, setTask] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(focusTaskKey(currentAccountId)) ?? "";
  });
  const [mode, setMode] = useState<FocusMode>("focus");
  const [pomos, setPomos] = useState(0);
  const [running, setRunning] = useState(false);
  const [accumSec, setAccumSec] = useState(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const [todayFocusSec, setTodayFocusSec] = useState(0);
  const [todayCompletedCount, setTodayCompletedCount] = useState(0);
  const [todaySecByTask, setTodaySecByTask] = useState<Record<string, number>>({});
  const [tasks, setTasks] = useState<string[]>(() => {
    const stored = loadFocusTasks(currentAccountId);
    const current = typeof window !== "undefined" ? (localStorage.getItem(focusTaskKey(currentAccountId)) ?? "").trim() : "";
    if (current && !stored.some((t) => t.toLowerCase() === current.toLowerCase())) {
      return [...stored, current];
    }
    return stored;
  });
  const [newTaskInput, setNewTaskInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const runStartRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const titleRef = useRef<string>("");

  useEffect(() => {
    localStorage.setItem(focusSettingsKey(currentAccountId), JSON.stringify(settings));
  }, [settings, currentAccountId]);

  useEffect(() => {
    localStorage.setItem(focusTaskKey(currentAccountId), task);
  }, [task, currentAccountId]);

  useEffect(() => {
    localStorage.setItem(focusTasksKey(currentAccountId), JSON.stringify(tasks));
  }, [tasks, currentAccountId]);

  const refreshTodayTotals = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sessions = loadFocusSessions(currentAccountId);
    const focus = sessions.filter(s => s.type === "focus" && new Date(s.startedAt) >= today);
    setTodayFocusSec(focus.reduce((a, s) => a + s.durationSec, 0));
    setTodayCompletedCount(focus.filter(s => s.completed).length);
    const byTask: Record<string, number> = {};
    for (const s of focus) {
      const k = (s.task ?? "").trim();
      if (!k) continue;
      byTask[k] = (byTask[k] || 0) + s.durationSec;
    }
    setTodaySecByTask(byTask);
  };

  useEffect(() => {
    let cancelled = false;
    refreshTodayTotals();
    if (!currentAccountId) return;
    syncFocusSessionsFromCloud(currentAccountId).then(() => {
      if (!cancelled) refreshTodayTotals();
    });
    return () => { cancelled = true; };
  }, [currentAccountId]);

  useEffect(() => {
    titleRef.current = document.title || "Code Rivals";
    return () => { document.title = titleRef.current; };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  const planned = (mode === "focus" ? settings.focusMin : mode === "longBreak" ? settings.longBreakMin : settings.breakMin) * 60;
  const segmentSec = running && runStartRef.current !== null ? Math.max(0, Math.floor((now - runStartRef.current) / 1000)) : 0;
  const elapsed = accumSec + segmentSec;
  const remaining = Math.max(0, planned - elapsed);
  const pct = planned > 0 ? Math.min(100, (elapsed / planned) * 100) : 0;
  const liveTodayFocusSec = todayFocusSec + (mode === "focus" ? elapsed : 0);
  const goalSec = settings.dailyGoalMin * 60;
  const goalPct = goalSec > 0 ? Math.min(100, (liveTodayFocusSec / goalSec) * 100) : 0;
  const sessionInProgress = sessionStartRef.current !== null;

  useEffect(() => {
    if (!sessionInProgress && !running) {
      document.title = titleRef.current;
      return;
    }
    const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
    const ss = (remaining % 60).toString().padStart(2, "0");
    const icon = mode === "focus" ? "🎯" : mode === "longBreak" ? "🌴" : "☕";
    const label = mode === "focus" ? (task.trim() || "Focus") : mode === "longBreak" ? "Long Break" : "Break";
    document.title = `${running ? "" : "⏸ "}${mm}:${ss} ${icon} ${label.slice(0, 28)}`;
  }, [running, mode, task, remaining, sessionInProgress]);

  const commitAndAdvance = (commitSec: number, completed: boolean): { nextMode: FocusMode; nextPomos: number } => {
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
        task: wasFocus ? (task.trim() || undefined) : undefined,
        isLongBreak: mode === "longBreak" ? true : undefined,
      });
    }

    let nextMode: FocusMode = "focus";
    let nextPomos = pomos;
    if (wasFocus && completed) {
      nextPomos = pomos + 1;
      if (nextPomos >= settings.longBreakEvery) {
        nextMode = "longBreak";
        nextPomos = 0;
      } else {
        nextMode = "break";
      }
    } else if (!wasFocus) {
      nextMode = "focus";
    } else {
      nextMode = "focus";
    }

    refreshTodayTotals();
    return { nextMode, nextPomos };
  };

  useEffect(() => {
    if (!running || completedRef.current) return;
    if (elapsed < planned) return;
    completedRef.current = true;

    const wasFocus = mode === "focus";
    const { nextMode, nextPomos } = commitAndAdvance(planned, true);

    if (settings.soundEnabled) playFocusChime();
    if (settings.notificationsEnabled) {
      notifyFocus(
        wasFocus ? "Focus complete" : "Break over",
        wasFocus
          ? (nextMode === "longBreak" ? "Long break time — you earned it." : "Take a short break.")
          : "Back to focus."
      );
    }
    toast.success(
      wasFocus
        ? (nextMode === "longBreak" ? "Long break time! 🌴" : "Take a quick break ☕")
        : "Break done — let's go 🚀"
    );

    runStartRef.current = null;
    sessionStartRef.current = null;
    setAccumSec(0);
    setMode(nextMode);
    setPomos(nextPomos);

    if (settings.autoStartNext) {
      const t = Date.now();
      sessionStartRef.current = t;
      runStartRef.current = t;
      completedRef.current = false;
    } else {
      setRunning(false);
    }
  }, [elapsed, planned, running]);

  const start = async () => {
    if (settings.notificationsEnabled && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
    const t = Date.now();
    if (sessionStartRef.current === null) sessionStartRef.current = t;
    runStartRef.current = t;
    completedRef.current = false;
    setRunning(true);
  };

  const pause = () => {
    if (running && runStartRef.current !== null) {
      const segment = Math.max(0, Math.floor((Date.now() - runStartRef.current) / 1000));
      setAccumSec(s => s + segment);
      runStartRef.current = null;
    }
    setRunning(false);
  };

  const stop = () => {
    let segment = 0;
    if (running && runStartRef.current !== null) {
      segment = Math.max(0, Math.floor((Date.now() - runStartRef.current) / 1000));
    }
    const finalElapsed = accumSec + segment;

    if (finalElapsed > 60) {
      const minsTxt = `${Math.floor(finalElapsed / 60)}m ${finalElapsed % 60}s`;
      const ok = window.confirm(`Stop and log ${minsTxt} of ${mode === "focus" ? "focus" : "break"} time to today?`);
      if (!ok) return;
    }

    if (finalElapsed > 0 && sessionStartRef.current !== null) {
      commitAndAdvance(finalElapsed, false);
      toast.success(`Logged ${fmtDuration(finalElapsed)} to today's total`);
    }

    runStartRef.current = null;
    sessionStartRef.current = null;
    setAccumSec(0);
    setRunning(false);
    completedRef.current = false;
  };

  const skipBreak = () => {
    let segment = 0;
    if (running && runStartRef.current !== null) {
      segment = Math.max(0, Math.floor((Date.now() - runStartRef.current) / 1000));
    }
    const finalElapsed = accumSec + segment;
    if (finalElapsed > 0 && sessionStartRef.current !== null) {
      commitAndAdvance(finalElapsed, false);
    }
    runStartRef.current = null;
    sessionStartRef.current = null;
    setAccumSec(0);
    setRunning(false);
    setMode("focus");
    completedRef.current = false;
    toast.message("Break skipped — back to focus");
  };

  const switchMode = (next: FocusMode) => {
    if (sessionInProgress) {
      const ok = window.confirm("Switch mode and discard current session progress?");
      if (!ok) return;
    }
    runStartRef.current = null;
    sessionStartRef.current = null;
    setAccumSec(0);
    setRunning(false);
    completedRef.current = false;
    setMode(next);
  };

  const addTask = () => {
    const name = newTaskInput.trim();
    if (!name) return;
    if (tasks.some((t) => t.toLowerCase() === name.toLowerCase())) {
      toast.info("Task already in list");
      return;
    }
    setTasks([...tasks, name]);
    setNewTaskInput("");
    if (!task.trim()) setTask(name);
  };

  const removeTask = (name: string) => {
    setTasks(tasks.filter((t) => t !== name));
    if (task === name) {
      if (mode === "focus" && sessionInProgress) {
        const ok = window.confirm(`"${name}" is the active task. Remove it and discard the in-progress session?`);
        if (!ok) return;
        runStartRef.current = null;
        sessionStartRef.current = null;
        setAccumSec(0);
        setRunning(false);
        completedRef.current = false;
      }
      setTask("");
    }
  };

  const switchTask = (next: string) => {
    if (next === task) return;
    if (mode === "focus" && sessionInProgress) {
      let segment = 0;
      if (running && runStartRef.current !== null) {
        segment = Math.max(0, Math.floor((Date.now() - runStartRef.current) / 1000));
      }
      const finalElapsed = accumSec + segment;
      if (finalElapsed > 0 && sessionStartRef.current !== null) {
        appendFocusSession(currentAccountId, {
          type: "focus",
          startedAt: new Date(sessionStartRef.current).toISOString(),
          durationSec: finalElapsed,
          completed: false,
          plannedSec: planned,
          task: task.trim() || undefined,
        });
        toast.success(`Logged ${fmtDuration(finalElapsed)} to ${task || "previous task"}`);
      }
      const wasRunning = running;
      runStartRef.current = null;
      sessionStartRef.current = null;
      setAccumSec(0);
      completedRef.current = false;
      if (wasRunning) {
        const t = Date.now();
        sessionStartRef.current = t;
        runStartRef.current = t;
      }
      refreshTodayTotals();
    }
    setTask(next);
  };

  const liveSecForTask = (t: string) => {
    const base = todaySecByTask[t] ?? 0;
    return mode === "focus" && t === task && t.trim() ? base + elapsed : base;
  };

  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const settingsLocked = sessionInProgress;

  return (
    <section className="animate-enter space-y-6">
      <div className="glass-panel rounded-2xl p-6">
        <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-2 text-2xl font-black"><Timer className="size-6 text-primary" /> FocusTodo</h3>
            <p className="mt-1 text-sm text-muted-foreground">{mode === "focus" ? "Deep work — eyes on the prize." : mode === "longBreak" ? "Long break — stretch, walk, breathe." : "Short break — recover."}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => switchMode("focus")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === "focus" ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground hover:text-foreground"}`}><Timer className="mr-1 inline size-3.5" />Focus</button>
            <button type="button" onClick={() => switchMode("break")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === "break" ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground hover:text-foreground"}`}><Coffee className="mr-1 inline size-3.5" />Break</button>
            <button type="button" onClick={() => switchMode("longBreak")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === "longBreak" ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>🌴 Long</button>
          </div>
        </div>

        {mode === "focus" && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">What are you working on?</label>
              <span className="text-[10px] font-bold text-muted-foreground">
                Active: <span className="text-primary">{task.trim() || "—"}</span>
              </span>
            </div>

            {tasks.length > 0 && (
              <div className="grid gap-2">
                {tasks.map((t) => {
                  const isActive = task === t;
                  const sec = liveSecForTask(t);
                  return (
                    <div
                      key={t}
                      className={`group flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition ${
                        isActive
                          ? "border-primary bg-primary/10 shadow-glow"
                          : "border-border bg-card/50 hover:border-primary/40 hover:bg-card/80"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => switchTask(t)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span
                          className={`size-2.5 shrink-0 rounded-full ${
                            isActive && running
                              ? "animate-pulse bg-primary shadow-glow"
                              : isActive
                                ? "bg-primary"
                                : "bg-muted-foreground/40"
                          }`}
                        />
                        <span className={`truncate text-sm font-bold ${isActive ? "text-primary" : "text-foreground"}`}>{t}</span>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmtDuration(sec)}</span>
                        {isActive ? (
                          <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary-foreground">
                            Active
                          </span>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => switchTask(t)} className="h-7 px-2 text-[10px] font-black uppercase tracking-wider">
                            Switch
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeTask(t)}
                          className="text-muted-foreground transition hover:text-destructive"
                          aria-label={`Remove ${t}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTask();
                  }
                }}
                placeholder="Add a task — e.g. DSA, Dev, System Design"
                className="h-10 flex-1 rounded-lg border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button variant="secondary" onClick={addTask} disabled={!newTaskInput.trim()}>
                <Plus className="size-4" /> Add
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center py-4">
          <FocusClock pct={pct} mm={mm} ss={ss} mode={mode} running={running} />

          <div className="mt-4 flex items-center gap-1.5" aria-label="Pomodoro cycle progress">
            {Array.from({ length: settings.longBreakEvery }).map((_, i) => (
              <span key={i} className={`size-2.5 rounded-full transition ${i < pomos ? "bg-primary" : "bg-secondary"}`} />
            ))}
            <span className="ml-2 text-xs text-muted-foreground">{pomos}/{settings.longBreakEvery} until long break</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {!running ? (
              <Button variant="rival" onClick={start}><Play /> {sessionInProgress ? "Resume" : "Start"}</Button>
            ) : (
              <Button variant="secondary" onClick={pause}><Pause /> Pause</Button>
            )}
            <Button variant="ghost" onClick={stop} disabled={!sessionInProgress && elapsed === 0}><ShieldCheck /> Stop &amp; Log</Button>
            {(mode === "break" || mode === "longBreak") && sessionInProgress && (
              <Button variant="ghost" onClick={skipBreak}>Skip Break</Button>
            )}
          </div>
        </div>

        <div className="mt-2 rounded-xl border border-border bg-card/70 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Today's focus goal</span>
            <span className="tabular-nums text-muted-foreground">{fmtDuration(liveTodayFocusSec)} / {settings.dailyGoalMin}m · {todayCompletedCount} session{todayCompletedCount === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${goalPct}%` }} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSettings(s => !s)}
          className="mt-5 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          {showSettings ? "▼ Hide settings" : "▶ Show settings"}
        </button>

        {showSettings && (
          <div className="mt-3 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Focus (min)</label>
              <input type="number" min={1} max={180} value={settings.focusMin} disabled={settingsLocked} onChange={(e) => setSettings(s => ({ ...s, focusMin: Math.max(1, Math.min(180, Number(e.target.value) || 1)) }))} className="mt-1 h-11 w-full rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Short break (min)</label>
              <input type="number" min={1} max={60} value={settings.breakMin} disabled={settingsLocked} onChange={(e) => setSettings(s => ({ ...s, breakMin: Math.max(1, Math.min(60, Number(e.target.value) || 1)) }))} className="mt-1 h-11 w-full rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Long break (min)</label>
              <input type="number" min={1} max={120} value={settings.longBreakMin} disabled={settingsLocked} onChange={(e) => setSettings(s => ({ ...s, longBreakMin: Math.max(1, Math.min(120, Number(e.target.value) || 1)) }))} className="mt-1 h-11 w-full rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Long break every N focus</label>
              <input type="number" min={2} max={10} value={settings.longBreakEvery} disabled={settingsLocked} onChange={(e) => setSettings(s => ({ ...s, longBreakEvery: Math.max(2, Math.min(10, Number(e.target.value) || 4)) }))} className="mt-1 h-11 w-full rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Daily goal (min)</label>
              <input type="number" min={5} max={1000} value={settings.dailyGoalMin} onChange={(e) => setSettings(s => ({ ...s, dailyGoalMin: Math.max(5, Math.min(1000, Number(e.target.value) || 120)) }))} className="mt-1 h-11 w-full rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.autoStartNext} onChange={(e) => setSettings(s => ({ ...s, autoStartNext: e.target.checked }))} className="size-4 rounded border-input" />
                Auto-start next session
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.soundEnabled} onChange={(e) => setSettings(s => ({ ...s, soundEnabled: e.target.checked }))} className="size-4 rounded border-input" />
                Play chime on completion
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.notificationsEnabled}
                  onChange={async (e) => {
                    const enabled = e.target.checked;
                    if (enabled && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
                      try {
                        const perm = await Notification.requestPermission();
                        if (perm !== "granted") { toast.error("Browser blocked notifications"); return; }
                      } catch {}
                    }
                    setSettings(s => ({ ...s, notificationsEnabled: enabled }));
                  }}
                  className="size-4 rounded border-input"
                />
                Browser notifications on completion
              </label>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FocusBarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { fullDate: string; sec: number } }> }) {
  if (!active || !payload?.length) return null;
  const { fullDate, sec } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{fullDate}</p>
      <p className="mt-1 font-mono text-lg font-black tabular-nums text-primary">
        {sec > 0 ? fmtDuration(sec) : "—"}
      </p>
      <p className="text-[10px] text-muted-foreground">focus time</p>
    </div>
  );
}

export function FocusAnalytics({ currentAccountId }: { currentAccountId: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!currentAccountId) return;
    let cancelled = false;
    syncFocusSessionsFromCloud(currentAccountId).then(() => {
      if (!cancelled) setTick(t => t + 1);
    });
    return () => { cancelled = true; };
  }, [currentAccountId]);

  const [settings, setSettings] = useState<FocusSettings>(() => loadFocusSettings(currentAccountId));
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState<string>(() => String(loadFocusSettings(currentAccountId).dailyGoalMin));

  useEffect(() => {
    if (isEditingGoal) return;
    const fresh = loadFocusSettings(currentAccountId);
    setSettings(fresh);
    setGoalDraft(String(fresh.dailyGoalMin));
  }, [currentAccountId, tick, isEditingGoal]);

  const saveGoal = () => {
    const parsed = Number(goalDraft);
    const n = Math.max(5, Math.min(1000, Number.isFinite(parsed) ? Math.round(parsed) : settings.dailyGoalMin));
    const next: FocusSettings = { ...settings, dailyGoalMin: n };
    setSettings(next);
    localStorage.setItem(focusSettingsKey(currentAccountId), JSON.stringify(next));
    setGoalDraft(String(n));
    setIsEditingGoal(false);
    toast.success(`Daily goal updated to ${n}m`);
  };

  const cancelGoalEdit = () => {
    setGoalDraft(String(settings.dailyGoalMin));
    setIsEditingGoal(false);
  };

  const { todaySec, weekSec, totalSec, completedCount, avgMin, longestMin, streak, chartData, hasData, topTasks, recentSessions, bestDayMin, completionRate } = useMemo(() => {
    const sessions = loadFocusSessions(currentAccountId);
    const focus = sessions.filter(s => s.type === "focus");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(today); monthStart.setDate(monthStart.getDate() - 29);

    const todaySec = focus.filter(s => new Date(s.startedAt) >= today).reduce((a, s) => a + s.durationSec, 0);
    const weekSec = focus.filter(s => new Date(s.startedAt) >= weekStart).reduce((a, s) => a + s.durationSec, 0);
    const totalSec = focus.reduce((a, s) => a + s.durationSec, 0);
    const completedCount = focus.filter(s => s.completed).length;
    const longestMin = focus.length ? Math.round(focus.reduce((m, s) => Math.max(m, s.durationSec), 0) / 60) : 0;
    const avgMin = focus.length ? Math.round(totalSec / focus.length / 60) : 0;
    const completionRate = focus.length ? Math.round((completedCount / focus.length) * 100) : 0;

    const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const dayMap = new Map<string, number>();
    for (const s of focus) {
      const d = new Date(s.startedAt);
      dayMap.set(dayKey(d), (dayMap.get(dayKey(d)) ?? 0) + s.durationSec);
    }

    const chartData = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (13 - i));
      const sec = dayMap.get(dayKey(d)) ?? 0;
      return {
        date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        fullDate: d.toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric" }),
        minutes: sec / 60,
        sec,
      };
    });

    const bestDayMin = Math.max(0, ...Array.from(dayMap.values()).map(s => Math.round(s / 60)));

    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if ((dayMap.get(dayKey(d)) ?? 0) > 0) streak++;
      else break;
    }

    const taskMap = new Map<string, number>();
    for (const s of focus) {
      if (!s.task) continue;
      if (new Date(s.startedAt) < monthStart) continue;
      const k = s.task.trim();
      if (!k) continue;
      taskMap.set(k, (taskMap.get(k) ?? 0) + s.durationSec);
    }
    const topTasks = Array.from(taskMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([task, sec]) => ({ task, sec }));

    const recentSessions = [...sessions]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 10);

    return { todaySec, weekSec, totalSec, completedCount, avgMin, longestMin, streak, chartData, hasData: focus.length > 0, topTasks, recentSessions, bestDayMin, completionRate };
  }, [currentAccountId, tick]);

  const goalSec = settings.dailyGoalMin * 60;
  const goalPct = goalSec > 0 ? Math.min(100, (todaySec / goalSec) * 100) : 0;
  const topTaskMaxSec = topTasks[0]?.sec ?? 1;

  return (
    <section className="animate-enter space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-2xl font-black"><BarChart3 className="size-6 text-primary" /> Focus Analytics</h3>
        <p className="mt-1 text-sm text-muted-foreground">Deep-work time, sessions, streaks, and what you've been working on.</p>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-bold">Today's goal</span>
          {isEditingGoal ? (
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-muted-foreground">{fmtDuration(todaySec)} /</span>
              <input
                type="number"
                min={5}
                max={1000}
                autoFocus
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); saveGoal(); }
                  if (e.key === "Escape") { e.preventDefault(); cancelGoalEdit(); }
                }}
                className="h-8 w-20 rounded-md border border-input bg-background/70 px-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-xs text-muted-foreground">min</span>
              <button type="button" onClick={saveGoal} className="text-xs font-bold text-primary hover:underline">Save</button>
              <button type="button" onClick={cancelGoalEdit} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-muted-foreground">
                {fmtDuration(todaySec)} / <span className="text-foreground">{settings.dailyGoalMin}m</span> · {Math.round(goalPct)}%
              </span>
              <button
                type="button"
                onClick={() => { setGoalDraft(String(settings.dailyGoalMin)); setIsEditingGoal(true); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Edit
              </button>
            </div>
          )}
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${goalPct}%` }} />
        </div>
        {goalPct >= 100 && <p className="mt-2 text-xs font-bold text-primary">Goal hit — nice work 🔥</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Today" value={fmtDuration(todaySec)} Icon={Zap} />
        <StatCard label="This Week" value={fmtDuration(weekSec)} Icon={Activity} />
        <StatCard label="All Time" value={fmtDuration(totalSec)} Icon={Trophy} />
        <StatCard label="Day Streak" value={`${streak}`} Icon={Flame} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Sessions Completed" value={`${completedCount}`} Icon={CheckCircle2} />
        <StatCard label="Avg Session" value={`${avgMin}m`} Icon={Timer} />
        <StatCard label="Longest Session" value={`${longestMin}m`} Icon={Medal} />
        <StatCard label="Completion Rate" value={`${completionRate}%`} Icon={Target} />
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-xl font-bold">Last 14 Days</h4>
          {bestDayMin > 0 && <span className="text-xs text-muted-foreground">Best day: {bestDayMin}m</span>}
        </div>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">No focus sessions yet — start one in the FocusTodo tab.</p>
        ) : (
          <ChartContainer config={{ minutes: { label: "Focus Minutes", color: "hsl(var(--primary))" } }} className="h-64 w-full">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (v >= 60 ? `${Math.round(v / 60)}h` : `${Math.round(v)}m`)}
                width={36}
              />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                content={<FocusBarTooltip />}
              />
              <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel rounded-2xl p-5">
          <h4 className="mb-4 text-xl font-bold">Top Tasks · Last 30 Days</h4>
          {topTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tag your focus sessions with a task name to see what's eating the most time.</p>
          ) : (
            <ul className="space-y-3">
              {topTasks.map(({ task, sec }) => (
                <li key={task}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate pr-3 font-semibold">{task}</span>
                    <span className="tabular-nums text-muted-foreground">{fmtDuration(sec)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(sec / topTaskMaxSec) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <h4 className="mb-4 text-xl font-bold">Recent Sessions</h4>
          {recentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentSessions.map((s, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-card/70 px-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`size-2 shrink-0 rounded-full ${s.type === "focus" ? "bg-primary" : "bg-accent"}`} />
                    <span className="truncate font-semibold">
                      {s.type === "focus" ? (s.task || "Focus") : (s.isLongBreak ? "Long Break" : "Break")}
                    </span>
                    {!s.completed && <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">stopped</span>}
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-3 text-xs text-muted-foreground tabular-nums">
                    <span>{fmtDuration(s.durationSec)}</span>
                    <span>{relativeTime(s.startedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
