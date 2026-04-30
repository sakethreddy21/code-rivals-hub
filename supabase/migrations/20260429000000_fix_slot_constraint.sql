-- Fix the slot constraint to allow more target problems (up to 100)
ALTER TABLE public.today_target_solutions 
DROP CONSTRAINT IF EXISTS today_target_solutions_slot_check;

ALTER TABLE public.today_target_solutions 
ADD CONSTRAINT today_target_solutions_slot_check 
CHECK (slot BETWEEN 0 AND 99);
