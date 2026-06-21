-- Fix overly permissive RLS on emails table
DROP POLICY IF EXISTS "Allow all access to emails" ON public.emails;

CREATE POLICY "Authenticated users can manage emails"
ON public.emails FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);