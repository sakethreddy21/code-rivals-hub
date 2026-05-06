"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  Flame,
  Globe,
  Link2,
  Loader2,
  Medal,
  RefreshCw,
  Swords,
  Target,
  Trash2,
  Trophy,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { AppData, GfgStats, LeetCodeStats, MutualUser, PlatformConnection } from "@/types/rivals";

function DifficultyBar({ label, solved, total, color }: { label: string; solved: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (solved / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-secondary/30 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-1000 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 text-right text-xs font-bold text-muted-foreground">
        {solved}/{total}
      </span>
    </div>
  );
}

export function PlatformStats({ currentAccountId, data, users, onRefresh }: { currentAccountId: string; data: AppData; users: MutualUser[]; onRefresh: () => Promise<void> }) {
  const [lcUsername, setLcUsername] = useState("");
  const [gfgUsername, setGfgUsername] = useState("");
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [gfgManualMode, setGfgManualMode] = useState(false);
  const [gfgManualStats, setGfgManualStats] = useState({ totalSolved: "", easySolved: "", mediumSolved: "", hardSolved: "", codingScore: "" });

  const myConnections = useMemo(
    () => data.platformConnections.filter((c) => c.account_id === currentAccountId),
    [data.platformConnections, currentAccountId]
  );
  const lcConnection = myConnections.find((c) => c.platform === "LeetCode");
  const gfgConnection = myConnections.find((c) => c.platform === "GeeksforGeeks");

  const myProfile = data.profiles.find((p) => p.account_id === currentAccountId);
  const friendId = myProfile?.rival_user_id;
  const friend = users.find((u) => u.id === friendId);

  useEffect(() => {
    if (lcConnection) setLcUsername(lcConnection.platform_username);
    if (gfgConnection) setGfgUsername(gfgConnection.platform_username);
  }, [lcConnection, gfgConnection]);

  const connectPlatform = async (platform: "LeetCode" | "GeeksforGeeks", username: string) => {
    if (!username.trim()) {
      toast.error(`Please enter your ${platform} username`);
      return;
    }
    setConnecting((s) => ({ ...s, [platform]: true }));
    try {
      const apiPlatform = platform === "LeetCode" ? "leetcode" : "gfg";
      const res = await fetch(`/api/platform-stats?platform=${apiPlatform}&username=${encodeURIComponent(username.trim())}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to fetch" }));
        if (platform === "GeeksforGeeks") {
          setGfgManualMode(true);
          toast.info("GFG auto-fetch unavailable. Enter your stats manually.", { duration: 5000 });
          return;
        }
        throw new Error(err.error || "Could not verify username");
      }
      const stats = await res.json();

      const existing = myConnections.find((c) => c.platform === platform);
      if (existing) {
        await supabase
          .from("platform_connections" as any)
          .update({ platform_username: username.trim(), stats, last_synced_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("platform_connections" as any)
          .insert({
            account_id: currentAccountId,
            platform,
            platform_username: username.trim(),
            stats,
            last_synced_at: new Date().toISOString(),
          });
      }

      toast.success(`${platform} connected!`, {
        description: `Tracking ${stats.totalSolved} problems solved by ${username.trim()}.`,
      });
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setConnecting((s) => ({ ...s, [platform]: false }));
    }
  };

  const syncStats = async (connection: PlatformConnection) => {
    setSyncing((s) => ({ ...s, [connection.platform]: true }));
    try {
      const apiPlatform = connection.platform === "LeetCode" ? "leetcode" : "gfg";
      const res = await fetch(
        `/api/platform-stats?platform=${apiPlatform}&username=${encodeURIComponent(connection.platform_username)}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Sync failed" }));
        if (connection.platform === "GeeksforGeeks") {
          toast.info("GFG auto-sync unavailable. Disconnect and re-enter stats manually.", { duration: 5000 });
          return;
        }
        throw new Error(err.error || "Sync failed");
      }
      const stats = await res.json();

      await supabase
        .from("platform_connections" as any)
        .update({ stats, last_synced_at: new Date().toISOString() })
        .eq("id", connection.id);

      toast.success(`${connection.platform} synced!`, {
        description: `${stats.totalSolved} total problems tracked.`,
      });
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing((s) => ({ ...s, [connection.platform]: false }));
    }
  };

  const disconnectPlatform = async (connection: PlatformConnection) => {
    await supabase
      .from("platform_connections" as any)
      .delete()
      .eq("id", connection.id);
    toast.success(`${connection.platform} disconnected`);
    setGfgManualMode(false);
    await onRefresh();
  };

  const saveGfgManual = async () => {
    if (!gfgUsername.trim()) {
      toast.error("Please enter your GFG username");
      return;
    }
    const stats: GfgStats = {
      platform: "GeeksforGeeks",
      username: gfgUsername.trim(),
      totalSolved: parseInt(gfgManualStats.totalSolved || "0", 10),
      easySolved: parseInt(gfgManualStats.easySolved || "0", 10),
      mediumSolved: parseInt(gfgManualStats.mediumSolved || "0", 10),
      hardSolved: parseInt(gfgManualStats.hardSolved || "0", 10),
      codingScore: parseInt(gfgManualStats.codingScore || "0", 10),
      totalScore: 0,
      monthlyScore: 0,
      instituteRank: "--",
    };

    const existing = myConnections.find((c) => c.platform === "GeeksforGeeks");
    if (existing) {
      await supabase
        .from("platform_connections" as any)
        .update({ platform_username: gfgUsername.trim(), stats, last_synced_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("platform_connections" as any)
        .insert({
          account_id: currentAccountId,
          platform: "GeeksforGeeks",
          platform_username: gfgUsername.trim(),
          stats,
          last_synced_at: new Date().toISOString(),
        });
    }

    toast.success("GFG stats saved!", { description: `${stats.totalSolved} problems tracked.` });
    setGfgManualMode(false);
    await onRefresh();
  };

  const squadPlatformRanking = useMemo(() => {
    return users.map((u) => {
      const connections = data.platformConnections.filter((c) => c.account_id === u.id);
      let totalSolved = 0;
      let lcSolved = 0;
      let gfgSolved = 0;
      for (const c of connections) {
        const s = c.stats;
        if (s) {
          totalSolved += s.totalSolved;
          if (s.platform === "LeetCode") lcSolved = s.totalSolved;
          else gfgSolved = s.totalSolved;
        }
      }
      return { ...u, totalSolved, lcSolved, gfgSolved, connections };
    }).sort((a, b) => b.totalSolved - a.totalSolved);
  }, [users, data.platformConnections]);

  const lcStats = lcConnection?.stats as LeetCodeStats | undefined;
  const gfgStats = gfgConnection?.stats as GfgStats | undefined;

  return (
    <section className="animate-enter space-y-6">
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-xl text-primary-foreground shadow-glow">
            <Globe />
          </div>
          <div>
            <h2 className="text-3xl font-black">Platform Stats</h2>
            <p className="text-sm text-muted-foreground">
              Connect your LeetCode & GeeksforGeeks to auto-track your journey.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className={`glass-panel rounded-2xl p-5 transition-all ${lcConnection ? "border-l-4 border-l-[#FFA116]" : ""}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[#FFA116]/20 text-lg font-black text-[#FFA116]">
                LC
              </div>
              <div>
                <h3 className="text-lg font-bold">LeetCode</h3>
                {lcConnection && (
                  <p className="text-xs text-muted-foreground">
                    @{lcConnection.platform_username} · synced{" "}
                    {lcConnection.last_synced_at
                      ? new Date(lcConnection.last_synced_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "never"}
                  </p>
                )}
              </div>
            </div>
            {lcConnection && (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => syncStats(lcConnection)}
                  disabled={!!syncing.LeetCode}
                >
                  <RefreshCw className={`size-4 ${syncing.LeetCode ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => disconnectPlatform(lcConnection)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {!lcConnection ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={lcUsername}
                onChange={(e) => setLcUsername(e.target.value)}
                className="h-11 flex-1 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-[#FFA116]/30"
                placeholder="Your LeetCode username"
              />
              <Button
                variant="rival"
                className="bg-[#FFA116] hover:bg-[#FFB84D] text-black"
                onClick={() => connectPlatform("LeetCode", lcUsername)}
                disabled={!!connecting.LeetCode}
              >
                {connecting.LeetCode ? <Loader2 className="animate-spin" /> : <Link2 />} Connect
              </Button>
            </div>
          ) : lcStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3">
                  <p className="text-2xl font-black text-green-400">{lcStats.easySolved}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Easy</p>
                </div>
                <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3">
                  <p className="text-2xl font-black text-yellow-400">{lcStats.mediumSolved}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Medium</p>
                </div>
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-2xl font-black text-red-400">{lcStats.hardSolved}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hard</p>
                </div>
              </div>

              <div className="space-y-2">
                <DifficultyBar label="Easy" solved={lcStats.easySolved} total={lcStats.easyTotal} color="bg-green-500" />
                <DifficultyBar label="Medium" solved={lcStats.mediumSolved} total={lcStats.mediumTotal} color="bg-yellow-500" />
                <DifficultyBar label="Hard" solved={lcStats.hardSolved} total={lcStats.hardTotal} color="bg-red-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">Total Solved</p>
                  <p className="text-xl font-black">{lcStats.totalSolved}<span className="text-xs text-muted-foreground font-normal"> / {lcStats.totalQuestions}</span></p>
                </div>
                <div className="rounded-lg bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">Global Rank</p>
                  <p className="text-xl font-black">#{lcStats.ranking.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Connected. Click sync to fetch stats.</p>
          )}
        </div>

        <div className={`glass-panel rounded-2xl p-5 transition-all ${gfgConnection ? "border-l-4 border-l-[#2F8D46]" : ""}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[#2F8D46]/20 text-lg font-black text-[#2F8D46]">
                GFG
              </div>
              <div>
                <h3 className="text-lg font-bold">GeeksforGeeks</h3>
                {gfgConnection && (
                  <p className="text-xs text-muted-foreground">
                    @{gfgConnection.platform_username} · synced{" "}
                    {gfgConnection.last_synced_at
                      ? new Date(gfgConnection.last_synced_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "never"}
                  </p>
                )}
              </div>
            </div>
            {gfgConnection && (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => syncStats(gfgConnection)}
                  disabled={!!syncing.GeeksforGeeks}
                >
                  <RefreshCw className={`size-4 ${syncing.GeeksforGeeks ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => disconnectPlatform(gfgConnection)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {!gfgConnection ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={gfgUsername}
                  onChange={(e) => setGfgUsername(e.target.value)}
                  className="h-11 flex-1 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-[#2F8D46]/30"
                  placeholder="Your GFG username"
                />
                <Button
                  variant="rival"
                  className="bg-[#2F8D46] hover:bg-[#3AA856] text-white"
                  onClick={() => connectPlatform("GeeksforGeeks", gfgUsername)}
                  disabled={!!connecting.GeeksforGeeks}
                >
                  {connecting.GeeksforGeeks ? <Loader2 className="animate-spin" /> : <Link2 />} Connect
                </Button>
              </div>
              {gfgManualMode && (
                <div className="rounded-xl border border-[#2F8D46]/30 bg-[#2F8D46]/5 p-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    GFG doesn't have a public API. Enter your stats from your{" "}
                    <a href={`https://www.geeksforgeeks.org/user/${gfgUsername.trim()}/`} target="_blank" className="text-[#2F8D46] underline">profile page</a>.
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <input placeholder="Total Solved" className="h-9 rounded-lg border border-input bg-background/70 px-2 text-sm" value={gfgManualStats.totalSolved} onChange={(e) => setGfgManualStats((s) => ({ ...s, totalSolved: e.target.value }))} />
                    <input placeholder="Easy" className="h-9 rounded-lg border border-input bg-background/70 px-2 text-sm" value={gfgManualStats.easySolved} onChange={(e) => setGfgManualStats((s) => ({ ...s, easySolved: e.target.value }))} />
                    <input placeholder="Medium" className="h-9 rounded-lg border border-input bg-background/70 px-2 text-sm" value={gfgManualStats.mediumSolved} onChange={(e) => setGfgManualStats((s) => ({ ...s, mediumSolved: e.target.value }))} />
                    <input placeholder="Hard" className="h-9 rounded-lg border border-input bg-background/70 px-2 text-sm" value={gfgManualStats.hardSolved} onChange={(e) => setGfgManualStats((s) => ({ ...s, hardSolved: e.target.value }))} />
                    <input placeholder="Coding Score" className="h-9 rounded-lg border border-input bg-background/70 px-2 text-sm" value={gfgManualStats.codingScore} onChange={(e) => setGfgManualStats((s) => ({ ...s, codingScore: e.target.value }))} />
                  </div>
                  <Button variant="rival" className="bg-[#2F8D46] hover:bg-[#3AA856] text-white w-full" onClick={saveGfgManual}>
                    Save GFG Stats
                  </Button>
                </div>
              )}
              {!gfgManualMode && (
                <button onClick={() => setGfgManualMode(true)} className="text-xs text-muted-foreground hover:text-[#2F8D46] transition">
                  Or enter stats manually →
                </button>
              )}
            </div>
          ) : gfgStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3">
                  <p className="text-2xl font-black text-green-400">{gfgStats.easySolved}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Easy</p>
                </div>
                <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3">
                  <p className="text-2xl font-black text-yellow-400">{gfgStats.mediumSolved}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Medium</p>
                </div>
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-2xl font-black text-red-400">{gfgStats.hardSolved}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hard</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">Total Solved</p>
                  <p className="text-xl font-black">{gfgStats.totalSolved}</p>
                </div>
                <div className="rounded-lg bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">Coding Score</p>
                  <p className="text-xl font-black">{gfgStats.codingScore}</p>
                </div>
                <div className="rounded-lg bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">Institute Rank</p>
                  <p className="text-xl font-black">#{gfgStats.instituteRank}</p>
                </div>
                <div className="rounded-lg bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">Monthly Score</p>
                  <p className="text-xl font-black">{gfgStats.monthlyScore}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Connected. Click sync to fetch stats.</p>
          )}
        </div>
      </div>

      {(lcStats || gfgStats) && (
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-2xl font-black mb-6 flex items-center gap-2">
            <Target className="size-6 text-primary" /> Combined Stats
          </h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="card-gradient rounded-2xl border border-border p-5 shadow-card transition hover:-translate-y-1">
              <Trophy className="mb-4 size-5 text-primary" />
              <p className="text-sm text-muted-foreground">Total Solved</p>
              <p className="mt-1 text-3xl font-black">
                {(lcStats?.totalSolved ?? 0) + (gfgStats?.totalSolved ?? 0)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                LC: {lcStats?.totalSolved ?? 0} · GFG: {gfgStats?.totalSolved ?? 0}
              </p>
            </div>
            <div className="card-gradient rounded-2xl border border-border p-5 shadow-card transition hover:-translate-y-1">
              <Zap className="mb-4 size-5 text-green-400" />
              <p className="text-sm text-muted-foreground">Easy Total</p>
              <p className="mt-1 text-3xl font-black text-green-400">
                {(lcStats?.easySolved ?? 0) + (gfgStats?.easySolved ?? 0)}
              </p>
            </div>
            <div className="card-gradient rounded-2xl border border-border p-5 shadow-card transition hover:-translate-y-1">
              <Activity className="mb-4 size-5 text-yellow-400" />
              <p className="text-sm text-muted-foreground">Medium Total</p>
              <p className="mt-1 text-3xl font-black text-yellow-400">
                {(lcStats?.mediumSolved ?? 0) + (gfgStats?.mediumSolved ?? 0)}
              </p>
            </div>
            <div className="card-gradient rounded-2xl border border-border p-5 shadow-card transition hover:-translate-y-1">
              <Flame className="mb-4 size-5 text-red-400" />
              <p className="text-sm text-muted-foreground">Hard Total</p>
              <p className="mt-1 text-3xl font-black text-red-400">
                {(lcStats?.hardSolved ?? 0) + (gfgStats?.hardSolved ?? 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {squadPlatformRanking.some((u) => u.totalSolved > 0) && (
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
            <Medal className="size-6 text-accent" /> Platform Leaderboard
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Rankings based on combined LeetCode + GFG problems solved by the squad.
          </p>
          <div className="space-y-3">
            {squadPlatformRanking.map((member, index) => {
              const isMe = member.id === currentAccountId;
              const hasStats = member.totalSolved > 0;
              if (!hasStats) return null;

              return (
                <div
                  key={member.id}
                  className={`flex items-center justify-between rounded-xl p-4 transition-all ${
                    index === 0
                      ? "bg-primary/20 border-2 border-primary shadow-glow scale-[1.01]"
                      : isMe
                        ? "bg-primary/10 border border-primary/50"
                        : "bg-card/70 border border-border"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-black italic text-primary/50 w-8">
                      #{index + 1}
                    </span>
                    <span className="text-2xl">{member.emoji}</span>
                    <div>
                      <p className="font-bold">
                        {member.name} {isMe && <span className="text-xs text-primary">(you)</span>}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {member.lcSolved > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFA116]/10 px-2 py-0.5 text-[#FFA116] text-[10px] font-bold">
                            LC {member.lcSolved}
                          </span>
                        )}
                        {member.gfgSolved > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#2F8D46]/10 px-2 py-0.5 text-[#2F8D46] text-[10px] font-bold">
                            GFG {member.gfgSolved}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black">{member.totalSolved}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Total
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {friend && (lcStats || gfgStats) && (() => {
        const friendConnections = data.platformConnections.filter((c) => c.account_id === friendId);
        const friendLc = friendConnections.find((c) => c.platform === "LeetCode")?.stats as LeetCodeStats | undefined;
        const friendGfg = friendConnections.find((c) => c.platform === "GeeksforGeeks")?.stats as GfgStats | undefined;
        const myTotal = (lcStats?.totalSolved ?? 0) + (gfgStats?.totalSolved ?? 0);
        const friendTotal = (friendLc?.totalSolved ?? 0) + (friendGfg?.totalSolved ?? 0);
        const hasAny = friendLc || friendGfg;

        if (!hasAny) return (
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
              <Swords className="size-6 text-accent" /> Duo Comparison
            </h3>
            <p className="text-sm text-muted-foreground">
              {friend.emoji} {friend.name} hasn't connected any platforms yet. Invite them to connect!
            </p>
          </div>
        );

        return (
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-2xl font-black mb-6 flex items-center gap-2">
              <Swords className="size-6 text-accent" /> Duo Platform Comparison
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className={`rounded-2xl border p-5 transition ${myTotal >= friendTotal ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card/50"}`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{users.find((u) => u.id === currentAccountId)?.emoji}</span>
                  <div>
                    <p className="font-bold">You</p>
                    <p className="text-xs text-muted-foreground">
                      {lcStats ? `LC: ${lcStats.totalSolved}` : ""}{lcStats && gfgStats ? " · " : ""}{gfgStats ? `GFG: ${gfgStats.totalSolved}` : ""}
                    </p>
                  </div>
                  <p className="ml-auto text-4xl font-black">{myTotal}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-green-500/10 p-2"><p className="text-lg font-black text-green-400">{(lcStats?.easySolved ?? 0) + (gfgStats?.easySolved ?? 0)}</p><p className="text-muted-foreground">Easy</p></div>
                  <div className="rounded-lg bg-yellow-500/10 p-2"><p className="text-lg font-black text-yellow-400">{(lcStats?.mediumSolved ?? 0) + (gfgStats?.mediumSolved ?? 0)}</p><p className="text-muted-foreground">Med</p></div>
                  <div className="rounded-lg bg-red-500/10 p-2"><p className="text-lg font-black text-red-400">{(lcStats?.hardSolved ?? 0) + (gfgStats?.hardSolved ?? 0)}</p><p className="text-muted-foreground">Hard</p></div>
                </div>
              </div>
              <div className={`rounded-2xl border p-5 transition ${friendTotal > myTotal ? "border-accent bg-accent/10 shadow-glow" : "border-border bg-card/50"}`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{friend.emoji}</span>
                  <div>
                    <p className="font-bold">{friend.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {friendLc ? `LC: ${friendLc.totalSolved}` : ""}{friendLc && friendGfg ? " · " : ""}{friendGfg ? `GFG: ${friendGfg.totalSolved}` : ""}
                    </p>
                  </div>
                  <p className="ml-auto text-4xl font-black">{friendTotal}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-green-500/10 p-2"><p className="text-lg font-black text-green-400">{(friendLc?.easySolved ?? 0) + (friendGfg?.easySolved ?? 0)}</p><p className="text-muted-foreground">Easy</p></div>
                  <div className="rounded-lg bg-yellow-500/10 p-2"><p className="text-lg font-black text-yellow-400">{(friendLc?.mediumSolved ?? 0) + (friendGfg?.mediumSolved ?? 0)}</p><p className="text-muted-foreground">Med</p></div>
                  <div className="rounded-lg bg-red-500/10 p-2"><p className="text-lg font-black text-red-400">{(friendLc?.hardSolved ?? 0) + (friendGfg?.hardSolved ?? 0)}</p><p className="text-muted-foreground">Hard</p></div>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-secondary/20 p-4">
              <div className="flex items-center justify-between mb-2 text-sm font-semibold">
                <span>You: {myTotal}</span>
                <span className="text-xs text-muted-foreground">
                  {myTotal > friendTotal ? `You're ahead by ${myTotal - friendTotal}! 🔥` : myTotal < friendTotal ? `${friend.name} leads by ${friendTotal - myTotal} 😤` : "It's a tie! ⚡"}
                </span>
                <span>{friend.name}: {friendTotal}</span>
              </div>
              <div className="h-3 rounded-full bg-secondary/30 overflow-hidden flex">
                <div className="h-full bg-primary rounded-l-full transition-all duration-1000" style={{ width: `${myTotal + friendTotal > 0 ? (myTotal / (myTotal + friendTotal)) * 100 : 50}%` }} />
                <div className="h-full bg-accent rounded-r-full transition-all duration-1000" style={{ width: `${myTotal + friendTotal > 0 ? (friendTotal / (myTotal + friendTotal)) * 100 : 50}%` }} />
              </div>
            </div>
          </div>
        );
      })()}

      {!lcConnection && !gfgConnection && (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <Globe className="mx-auto mb-4 size-12 text-muted-foreground/40" />
          <h3 className="text-xl font-bold mb-2">No platforms connected yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Connect your LeetCode and GeeksforGeeks accounts above to automatically track your
            problem-solving stats and compete with the squad on a whole new level.
          </p>
        </div>
      )}
    </section>
  );
}
