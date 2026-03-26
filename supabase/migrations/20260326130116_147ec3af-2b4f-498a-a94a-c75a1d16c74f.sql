CREATE POLICY "Admins can delete any report"
ON public.fuel_reports
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));