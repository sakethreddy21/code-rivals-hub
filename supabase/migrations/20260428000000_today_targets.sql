-- Shared daily target links (one row per day, same for all users)
CREATE TABLE IF NOT EXISTS public.today_targets (
  day  TEXT NOT NULL PRIMARY KEY,          -- YYYY-MM-DD
  links JSONB NOT NULL DEFAULT '[]'::jsonb, -- up to 4 problem URLs
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Per-user solved status for each slot
CREATE TABLE IF NOT EXISTS public.today_target_solutions (
  day        TEXT    NOT NULL,
  slot       INTEGER NOT NULL CHECK (slot BETWEEN 0 AND 3),
  account_id UUID    NOT NULL,
  solved     BOOLEAN NOT NULL DEFAULT false,
  solved_at  TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (day, slot, account_id)
);

CREATE INDEX IF NOT EXISTS idx_today_targets_day ON public.today_targets(day);
CREATE INDEX IF NOT EXISTS idx_today_target_solutions_day ON public.today_target_solutions(day, account_id);

-- Allow all operations for anon (app uses custom auth, not Supabase Auth)
ALTER TABLE public.today_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.today_target_solutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read today_targets"
  ON public.today_targets FOR SELECT USING (true);

CREATE POLICY "Anyone can upsert today_targets"
  ON public.today_targets FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update today_targets"
  ON public.today_targets FOR UPDATE USING (true);

CREATE POLICY "Anyone can read today_target_solutions"
  ON public.today_target_solutions FOR SELECT USING (true);

CREATE POLICY "Anyone can upsert today_target_solutions"
  ON public.today_target_solutions FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update today_target_solutions"
  ON public.today_target_solutions FOR UPDATE USING (true);
