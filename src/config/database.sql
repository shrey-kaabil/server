-- User Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  total_stars INT DEFAULT 0,
  total_games INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Matches Table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('human-human', 'human-ai')),
  player_a UUID REFERENCES profiles(id),
  player_b UUID REFERENCES profiles(id),
  player_a_guess TEXT CHECK (player_a_guess IN ('human', 'ai')),
  player_b_guess TEXT CHECK (player_b_guess IN ('human', 'ai')),
  player_a_score INT DEFAULT 0,
  player_b_score INT DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('playerA', 'playerB')),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Rank/Leaderboard Table (for future use)
CREATE TABLE IF NOT EXISTS rankings (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id),
  elo_rating INT DEFAULT 1000,
  rank INT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can read all profiles but only update their own
CREATE POLICY "Profiles are viewable by everyone" 
ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE USING (auth.uid() = id);

-- Matches: Users can read matches they participate in
CREATE POLICY "Users can view their own matches" 
ON matches FOR SELECT USING (
  auth.uid() = player_a OR auth.uid() = player_b
);

-- Messages: Users can read messages in their matches
CREATE POLICY "Users can view messages in their matches" 
ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM matches 
    WHERE matches.id = messages.match_id 
    AND (matches.player_a = auth.uid() OR matches.player_b = auth.uid())
  )
);

-- Create functions to update stats after a match

-- Function to update user stats after match completion
CREATE OR REPLACE FUNCTION update_user_stats_after_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Update player A stats
  UPDATE profiles
  SET 
    wins = CASE WHEN NEW.player_a_score > 0 THEN wins + 1 ELSE wins END,
    losses = CASE WHEN NEW.player_a_score = 0 THEN losses + 1 ELSE losses END,
    total_stars = total_stars + NEW.player_a_score,
    total_games = total_games + 1
  WHERE id = NEW.player_a;
  
  -- Update player B stats (if human)
  IF NEW.type = 'human-human' THEN
    UPDATE profiles
    SET 
      wins = CASE WHEN NEW.player_b_score > 0 THEN wins + 1 ELSE wins END,
      losses = CASE WHEN NEW.player_b_score = 0 THEN losses + 1 ELSE losses END,
      total_stars = total_stars + NEW.player_b_score,
      total_games = total_games + 1
    WHERE id = NEW.player_b;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update stats when match status changes to completed
CREATE TRIGGER on_match_complete
AFTER UPDATE ON matches
FOR EACH ROW
WHEN (OLD.status = 'active' AND NEW.status = 'completed')
EXECUTE FUNCTION update_user_stats_after_match(); 