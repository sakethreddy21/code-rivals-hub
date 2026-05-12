"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Repeat2,
  RotateCcw,
} from "lucide-react";

import type { Problem } from "@/types/rivals";
import { Button } from "@/components/ui/button";

/* ─────────────────────────────────────────────────────────────────────────
   Revision state (persisted in localStorage)
───────────────────────────────────────────────────────────────────────── */

type RevisionEntry = {
  problemId: string;
  revised: boolean;
  revisedAt: string | null;
  revisedCount: number;
};

type RevisionState = {
  version: 2;
  byProblemId: Record<string, RevisionEntry>;
};

function storageKey(accountId: string) {
  return `revision_state_v2_${accountId}`;
}

function loadState(accountId: string): RevisionState {
  if (typeof window === "undefined") return { version: 2, byProblemId: {} };
  try {
    const raw = localStorage.getItem(storageKey(accountId));
    if (!raw) return { version: 2, byProblemId: {} };
    const parsed = JSON.parse(raw) as RevisionState;
    if (!parsed || parsed.version !== 2 || typeof parsed.byProblemId !== "object")
      return { version: 2, byProblemId: {} };
    return parsed;
  } catch {
    return { version: 2, byProblemId: {} };
  }
}

function saveState(accountId: string, state: RevisionState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(accountId), JSON.stringify(state));
}

/* ─────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────── */

/** Returns "YYYY-MM-DD" in **local** time */
function toLocalDateKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" → human label like "Mon, May 12" or "Today" / "Yesterday" */
function formatDayLabel(dateKey: string) {
  const todayKey = toLocalDateKey(new Date().toISOString());
  const yestKey = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateKey(d.toISOString());
  })();

  if (dateKey === todayKey) return "Today";
  if (dateKey === yestKey) return "Yesterday";

  const [y, m, day] = dateKey.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function difficultyColor(d: string) {
  if (d === "Easy") return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
  if (d === "Hard") return "text-rose-400 bg-rose-400/10 border-rose-400/20";
  return "text-amber-400 bg-amber-400/10 border-amber-400/20";
}

/** Return the Monday (local) of the week containing `date` */
function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "YYYY-MM-DD" key from a Date (local) */
function dateToKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/** Format week label e.g. "1 Jan – 7 Jan" */
function formatWeekLabel(start: Date, end: Date) {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

/* ─────────────────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────────────────── */

export function RevisionView({
  currentAccountId,
  problems,
}: {
  currentAccountId: string;
  problems: Problem[];
}) {
  const [state, setState] = useState<RevisionState>(() => loadState(currentAccountId));
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    setState(loadState(currentAccountId));
  }, [currentAccountId]);

  const myProblems = useMemo(
    () => problems.filter((p) => p.accountId === currentAccountId),
    [problems, currentAccountId]
  );

  /* ── All calendar weeks that have problems (+ current week) ── */
  const weeks = useMemo(() => {
    const today = new Date();
    const currentMonday = getMondayOf(today);
    const dateKeys = myProblems.map((p) => toLocalDateKey(p.solvedAt));
    const mondays = new Set<string>();
    // Always include current week
    mondays.add(dateToKey(currentMonday));
    for (const dk of dateKeys) {
      const [y, m, day] = dk.split("-").map(Number);
      const mon = getMondayOf(new Date(y, m - 1, day));
      mondays.add(dateToKey(mon));
    }
    return [...mondays]
      .sort()
      .reverse()
      .map((mondayKey) => {
        const [y, m, d] = mondayKey.split("-").map(Number);
        const start = new Date(y, m - 1, d);
        const end = new Date(y, m - 1, d + 6);
        return { key: mondayKey, label: formatWeekLabel(start, end), start, end };
      });
  }, [myProblems]);

  /* ── Selected week (default = current week) ── */
  const currentMondayKey = useMemo(() => dateToKey(getMondayOf(new Date())), []);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(currentMondayKey);

  /* ── Days for the selected week ── */
  const days: { key: string; label: string }[] = useMemo(() => {
    const [y, m, d] = selectedWeekKey.split("-").map(Number);
    const result: { key: string; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(y, m - 1, d + i);
      const key = dateToKey(date);
      result.push({ key, label: formatDayLabel(key) });
    }
    return result;
  }, [selectedWeekKey]);



  const problemsByDay = useMemo(() => {
    const map: Record<string, Problem[]> = {};
    for (const p of myProblems) {
      const dk = toLocalDateKey(p.solvedAt);
      if (!map[dk]) map[dk] = [];
      map[dk].push(p);
    }
    // Sort each day newest-first
    for (const dk of Object.keys(map)) {
      map[dk].sort((a, b) => new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime());
    }
    return map;
  }, [myProblems]);

  /* Open today's section by default on first render */
  useEffect(() => {
    if (days.length > 0) {
      setOpenDays(new Set([days[0].key]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Toggle revision for a single problem ── */
  const toggleRevised = (problemId: string) => {
    setState((prev) => {
      const existing = prev.byProblemId[problemId];
      const wasRevised = existing?.revised ?? false;
      const now = new Date().toISOString();
      const next: RevisionState = {
        version: 2,
        byProblemId: {
          ...prev.byProblemId,
          [problemId]: {
            problemId,
            revised: !wasRevised,
            revisedAt: wasRevised ? null : now,
            revisedCount: (existing?.revisedCount ?? 0) + (wasRevised ? 0 : 1),
          },
        },
      };
      saveState(currentAccountId, next);
      return next;
    });
  };

  /* ── Mark all problems in a day as revised ── */
  const markAllRevised = (dayKey: string) => {
    const probs = problemsByDay[dayKey] ?? [];
    setState((prev) => {
      const now = new Date().toISOString();
      const updates: Record<string, RevisionEntry> = {};
      for (const p of probs) {
        const existing = prev.byProblemId[p.id];
        if (!existing?.revised) {
          updates[p.id] = {
            problemId: p.id,
            revised: true,
            revisedAt: now,
            revisedCount: (existing?.revisedCount ?? 0) + 1,
          };
        }
      }
      const next: RevisionState = {
        version: 2,
        byProblemId: { ...prev.byProblemId, ...updates },
      };
      saveState(currentAccountId, next);
      return next;
    });
  };

  /* ── Toggle day open/closed ── */
  const toggleDay = (key: string) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* ── Summary stats for the whole week ── */
  const weekStats = useMemo(() => {
    let totalProblems = 0;
    let totalRevised = 0;
    for (const { key } of days) {
      const probs = problemsByDay[key] ?? [];
      totalProblems += probs.length;
      for (const p of probs) {
        if (state.byProblemId[p.id]?.revised) totalRevised++;
      }
    }
    return { totalProblems, totalRevised };
  }, [days, problemsByDay, state]);

  /* ── Per-platform stats (all-time) ── */
  const platformStats = useMemo(() => {
    const map: Record<string, { total: number; revised: number }> = {};
    for (const p of myProblems) {
      if (!map[p.platform]) map[p.platform] = { total: 0, revised: 0 };
      map[p.platform].total++;
      if (state.byProblemId[p.id]?.revised) map[p.platform].revised++;
    }
    return Object.entries(map)
      .map(([platform, { total, revised }]) => ({
        platform,
        total,
        revised,
        notRevised: total - revised,
        pct: total > 0 ? Math.round((revised / total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [myProblems, state]);

  /* ── Empty state ── */
  if (myProblems.length === 0) {
    return (
      <section className="animate-enter space-y-4">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-black">
            <Repeat2 className="size-6 text-primary" /> Weekly Revision
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your revision progress day by day for the last 7 days.
          </p>
        </div>
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-sm text-muted-foreground">
            No solved problems yet. Add some in{" "}
            <span className="font-semibold text-foreground">My Problems</span>, then come back to
            start revising.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-black">
            <Repeat2 className="size-6 text-primary" /> Weekly Revision
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Click <span className="font-semibold text-foreground">Revise</span> to toggle revision status per problem.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/70 px-4 py-2 text-sm">
          <span className="font-black text-primary">{weekStats.totalRevised}</span>
          <span className="text-muted-foreground"> / {weekStats.totalProblems} revised this week</span>
        </div>
      </div>

      {/* ── Week filter pills ── */}
      <div className="flex flex-wrap gap-2">
        {weeks.map((w) => {
          const isSelected = w.key === selectedWeekKey;
          return (
            <button
              key={w.key}
              type="button"
              onClick={() => {
                setSelectedWeekKey(w.key);
                setOpenDays(new Set());
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                isSelected
                  ? "border-primary bg-primary/15 text-primary shadow-glow"
                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {w.label}
              {w.key === currentMondayKey && (
                <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary">
                  This week
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Platform summary cards ── */}
      {platformStats.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {platformStats.map(({ platform, total, revised, notRevised, pct }) => (
            <div
              key={platform}
              className="glass-panel rounded-2xl border border-border p-5 transition hover:-translate-y-0.5"
            >
              {/* Platform name */}
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {platform}
              </p>

              {/* Big number */}
              <p className="text-4xl font-black tabular-nums">{total}</p>
              <p className="text-xs text-muted-foreground">problems solved</p>

              {/* Revised / Not revised row */}
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-center">
                  <p className="text-lg font-black text-primary">{revised}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground">Revised</p>
                </div>
                <div className="flex-1 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-center">
                  <p className="text-lg font-black text-rose-400">{notRevised}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground">Not revised</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>Revision progress</span>
                  <span className="font-mono font-bold text-foreground">{pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Week progress bar */}
      {weekStats.totalProblems > 0 && (
        <div className="glass-panel rounded-2xl p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-widest">Week Overview</span>
            <span className="font-mono font-bold text-foreground">
              {Math.round((weekStats.totalRevised / weekStats.totalProblems) * 100)}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary shadow-glow transition-all duration-700"
              style={{
                width: `${Math.round((weekStats.totalRevised / weekStats.totalProblems) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Day sections */}
      <div className="space-y-3">
        {days.map(({ key, label }) => {
          const dayProblems = problemsByDay[key] ?? [];
          const revisedCount = dayProblems.filter((p) => state.byProblemId[p.id]?.revised).length;
          const allRevised = dayProblems.length > 0 && revisedCount === dayProblems.length;
          const isOpen = openDays.has(key);
          const isEmpty = dayProblems.length === 0;

          return (
            <div
              key={key}
              className={`glass-panel rounded-2xl border transition-all ${
                allRevised ? "border-primary/30" : "border-border"
              }`}
            >
              {/* Day header — always visible */}
              <button
                type="button"
                className="flex w-full items-center gap-3 px-5 py-4 text-left"
                onClick={() => !isEmpty && toggleDay(key)}
              >
                {/* Chevron */}
                <span className="shrink-0 text-muted-foreground">
                  {isEmpty ? null : isOpen ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </span>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-base">{label}</span>
                    {allRevised && !isEmpty && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">
                        ✓ All revised
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {isEmpty
                      ? "No problems solved"
                      : `${dayProblems.length} problem${dayProblems.length !== 1 ? "s" : ""} · ${revisedCount}/${dayProblems.length} revised`}
                  </p>
                </div>

                {/* Mini progress bar */}
                {!isEmpty && (
                  <div className="hidden shrink-0 sm:flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {dayProblems.length > 0
                        ? Math.round((revisedCount / dayProblems.length) * 100)
                        : 0}
                      %
                    </span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary/40">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{
                          width: `${dayProblems.length > 0 ? Math.round((revisedCount / dayProblems.length) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Mark all button */}
                {!isEmpty && !allRevised && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 shrink-0 text-xs h-8 hidden sm:flex"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAllRevised(key);
                    }}
                  >
                    <CheckCircle2 className="size-3.5 mr-1" /> Revise all
                  </Button>
                )}
              </button>

              {/* Day problems list */}
              {isOpen && !isEmpty && (
                <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
                  {/* Mobile "revise all" */}
                  {!allRevised && (
                    <div className="flex justify-end sm:hidden mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => markAllRevised(key)}
                      >
                        <CheckCircle2 className="size-3.5 mr-1" /> Revise all
                      </Button>
                    </div>
                  )}

                  {dayProblems.map((p) => {
                    const entry = state.byProblemId[p.id];
                    const isRevised = entry?.revised ?? false;

                    return (
                      <div
                        key={p.id}
                        className={`flex flex-col gap-3 rounded-xl border px-4 py-3 transition-all sm:flex-row sm:items-center sm:justify-between ${
                          isRevised
                            ? "border-primary/30 bg-primary/5"
                            : "border-border bg-card/40 hover:bg-card/60"
                        }`}
                      >
                        {/* Left: problem info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Revised indicator */}
                            {isRevised ? (
                              <CheckCircle2 className="size-4 shrink-0 text-primary" />
                            ) : (
                              <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                            )}

                            <a
                              href={p.link}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate font-bold hover:underline"
                              title={p.name}
                            >
                              {p.name}
                            </a>

                            {/* Badges */}
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${difficultyColor(p.difficulty)}`}
                            >
                              {p.difficulty}
                            </span>
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                              {p.platform}
                            </span>
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                              {p.topic}
                            </span>
                          </div>

                          {/* Sub-text */}
                          <p className="mt-1 pl-6 text-xs text-muted-foreground">
                            {isRevised && entry?.revisedAt ? (
                              <>
                                Revised{" "}
                                {new Date(entry.revisedAt).toLocaleTimeString(undefined, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {entry.revisedCount > 1 && (
                                  <span className="ml-1 text-primary font-semibold">
                                    · {entry.revisedCount}x
                                  </span>
                                )}
                              </>
                            ) : (
                              "Not revised yet"
                            )}
                          </p>
                        </div>

                        {/* Right: toggle button */}
                        <button
                          type="button"
                          onClick={() => toggleRevised(p.id)}
                          className={`group flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition-all ${
                            isRevised
                              ? "border-primary/40 bg-primary/10 text-primary hover:bg-rose-500/10 hover:border-rose-500/40 hover:text-rose-400"
                              : "border-border bg-secondary/60 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                          }`}
                        >
                          {isRevised ? (
                            <>
                              <CheckCircle2 className="size-4 group-hover:hidden" />
                              <RotateCcw className="size-4 hidden group-hover:block" />
                              <span className="group-hover:hidden">Revised</span>
                              <span className="hidden group-hover:inline">Undo</span>
                            </>
                          ) : (
                            <>
                              <Repeat2 className="size-4" />
                              Revise
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
