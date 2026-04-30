-- Platform connections: stores LeetCode and GFG usernames per user
CREATE TABLE IF NOT EXISTS public.platform_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_username TEXT NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  stats JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT platform_connections_platform_valid CHECK (platform IN ('LeetCode', 'GeeksforGeeks')),
  CONSTRAINT platform_connections_unique UNIQUE (account_id, platform)
);

ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (for leaderboard / stats comparison)
CREATE POLICY "Anyone can view platform connections"
ON public.platform_connections
FOR SELECT
USING (true);

-- Allow anyone to insert their own connections
CREATE POLICY "Users can add their own connections"
ON public.platform_connections
FOR INSERT
WITH CHECK (true);

-- Allow users to update their own connections
CREATE POLICY "Users can update their own connections"
ON public.platform_connections
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow users to delete their own connections
CREATE POLICY "Users can delete their own connections"
ON public.platform_connections
FOR DELETE
USING (true);

CREATE INDEX idx_platform_connections_account ON public.platform_connections(account_id);

CREATE TRIGGER update_platform_connections_updated_at
BEFORE UPDATE ON public.platform_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
