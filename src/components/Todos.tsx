"use client";

import { CalendarDays, Check, ClipboardList, Plus, Save, Trash2, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { emptyTodo, loadTodos, saveTodos, todayKey, type TodoEntry } from "@/lib/todos";

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`));
}

export function Todos({ currentAccountId }: { currentAccountId: string }) {
  const [todos, setTodos] = useState<Record<string, TodoEntry>>({});
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [draft, setDraft] = useState<TodoEntry>(() => emptyTodo(todayKey()));

  useEffect(() => {
    const saved = loadTodos(currentAccountId);
    setTodos(saved);
    setDraft(saved[selectedDate] ?? emptyTodo(selectedDate));
  }, [currentAccountId, selectedDate]);

  const dates = useMemo(() => Array.from(new Set([selectedDate, ...Object.keys(todos)])).sort((a, b) => b.localeCompare(a)), [selectedDate, todos]);
  const updateDraft = (changes: Partial<TodoEntry>) => setDraft((current) => ({ ...current, ...changes }));
  const chooseDate = (date: string) => {
    setSelectedDate(date);
    setDraft(todos[date] ?? emptyTodo(date));
  };
  const saveDraft = () => {
    const next = { ...todos, [selectedDate]: { ...draft, date: selectedDate, updatedAt: new Date().toISOString() } };
    setTodos(next);
    setDraft(next[selectedDate]);
    saveTodos(currentAccountId, next);
  };
  const deleteDay = () => {
    const next = { ...todos };
    delete next[selectedDate];
    setTodos(next);
    setDraft(emptyTodo(selectedDate));
    saveTodos(currentAccountId, next);
  };

  return (
    <section className="animate-enter space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary"><ClipboardList className="size-4" /> Personal workspace</p>
          <h3 className="text-4xl font-black">Todos</h3>
          <p className="mt-2 max-w-xl text-muted-foreground">Plan the day clearly, then keep the record for every day you show up.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"><WifiOff className="size-4" /> Saved offline</div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="glass-panel rounded-2xl p-4">
          <div className="mb-4 flex items-center justify-between"><p className="font-bold">All days</p><CalendarDays className="size-4 text-primary" /></div>
          <div className="space-y-1">
            {dates.map((date) => (
              <button key={date} type="button" onClick={() => chooseDate(date)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${date === selectedDate ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                <span>{formatDate(date)}</span>
                {todos[date]?.bulletPoints.length ? <span className="text-xs opacity-70">{todos[date].bulletPoints.length}</span> : null}
              </button>
            ))}
          </div>
          <Button variant="outline" className="mt-4 w-full" onClick={() => chooseDate(todayKey())}><Plus /> Today</Button>
        </aside>
        <div className="glass-panel rounded-2xl p-5 sm:p-7">
          <div className="mb-6 flex flex-col justify-between gap-3 border-b border-border pb-5 sm:flex-row sm:items-center">
            <div><p className="text-sm text-muted-foreground">Daily plan</p><h4 className="text-2xl font-black">{formatDate(selectedDate)}</h4></div>
            <input aria-label="Choose todo date" type="date" value={selectedDate} onChange={(event) => chooseDate(event.target.value)} className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid gap-5">
            <label className="grid gap-2 text-sm font-semibold">Heading<input value={draft.heading} onChange={(event) => updateDraft({ heading: event.target.value })} placeholder="What matters today?" className="h-12 rounded-lg border border-input bg-background/50 px-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
            <label className="grid gap-2 text-sm font-semibold">Subheading<input value={draft.subheading} onChange={(event) => updateDraft({ subheading: event.target.value })} placeholder="A short intention for the day" className="h-12 rounded-lg border border-input bg-background/50 px-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
            <label className="grid gap-2 text-sm font-semibold">Body<textarea value={draft.body} onChange={(event) => updateDraft({ body: event.target.value })} placeholder="Add context, notes, or a plan..." rows={5} className="resize-y rounded-lg border border-input bg-background/50 p-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
            <label className="grid gap-2 text-sm font-semibold">Bullet points<span className="text-xs font-normal text-muted-foreground">One item per line</span><textarea value={draft.bulletPoints.join("\n")} onChange={(event) => updateDraft({ bulletPoints: event.target.value.split("\n") })} placeholder={"Review yesterday's work\nSolve two problems\nWrite tomorrow's plan"} rows={6} className="resize-y rounded-lg border border-input bg-background/50 p-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
          </div>
          <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-border pt-5"><Button variant="ghost" className="text-destructive hover:text-destructive" onClick={deleteDay} disabled={!todos[selectedDate]}><Trash2 /> Delete day</Button><Button variant="rival" onClick={saveDraft}><Save /> Save todo <Check className="size-4" /></Button></div>
        </div>
      </div>
    </section>
  );
}