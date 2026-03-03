-- Add index to cooperative_contributions for faster member statement retrieval
CREATE INDEX IF NOT EXISTS idx_cooperative_contributions_member_id ON cooperative_contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_cooperative_contributions_cooperative_id ON cooperative_contributions(cooperative_id);
