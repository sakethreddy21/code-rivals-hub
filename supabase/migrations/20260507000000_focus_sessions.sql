-- Per-account focus session log (synced across devices)
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id            UUID NOT NULL PRIMARY KEY,
  account_id    UUID NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('focus', 'break')),
  started_at    TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_sec  INTEGER NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT false,
  task          TEXT,
  planned_sec   INTEGER,
  is_long_break BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_account_started
  ON public.focus_sessions(account_id, started_at DESC);

-- App uses custom auth, not Supabase Auth — match today_targets policy style
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read focus_sessions"
  ON public.focus_sessions FOR SELECT USING (true);

CREATE POLICY "Anyone can insert focus_sessions"
  ON public.focus_sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update focus_sessions"
  ON public.focus_sessions FOR UPDATE USING (true);
