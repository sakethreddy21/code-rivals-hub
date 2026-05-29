"use client";

import React, { useMemo, useState } from "react";
import {
  Search,
  Bookmark,
  ExternalLink,
  Repeat2,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  Clock,
} from "lucide-react";

import type { Problem, Revision } from "@/types/rivals";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ─────────────────────────────────────────────────────────────────────────
   DS Topics Classification & Constants
   (Aligned with My Problems view)
 ───────────────────────────────────────────────────────────────────────── */

const DS_TOPICS = [
  "Arrays", "Strings", "Hashing", "Two Pointers", "Sorting",
  "Binary Search", "Sliding Window", "Linked List", "Stack", "Queue",
  "Trees", "Graphs", "Heap", "DP", "Greedy",
  "Backtracking", "Recursion", "Math", "Bit Manipulation", "Other"
] as const;

type DsTopic = typeof DS_TOPICS[number];

const DS_ICON_MAP: Record<string, string> = {
  Arrays: "🔢", Graphs: "🕸️", DP: "🧠", Trees: "🌲", Heap: "⛰️",
  "Sliding Window": "🪟", "Binary Search": "🔍", Backtracking: "↩️",
  Strings: "🔤", "Linked List": "🔗", Stack: "📚", Queue: "🚦",
  Hashing: "🗝️", "Two Pointers": "✌️", Sorting: "🗂️", Greedy: "🤑",
  Recursion: "🔄", Math: "➗", "Bit Manipulation": "0️⃣", Other: "📦",
};

function getTopicGroup(p: { topic: string; name: string }): DsTopic {
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

/* ─────────────────────────────────────────────────────────────────────────
   State & Helpers
 ───────────────────────────────────────────────────────────────────────── */

interface RevisedItem {
  id: string; // problemId or custom link-based id
  problemId: string | null;
  name: string;
  link: string;
  platform: string;
  difficulty: string;
  topic: string;
  solvedAt: string | null;
  revisedCount: number;
  latestRevisedAt: string;
  isCustom: boolean;
  hasTodayRevision: boolean;
  todayRevisionId: string | null;
}

function toLocalDateKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function difficultyColor(d: string) {
  if (d === "Easy") return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
  if (d === "Hard") return "text-rose-400 bg-rose-400/10 border-rose-400/20";
  return "text-amber-400 bg-amber-400/10 border-amber-400/20";
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const todayKey = toLocalDateKey(now.toISOString());
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yestKey = toLocalDateKey(yest.toISOString());
  const itemKey = toLocalDateKey(iso);

  const timeStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (itemKey === todayKey) {
    return `today at ${timeStr}`;
  }
  if (itemKey === yestKey) {
    return `yesterday at ${timeStr}`;
  }
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${timeStr}`;
}

function useBookmarks(storageKey: string) {
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
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

/* ─────────────────────────────────────────────────────────────────────────
   Main Component
 ───────────────────────────────────────────────────────────────────────── */

export function RevisionView({
  currentAccountId,
  problems,
  revisions = [],
  onRefresh,
}: {
  currentAccountId: string;
  problems: Problem[];
  revisions?: Revision[];
  onRefresh?: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [activeDs, setActiveDs] = useState<DsTopic | "All">("All");
  const [revisionFilter, setRevisionFilter] = useState<"All" | "1x" | "2x" | "3x+">("All");
  const { bookmarks, toggle: toggleBookmark } = useBookmarks(`bookmarks_${currentAccountId}`);

  const myProblems = useMemo(
    () => problems.filter((p) => p.accountId === currentAccountId),
    [problems, currentAccountId]
  );

  // ── Construct Unified Revised Items List ────────────────────────────────
  const revisedItems = useMemo(() => {
    const items: RevisedItem[] = [];
    const myRevs = (revisions || []).filter((r) => r.accountId === currentAccountId);
    const todayKey = toLocalDateKey(new Date().toISOString());

    // 1. Map problem records that have revisions
    const solvedMap = new Map<string, Problem>();
    for (const p of myProblems) {
      solvedMap.set(p.id, p);
      const problemRevs = myRevs.filter((r) => r.problemId === p.id);
      if (problemRevs.length > 0) {
        const sorted = [...problemRevs].sort((a, b) => new Date(b.revisedAt).getTime() - new Date(a.revisedAt).getTime());
        const latest = sorted[0];
        const todayRev = sorted.find((r) => toLocalDateKey(r.revisedAt) === todayKey);
        items.push({
          id: p.id,
          problemId: p.id,
          name: p.name,
          link: p.link || "",
          platform: p.platform || "Other",
          difficulty: p.difficulty || "Medium",
          topic: p.topic || "Other",
          solvedAt: p.solvedAt,
          revisedCount: sorted.length,
          latestRevisedAt: latest.revisedAt,
          isCustom: false,
          hasTodayRevision: !!todayRev,
          todayRevisionId: todayRev ? todayRev.id : null,
        });
      }
    }

    // 2. Map custom links revisions (where problemId is null or missing from solved list)
    const customRevs = myRevs.filter((r) => !r.problemId || !solvedMap.has(r.problemId));
    const customGroups = new Map<string, typeof customRevs>();
    for (const r of customRevs) {
      const key = (r.link || r.name || "").trim().toLowerCase();
      if (!customGroups.has(key)) {
        customGroups.set(key, []);
      }
      customGroups.get(key)!.push(r);
    }

    for (const [key, revs] of customGroups.entries()) {
      if (revs.length === 0) continue;
      const sorted = [...revs].sort((a, b) => new Date(b.revisedAt).getTime() - new Date(a.revisedAt).getTime());
      const latest = sorted[0];
      const todayRev = sorted.find((r) => toLocalDateKey(r.revisedAt) === todayKey);
      items.push({
        id: `custom_${key}`,
        problemId: null,
        name: latest.name || "Custom Problem",
        link: latest.link || "",
        platform: latest.platform || "Other",
        difficulty: latest.difficulty || "Medium",
        topic: latest.topic || "Other",
        solvedAt: null,
        revisedCount: sorted.length,
        latestRevisedAt: latest.revisedAt,
        isCustom: true,
        hasTodayRevision: !!todayRev,
        todayRevisionId: todayRev ? todayRev.id : null,
      });
    }

    // Sort items by latest revised date descending
    return items.sort((a, b) => new Date(b.latestRevisedAt).getTime() - new Date(a.latestRevisedAt).getTime());
  }, [myProblems, revisions, currentAccountId]);

  // ── Stats Summary ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalRevisedCount = revisedItems.reduce((acc, item) => acc + item.revisedCount, 0);
    return {
      totalProblems: revisedItems.length,
      totalRevisions: totalRevisedCount,
    };
  }, [revisedItems]);

  // ── Groups & Counts by DS Topic ─────────────────────────────────────────
  const byTopic = useMemo(() => {
    const map: Partial<Record<DsTopic, RevisedItem[]>> = {};
    for (const item of revisedItems) {
      const g = getTopicGroup(item);
      if (!map[g]) map[g] = [];
      map[g]!.push(item);
    }
    return map;
  }, [revisedItems]);

  // ── Filter & Search Logic ───────────────────────────────────────────────
  const applyFilters = (list: RevisedItem[]) => {
    const q = filter.toLowerCase().trim();
    return list
      .filter((item) => {
        if (revisionFilter === "All") return true;
        if (revisionFilter === "1x") return item.revisedCount === 1;
        if (revisionFilter === "2x") return item.revisedCount === 2;
        if (revisionFilter === "3x+") return item.revisedCount >= 3;
        return true;
      })
      .filter((item) => {
        if (!q) return true;
        return `${item.platform} ${item.difficulty} ${item.topic} ${item.name}`
          .toLowerCase()
          .includes(q);
      });
  };

  // ── Revise / Undo Actions ──────────────────────────────────────────────
  const toggleRevised = async (item: RevisedItem) => {
    if (item.hasTodayRevision && item.todayRevisionId) {
      // Undo today's revision
      const { error } = await supabase
        .from("revisions" as any)
        .delete()
        .eq("id", item.todayRevisionId);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Revision undone");
        onRefresh?.();
      }
    } else {
      // Create new revision record
      const { error } = await supabase
        .from("revisions" as any)
        .insert({
          account_id: currentAccountId,
          problem_id: item.problemId,
          name: item.name,
          link: item.link,
          platform: item.platform,
          difficulty: item.difficulty,
          topic: item.topic,
          revised_at: new Date().toISOString(),
        });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Revision logged as solved!");
        onRefresh?.();
      }
    }
  };

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

  // ── Filtered items to render ────────────────────────────────────────────
  const currentTopicItems = useMemo(() => {
    return activeDs === "All" ? revisedItems : (byTopic[activeDs] ?? []);
  }, [revisedItems, activeDs, byTopic]);

  const itemsToRender = useMemo(() => {
    return applyFilters(currentTopicItems);
  }, [currentTopicItems, filter, revisionFilter]);

  /* ── Empty State ── */
  if (revisedItems.length === 0) {
    return (
      <section className="animate-enter space-y-4">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-black">
            <Repeat2 className="size-6 text-primary" /> Revision History
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage all problems you have revised.
          </p>
        </div>
        <div className="glass-panel rounded-2xl p-8 text-center">
          <BookOpen className="mx-auto size-12 text-muted-foreground/30 mb-3" />
          <h4 className="text-lg font-bold text-foreground mb-1">No Revised Problems</h4>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You haven't revised any problems yet. Go to the{" "}
            <span className="font-semibold text-foreground">Today's Target</span> or{" "}
            <span className="font-semibold text-foreground">My Problems</span> tab to start tracking revision tasks.
          </p>
        </div>
      </section>
    );
  }

  const borderByDiff: Record<string, string> = {
    Easy: "border-l-green-500",
    Medium: "border-l-yellow-500",
    Hard: "border-l-red-500",
  };

  return (
    <section className="animate-enter space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-2xl font-black">Revision History</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.totalProblems} revised problems ·{" "}
            <span className="text-primary font-bold">{stats.totalRevisions}</span> total revisions logged
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
        {/* Left Sidebar (DS Topics) - 30% width */}
        <div className="flex flex-col gap-1 md:sticky md:top-24 md:w-[30%] shrink-0 max-h-[75vh] overflow-y-auto rounded-xl border border-border bg-secondary/10 p-2">
          <button
            type="button"
            onClick={() => setActiveDs("All")}
            className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-bold transition ${
              activeDs === "All"
                ? "bg-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-3">📋 All Topics</span>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                activeDs === "All" ? "bg-white/20" : "bg-secondary"
              }`}
            >
              {revisedItems.length}
            </span>
          </button>

          <div className="my-2 h-px bg-border/50" />

          {DS_TOPICS.map((topic) => {
            const count = byTopic[topic]?.length ?? 0;
            if (count === 0) return null; // Only show topics that have at least one revised problem
            return (
              <button
                key={topic}
                type="button"
                onClick={() => setActiveDs(topic)}
                className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-bold transition ${
                  activeDs === topic
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-lg leading-none">{DS_ICON_MAP[topic]}</span>
                  {topic}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                    activeDs === topic ? "bg-white/20" : "bg-secondary"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Content Column */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Top Filter Buttons Row */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/30 p-1 w-max">
            {(["All", "1x", "2x", "3x+"] as const).map((key) => {
              const label = key === "All" ? "All Revisions" : key === "1x" ? "Revised Once" : key === "2x" ? "Revised Twice" : "Revised 3x+";
              const matchesCount = applyFilters(currentTopicItems).filter(item => {
                if (key === "All") return true;
                if (key === "1x") return item.revisedCount === 1;
                if (key === "2x") return item.revisedCount === 2;
                if (key === "3x+") return item.revisedCount >= 3;
                return true;
              }).length;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRevisionFilter(key)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                    revisionFilter === key
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-1.5 text-[10px] ${
                      revisionFilter === key ? "bg-primary-foreground/20" : "bg-secondary"
                    }`}
                  >
                    {matchesCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Revised Problems List */}
          {itemsToRender.length === 0 ? (
            <div className="glass-panel rounded-xl p-10 text-center text-sm text-muted-foreground">
              No revised problems match your active filters.
            </div>
          ) : (
            <ul className="space-y-2">
              {itemsToRender.map((item) => {
                const isBookmarked = bookmarks.has(item.id);
                return (
                  <li
                    key={item.id}
                    className={`group flex items-center gap-4 rounded-xl border border-border border-l-[3px] ${
                      borderByDiff[item.difficulty] ?? ""
                    } bg-card/50 px-4 py-3 transition hover:-translate-y-px hover:border-primary/40 hover:bg-card`}
                  >
                    {/* Main Info Area */}
                    <div className="min-w-0 flex-1">
                      {item.link ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1.5 text-sm font-semibold transition hover:text-primary"
                        >
                          <span className="truncate">{item.name}</span>
                          <ExternalLink className="size-3 shrink-0 opacity-0 transition group-hover:opacity-60" />
                        </a>
                      ) : (
                        <span className="block truncate text-sm font-semibold">{item.name}</span>
                      )}

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="font-bold uppercase tracking-wider">{item.platform}</span>
                        <span className="opacity-50">·</span>
                        <span className="font-semibold text-primary">{item.topic}</span>
                        {item.solvedAt && (
                          <>
                            <span className="opacity-50">·</span>
                            <span>
                              Solved{" "}
                              {new Date(item.solvedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </>
                        )}
                        <span className="opacity-50">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" />
                          Last revised {formatDateTime(item.latestRevisedAt)}
                        </span>
                        {item.revisedCount > 0 && (
                          <>
                            <span className="opacity-50">·</span>
                            {getRevisionBadge(item.revisedCount)}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleBookmark(item.id)}
                        className={`rounded-lg p-2 transition ${
                          isBookmarked
                            ? "text-accent bg-accent/10 hover:bg-accent/20"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                        title={isBookmarked ? "Remove Bookmark" : "Bookmark Problem"}
                      >
                        <Bookmark
                          className={`size-4 ${isBookmarked ? "fill-current" : ""}`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleRevised(item)}
                        className={`group flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-1.5 text-xs font-bold transition-all ${
                          item.hasTodayRevision
                            ? "border-primary/40 bg-primary/10 text-primary hover:bg-rose-500/10 hover:border-rose-500/40 hover:text-rose-400"
                            : "border-border bg-secondary/60 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                        }`}
                      >
                        {item.hasTodayRevision ? (
                          <>
                            <CheckCircle2 className="size-3.5 group-hover:hidden" />
                            <RotateCcw className="size-3.5 hidden group-hover:block" />
                            <span className="group-hover:hidden">Revised</span>
                            <span className="hidden group-hover:inline">Undo</span>
                          </>
                        ) : (
                          <>
                            <Repeat2 className="size-3.5" />
                            Revise
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
