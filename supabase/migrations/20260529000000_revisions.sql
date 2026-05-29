-- Revisions tracking tables
CREATE TABLE IF NOT EXISTS public.revisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  problem_id UUID REFERENCES public.problems(id) ON DELETE CASCADE,
  name TEXT,
  link TEXT,
  platform TEXT,
  difficulty TEXT,
  topic TEXT,
  revised_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.today_revisions (
  id TEXT NOT NULL PRIMARY KEY,
  account_id UUID NOT NULL,
  day TEXT NOT NULL,
  problem_id UUID REFERENCES public.problems(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'Medium',
  topic TEXT NOT NULL DEFAULT 'DSA',
  done BOOLEAN NOT NULL DEFAULT false,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revisions_account_problem ON public.revisions(account_id, problem_id);
CREATE INDEX IF NOT EXISTS idx_revisions_revised_at ON public.revisions(revised_at DESC);
CREATE INDEX IF NOT EXISTS idx_today_revisions_account_day ON public.today_revisions(account_id, day);

ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.today_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read revisions" ON public.revisions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert revisions" ON public.revisions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update revisions" ON public.revisions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete revisions" ON public.revisions FOR DELETE USING (true);

CREATE POLICY "Anyone can read today_revisions" ON public.today_revisions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert today_revisions" ON public.today_revisions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update today_revisions" ON public.today_revisions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete today_revisions" ON public.today_revisions FOR DELETE USING (true);
