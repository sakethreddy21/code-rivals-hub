"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flame, Globe, Play, Volume2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MutualUser } from "@/types/rivals";
import type { userStats } from "@/lib/rivals";

export function StatCard({ label, value, Icon }: { label: string; value: React.ReactNode; Icon: LucideIcon }) {
  return <div className="card-gradient rounded-2xl border border-border p-5 shadow-card transition hover:-translate-y-1"><Icon className="mb-4 size-5 text-primary" /><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>;
}

// ── Nudge definitions ──────────────────────────────────────────────────────
const NUDGES = [
  { name: "🔥 Wake Up!", track: "/audio1.m4a", description: "Classic fire alarm" },
  { name: "😤 Get Cooking", track: "/audio2.m4a", description: "They need motivation" },
  { name: "💀 You're falling behind", track: "/audio3.m4a", description: "The disrespect nudge" },
  { 
    name: "aee-main-ajau-kya-apni-par-salman-khan-angry-meme-template-for-made-with-Voicemod.mp3", 
    track: "/aee-main-ajau-kya-apni-par-salman-khan-angry-meme-template-for-made-with-Voicemod.mp3", 
    description: "Custom angry meme nudge" 
  },
] as const;

type Nudge = typeof NUDGES[number];

export function MutualCard({
  user,
  stats,
  platformTotal = 0,
  highlight,
  onTaunt,
  isOnline,
}: {
  user: MutualUser;
  stats: ReturnType<typeof userStats>;
  platformTotal?: number;
  highlight?: boolean;
  onTaunt?: (track: string, nudgeName: string) => void;
  isOnline?: boolean;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    
    // The dropdown is w-64 (256px). Align right edges, with safety margins.
    let left = rect.right - 256; 
    let top = rect.bottom + 8; // 8px space below the trigger button
    
    // Boundary checks to prevent off-screen rendering
    if (left < 10) {
      left = 10;
    }
    if (left + 256 > window.innerWidth - 10) {
      left = window.innerWidth - 266;
    }
    
    // Position above the trigger button if it clips the bottom of the viewport
    if (top + 250 > window.innerHeight && rect.top > 250) {
      top = rect.top - 250 - 8;
    }
    
    setCoords({ top, left });
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  // Recalculate coordinates on open, scroll, or resize
  useEffect(() => {
    if (!dropdownOpen) return;
    
    updatePosition();
    
    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true); // capture to catch scroll inside containers
    
    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [dropdownOpen]);

  const previewNudge = (nudge: Nudge, e: React.MouseEvent) => {
    e.stopPropagation();
    // Stop any currently playing preview
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (previewPlaying === nudge.track) {
      setPreviewPlaying(null);
      return;
    }
    const audio = new Audio(nudge.track);
    audioRef.current = audio;
    audio.play().catch(() => {});
    setPreviewPlaying(nudge.track);
    audio.addEventListener("ended", () => setPreviewPlaying(null));
  };

  const sendNudge = (nudge: Nudge) => {
    // Stop preview if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPreviewPlaying(null);
    setDropdownOpen(false);
    onTaunt?.(nudge.track, nudge.name);
  };

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
          <div className="relative">
            {/* Fire button — opens dropdown */}
            <Button
              ref={triggerRef}
              variant="ghost"
              size="icon"
              className={`h-8 w-8 transition-all ${dropdownOpen ? "text-orange-400 bg-orange-500/20" : "text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"}`}
              onClick={() => setDropdownOpen((o) => !o)}
              title="Send a nudge"
            >
              <Flame className="size-4" />
            </Button>

            {/* Nudge Dropdown in Portal */}
            {dropdownOpen && coords &&
              createPortal(
                <div
                  ref={dropdownRef}
                  style={{
                    position: "fixed",
                    top: `${coords.top}px`,
                    left: `${coords.left}px`,
                  }}
                  className="z-[9999] w-64 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-2xl animate-in fade-in zoom-in-95 duration-100"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      🔔 Pick a Nudge
                    </span>
                    <button
                      onClick={() => setDropdownOpen(false)}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground transition"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {/* Nudge options */}
                  <ul className="p-1.5 space-y-1">
                    {NUDGES.map((nudge) => (
                      <li key={nudge.track}>
                        <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-secondary/60 transition group">
                          {/* Preview button */}
                          <button
                            onClick={(e) => previewNudge(nudge, e)}
                            title="Preview audio"
                            className={`flex shrink-0 items-center justify-center rounded-md p-1.5 transition border ${
                              previewPlaying === nudge.track
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/30 hover:text-primary"
                            }`}
                          >
                            {previewPlaying === nudge.track ? (
                              <Volume2 className="size-3 animate-pulse" />
                            ) : (
                              <Play className="size-3" />
                            )}
                          </button>

                          {/* Nudge info — click to send */}
                          <button
                            onClick={() => sendNudge(nudge)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className="text-sm font-bold leading-tight truncate">{nudge.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{nudge.description}</p>
                          </button>

                          {/* Send button */}
                          <button
                            onClick={() => sendNudge(nudge)}
                            className="shrink-0 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-[10px] font-black text-orange-400 opacity-0 group-hover:opacity-100 transition hover:bg-orange-500/20"
                          >
                            Send
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Footer hint */}
                  <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                    ▶ Preview · Click name or Send to fire
                  </div>
                </div>,
                document.body
              )
            }
          </div>
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
