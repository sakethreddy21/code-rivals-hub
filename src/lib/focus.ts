import { supabase } from "@/integrations/supabase/client";

export type FocusMode = "focus" | "break" | "longBreak";

export type FocusSession = {
  id: string;
  type: "focus" | "break";
  startedAt: string;
  durationSec: number;
  completed: boolean;
  task?: string;
  plannedSec?: number;
  isLongBreak?: boolean;
};

function newFocusSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;
}

export type FocusSettings = {
  focusMin: number;
  breakMin: number;
  longBreakMin: number;
  longBreakEvery: number;
  autoStartNext: boolean;
  dailyGoalMin: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
};

export const FOCUS_DEFAULTS: FocusSettings = {
  focusMin: 25,
  breakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
  autoStartNext: false,
  dailyGoalMin: 120,
  soundEnabled: true,
  notificationsEnabled: false,
};

export function focusSettingsKey(id: string) { return `focus_settings_${id}`; }
export function focusSessionsKey(id: string) { return `focus_sessions_${id}`; }
export function focusTaskKey(id: string) { return `focus_current_task_${id}`; }
export function focusTasksKey(id: string) { return `focus_task_list_${id}`; }

export function loadFocusTasks(accountId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(focusTasksKey(accountId));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((s: unknown) => typeof s === "string" && (s as string).trim());
    }
  } catch {}
  return [];
}

export function loadFocusSettings(accountId: string): FocusSettings {
  if (typeof window === "undefined") return FOCUS_DEFAULTS;
  try {
    const raw = localStorage.getItem(focusSettingsKey(accountId));
    if (raw) return { ...FOCUS_DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return FOCUS_DEFAULTS;
}

export function loadFocusSessions(accountId: string): FocusSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(focusSessionsKey(accountId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    let mutated = false;
    const fixed: FocusSession[] = arr.map((s: FocusSession) => {
      if (s && typeof s.id === "string" && s.id) return s;
      mutated = true;
      return { ...s, id: newFocusSessionId() };
    });
    if (mutated) localStorage.setItem(focusSessionsKey(accountId), JSON.stringify(fixed));
    return fixed;
  } catch {}
  return [];
}

export function appendFocusSession(
  accountId: string,
  input: Omit<FocusSession, "id"> & { id?: string },
): FocusSession {
  const session: FocusSession = { ...input, id: input.id ?? newFocusSessionId() };
  const all = loadFocusSessions(accountId);
  const idx = all.findIndex((s) => s.id === session.id);
  if (idx >= 0) all[idx] = session;
  else all.push(session);
  localStorage.setItem(focusSessionsKey(accountId), JSON.stringify(all));
  void pushFocusSessionToCloud(accountId, session);
  return session;
}

async function pushFocusSessionToCloud(accountId: string, s: FocusSession): Promise<void> {
  try {
    await supabase.from("focus_sessions" as any).upsert({
      id: s.id,
      account_id: accountId,
      type: s.type,
      started_at: s.startedAt,
      duration_sec: s.durationSec,
      completed: s.completed,
      task: s.task ?? null,
      planned_sec: s.plannedSec ?? null,
      is_long_break: !!s.isLongBreak,
      updated_at: new Date().toISOString(),
    });
  } catch {}
}

export async function syncFocusSessionsFromCloud(accountId: string): Promise<FocusSession[]> {
  if (typeof window === "undefined" || !accountId) return [];
  try {
    const { data, error } = await supabase
      .from("focus_sessions" as any)
      .select("*")
      .eq("account_id", accountId);
    if (error) throw error;
    const remote: FocusSession[] = ((data as unknown as Array<Record<string, unknown>>) ?? []).map((r) => ({
      id: String(r.id),
      type: (r.type as "focus" | "break"),
      startedAt: String(r.started_at),
      durationSec: Number(r.duration_sec) || 0,
      completed: !!r.completed,
      task: (r.task as string | null) ?? undefined,
      plannedSec: r.planned_sec == null ? undefined : Number(r.planned_sec),
      isLongBreak: r.is_long_break ? true : undefined,
    }));
    const local = loadFocusSessions(accountId);
    const map = new Map<string, FocusSession>();
    for (const s of local) map.set(s.id, s);
    for (const s of remote) if (!map.has(s.id)) map.set(s.id, s);
    const remoteIds = new Set(remote.map((r) => r.id));
    for (const s of local) if (!remoteIds.has(s.id)) void pushFocusSessionToCloud(accountId, s);
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );
    localStorage.setItem(focusSessionsKey(accountId), JSON.stringify(merged));
    return merged;
  } catch {}
  return loadFocusSessions(accountId);
}

export function playFocusChime() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [880, 1320].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      const t0 = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      o.start(t0); o.stop(t0 + 0.5);
    });
    setTimeout(() => ctx.close(), 900);
  } catch {}
}

export function notifyFocus(title: string, body: string) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") new Notification(title, { body, silent: true });
  } catch {}
}

export function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
