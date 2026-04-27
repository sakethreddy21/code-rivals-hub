CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🚀',
  title TEXT NOT NULL DEFAULT 'Algo Builder',
  rival_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_length CHECK (char_length(username) BETWEEN 3 AND 32),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[a-zA-Z0-9_]+$'),
  CONSTRAINT profiles_display_name_length CHECK (char_length(display_name) BETWEEN 1 AND 80),
  CONSTRAINT profiles_title_length CHECK (char_length(title) BETWEEN 1 AND 80),
  CONSTRAINT profiles_rival_user_id_not_self CHECK (rival_user_id IS NULL OR rival_user_id <> user_id)
);

CREATE TABLE public.problems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  topic TEXT NOT NULL,
  time_taken INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  solved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT problems_name_length CHECK (char_length(name) BETWEEN 1 AND 160),
  CONSTRAINT problems_platform_length CHECK (char_length(platform) BETWEEN 1 AND 80),
  CONSTRAINT problems_difficulty_valid CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  CONSTRAINT problems_topic_length CHECK (char_length(topic) BETWEEN 1 AND 80),
  CONSTRAINT problems_time_taken_range CHECK (time_taken BETWEEN 0 AND 1440)
);

CREATE TABLE public.challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  target INTEGER NOT NULL,
  topic TEXT NOT NULL,
  reward TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT challenges_title_length CHECK (char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT challenges_target_range CHECK (target BETWEEN 1 AND 1000),
  CONSTRAINT challenges_topic_length CHECK (char_length(topic) BETWEEN 1 AND 80),
  CONSTRAINT challenges_reward_length CHECK (char_length(reward) BETWEEN 1 AND 80)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_problems_updated_at
BEFORE UPDATE ON public.problems
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_challenges_updated_at
BEFORE UPDATE ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Signed-in users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Signed-in users can view solved problems"
ON public.problems
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can add their own solved problems"
ON public.problems
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own solved problems"
ON public.problems
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own solved problems"
ON public.problems
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Signed-in users can view challenges"
ON public.challenges
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_rival_user_id ON public.profiles(rival_user_id);
CREATE INDEX idx_problems_user_id_solved_at ON public.problems(user_id, solved_at DESC);
CREATE INDEX idx_problems_topic ON public.problems(topic);
CREATE INDEX idx_problems_difficulty ON public.problems(difficulty);

INSERT INTO public.challenges (title, target, topic, reward) VALUES
  ('Graph Sprint', 6, 'Graphs', '🧭 Pathfinder'),
  ('DP Discipline', 5, 'DP', '🧠 Memo Master'),
  ('Easy Speed Run', 8, 'Easy', '💨 Quick Draw');