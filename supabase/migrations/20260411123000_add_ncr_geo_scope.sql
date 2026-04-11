INSERT INTO public.geo_provinces (code, name)
VALUES
  ('PH-NCR', 'NCR / Metro Manila')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;

INSERT INTO public.geo_cities_municipalities (code, province_code, name)
VALUES
  ('PH-NCR-CALOOCAN', 'PH-NCR', 'Caloocan'),
  ('PH-NCR-LAS-PINAS', 'PH-NCR', 'Las Pinas'),
  ('PH-NCR-MAKATI', 'PH-NCR', 'Makati'),
  ('PH-NCR-MALABON', 'PH-NCR', 'Malabon'),
  ('PH-NCR-MANDALUYONG', 'PH-NCR', 'Mandaluyong'),
  ('PH-NCR-MANILA', 'PH-NCR', 'Manila'),
  ('PH-NCR-MARIKINA', 'PH-NCR', 'Marikina'),
  ('PH-NCR-MUNTINLUPA', 'PH-NCR', 'Muntinlupa'),
  ('PH-NCR-NAVOTAS', 'PH-NCR', 'Navotas'),
  ('PH-NCR-PARANAQUE', 'PH-NCR', 'Paranaque'),
  ('PH-NCR-PASAY', 'PH-NCR', 'Pasay'),
  ('PH-NCR-PASIG', 'PH-NCR', 'Pasig'),
  ('PH-NCR-PATEROS', 'PH-NCR', 'Pateros'),
  ('PH-NCR-QUEZON-CITY', 'PH-NCR', 'Quezon City'),
  ('PH-NCR-SAN-JUAN', 'PH-NCR', 'San Juan'),
  ('PH-NCR-TAGUIG', 'PH-NCR', 'Taguig'),
  ('PH-NCR-VALENZUELA', 'PH-NCR', 'Valenzuela')
ON CONFLICT (code) DO UPDATE
SET
  province_code = EXCLUDED.province_code,
  name = EXCLUDED.name;
