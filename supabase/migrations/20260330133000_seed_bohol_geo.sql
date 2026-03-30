INSERT INTO public.geo_provinces (code, name)
VALUES
  ('PH-BOH', 'Bohol')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;

INSERT INTO public.geo_cities_municipalities (code, province_code, name)
VALUES
  ('PH-BOH-ALBURQUERQUE', 'PH-BOH', 'Albuquerque'),
  ('PH-BOH-ALICIA', 'PH-BOH', 'Alicia'),
  ('PH-BOH-ANDA', 'PH-BOH', 'Anda'),
  ('PH-BOH-ANTEQUERA', 'PH-BOH', 'Antequera'),
  ('PH-BOH-BACLAYON', 'PH-BOH', 'Baclayon'),
  ('PH-BOH-BALILIHAN', 'PH-BOH', 'Balilihan'),
  ('PH-BOH-BATUAN', 'PH-BOH', 'Batuan'),
  ('PH-BOH-BIEN-UNIDO', 'PH-BOH', 'Bien Unido'),
  ('PH-BOH-BILAR', 'PH-BOH', 'Bilar'),
  ('PH-BOH-BUENAVISTA', 'PH-BOH', 'Buenavista'),
  ('PH-BOH-CALAPE', 'PH-BOH', 'Calape'),
  ('PH-BOH-CANDIJAY', 'PH-BOH', 'Candijay'),
  ('PH-BOH-CARMEN', 'PH-BOH', 'Carmen'),
  ('PH-BOH-CATIGBIAN', 'PH-BOH', 'Catigbian'),
  ('PH-BOH-CLARIN', 'PH-BOH', 'Clarin'),
  ('PH-BOH-CORELLA', 'PH-BOH', 'Corella'),
  ('PH-BOH-CORTES', 'PH-BOH', 'Cortes'),
  ('PH-BOH-DAGOHOY', 'PH-BOH', 'Dagohoy'),
  ('PH-BOH-DANAO', 'PH-BOH', 'Danao'),
  ('PH-BOH-DAUIS', 'PH-BOH', 'Dauis'),
  ('PH-BOH-DIMIAO', 'PH-BOH', 'Dimiao'),
  ('PH-BOH-DUERO', 'PH-BOH', 'Duero'),
  ('PH-BOH-GARCIA-HERNANDEZ', 'PH-BOH', 'Garcia Hernandez'),
  ('PH-BOH-GETAFE', 'PH-BOH', 'Getafe'),
  ('PH-BOH-GUINDULMAN', 'PH-BOH', 'Guindulman'),
  ('PH-BOH-INABANGA', 'PH-BOH', 'Inabanga'),
  ('PH-BOH-JAGNA', 'PH-BOH', 'Jagna'),
  ('PH-BOH-LILA', 'PH-BOH', 'Lila'),
  ('PH-BOH-LOAY', 'PH-BOH', 'Loay'),
  ('PH-BOH-LOBOC', 'PH-BOH', 'Loboc'),
  ('PH-BOH-LOON', 'PH-BOH', 'Loon'),
  ('PH-BOH-MABINI', 'PH-BOH', 'Mabini'),
  ('PH-BOH-MARIBOJOC', 'PH-BOH', 'Maribojoc'),
  ('PH-BOH-PANGLAO', 'PH-BOH', 'Panglao'),
  ('PH-BOH-PILAR', 'PH-BOH', 'Pilar'),
  ('PH-BOH-PRESIDENT-CARLOS-P-GARCIA', 'PH-BOH', 'President Carlos P. Garcia'),
  ('PH-BOH-SAGBAYAN', 'PH-BOH', 'Sagbayan'),
  ('PH-BOH-SAN-ISIDRO', 'PH-BOH', 'San Isidro'),
  ('PH-BOH-SAN-MIGUEL', 'PH-BOH', 'San Miguel'),
  ('PH-BOH-SEVILLA', 'PH-BOH', 'Sevilla'),
  ('PH-BOH-SIERRA-BULLONES', 'PH-BOH', 'Sierra Bullones'),
  ('PH-BOH-SIKATUNA', 'PH-BOH', 'Sikatuna'),
  ('PH-BOH-TAGBILARAN-CITY', 'PH-BOH', 'Tagbilaran City'),
  ('PH-BOH-TALIBON', 'PH-BOH', 'Talibon'),
  ('PH-BOH-TRINIDAD', 'PH-BOH', 'Trinidad'),
  ('PH-BOH-TUBIGON', 'PH-BOH', 'Tubigon'),
  ('PH-BOH-UBAY', 'PH-BOH', 'Ubay'),
  ('PH-BOH-VALENCIA', 'PH-BOH', 'Valencia')
ON CONFLICT (code) DO UPDATE
SET
  province_code = EXCLUDED.province_code,
  name = EXCLUDED.name;
