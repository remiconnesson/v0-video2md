-- Add stack group support to slide_feedback table
ALTER TABLE slide_feedback 
ADD COLUMN IF NOT EXISTS stack_group_id VARCHAR(36),
ADD COLUMN IF NOT EXISTS stack_order INTEGER;

-- Create index for stack queries
CREATE INDEX IF NOT EXISTS slide_feedback_stack_group_idx 
ON slide_feedback(stack_group_id) WHERE stack_group_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN slide_feedback.stack_group_id IS 'UUID identifying stacked slides with same content';
COMMENT ON COLUMN slide_feedback.stack_order IS 'Order within stack (0 = primary/top slide)';
