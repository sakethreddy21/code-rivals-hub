"use client";

import React from "react";
import { Flame, Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MutualUser } from "@/types/rivals";
import type { userStats } from "@/lib/rivals";

export function StatCard({ label, value, Icon }: { label: string; value: React.ReactNode; Icon: LucideIcon }) {
  return <div className="card-gradient rounded-2xl border border-border p-5 shadow-card transition hover:-translate-y-1"><Icon className="mb-4 size-5 text-primary" /><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>;
}

export function MutualCard({ user, stats, platformTotal = 0, highlight, onTaunt, isOnline }: { user: MutualUser; stats: ReturnType<typeof userStats>; platformTotal?: number; highlight?: boolean; onTaunt?: () => void; isOnline?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border p-5 ${highlight ? "border-primary bg-primary/10" : "border-border bg-card/70"}`}>
      {isOnline && (
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-accent/20 border border-accent/30 px-2 py-0.5 text-[8px] font-black text-accent shadow-glow animate-in fade-in zoom-in">
          <div className="size-1.5 rounded-full bg-accent animate-pulse" />
          LIVE
        </div>
      )}
      {platformTotal > 0 && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-background/50 px-2 py-1 text-[10px] font-black border border-border/50">
          <Globe className="size-3 text-primary" />
          {platformTotal} SOLVED
        </div>
      )}
      <div className="flex justify-between items-start">
        <div className="text-3xl">{user.emoji}</div>
        {onTaunt && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500 hover:text-orange-400 hover:bg-orange-500/10" onClick={onTaunt} title="Nudge / Taunt">
            <Flame className="size-4" />
          </Button>
        )}
      </div>
      <h4 className="mt-2 text-xl font-black">{user.name}</h4>
      <p className="text-sm text-muted-foreground">{user.title}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
        <span>
          {stats.xp}
          <small className="block text-muted-foreground uppercase text-[9px] tracking-widest font-bold">XP</small>
        </span>
        <span>
          {stats.week}
          <small className="block text-muted-foreground uppercase text-[9px] tracking-widest font-bold">Week</small>
        </span>
        <span>
          {stats.streak}
          <small className="block text-muted-foreground uppercase text-[9px] tracking-widest font-bold">Streak</small>
        </span>
      </div>
    </div>
  );
}

export function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-primary/30">{options.map((option) => <option key={option}>{option}</option>)}</select>;
}
