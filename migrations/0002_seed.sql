PRAGMA foreign_keys = ON;

INSERT INTO services (
  slug,
  name,
  description,
  duration_minutes,
  price_grosze,
  active,
  sort_order,
  created_at,
  updated_at
)
VALUES
  (
    'strzyzenie-meskie',
    'Strzyżenie męskie',
    'Konsultacja, precyzyjne cięcie, stylizacja i wskazówki dopasowane do włosów oraz codziennego rytmu.',
    45,
    7000,
    1,
    1,
    '2026-07-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z'
  ),
  (
    'strzyzenie-brody',
    'Strzyżenie brody',
    'Skrócenie, konturowanie i pielęgnacja brody z zachowaniem proporcji dopasowanych do rysów twarzy.',
    30,
    5000,
    1,
    2,
    '2026-07-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z'
  ),
  (
    'combo-wlosy-broda',
    'Combo: włosy + broda',
    'Kompletne strzyżenie włosów i brody podczas jednej wizyty, zakończone spójną stylizacją całej formy.',
    75,
    11000,
    1,
    3,
    '2026-07-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z'
  ),
  (
    'strzyzenie-dzieciece',
    'Strzyżenie dziecięce',
    'Spokojne strzyżenie dla młodszego klienta, dopasowane do wieku, wygody i łatwej codziennej pielęgnacji.',
    45,
    6000,
    1,
    4,
    '2026-07-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z'
  ),
  (
    'golenie-brzytwa',
    'Golenie brzytwą',
    'Klasyczny rytuał z przygotowaniem skóry, ciepłym ręcznikiem, precyzyjnym goleniem i łagodzącym wykończeniem.',
    45,
    6500,
    1,
    5,
    '2026-07-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z'
  );

INSERT INTO barbers (
  slug,
  name,
  bio,
  image_path,
  active,
  created_at,
  updated_at
)
VALUES
  (
    'michal',
    'Michał',
    'Ceni klasyczne formy, czyste przejścia i fryzury, które dobrze układają się także między wizytami.',
    'barber-michal.png',
    1,
    '2026-07-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z'
  ),
  (
    'kamil',
    'Kamil',
    'Łączy współczesne tekstury z prostą pielęgnacją i dobiera formę do naturalnego układu włosów.',
    'barber-kamil.png',
    1,
    '2026-07-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z'
  ),
  (
    'adrian',
    'Adrian',
    'Specjalizuje się w pracy z brodą i kompletnych metamorfozach, w których każdy detal ma uzasadnienie.',
    'barber-adrian.png',
    1,
    '2026-07-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z'
  );

WITH assignments (barber_slug, service_slug) AS (
  VALUES
    ('michal', 'strzyzenie-meskie'),
    ('michal', 'strzyzenie-brody'),
    ('michal', 'combo-wlosy-broda'),
    ('michal', 'golenie-brzytwa'),
    ('kamil', 'strzyzenie-meskie'),
    ('kamil', 'strzyzenie-brody'),
    ('kamil', 'combo-wlosy-broda'),
    ('kamil', 'strzyzenie-dzieciece'),
    ('adrian', 'strzyzenie-meskie'),
    ('adrian', 'strzyzenie-brody'),
    ('adrian', 'combo-wlosy-broda'),
    ('adrian', 'strzyzenie-dzieciece'),
    ('adrian', 'golenie-brzytwa')
)
INSERT INTO barber_services (barber_id, service_id)
SELECT
  b.id,
  s.id
FROM assignments a
JOIN barbers b ON b.slug = a.barber_slug
JOIN services s ON s.slug = a.service_slug;

WITH schedule (weekday, start_time, end_time) AS (
  VALUES
    (1, '09:00', '20:00'),
    (2, '09:00', '20:00'),
    (3, '09:00', '20:00'),
    (4, '09:00', '20:00'),
    (5, '09:00', '20:00'),
    (6, '09:00', '16:00')
)
INSERT INTO working_hours (
  barber_id,
  weekday,
  start_time,
  end_time,
  active
)
SELECT
  b.id,
  schedule.weekday,
  schedule.start_time,
  schedule.end_time,
  1
FROM barbers b
CROSS JOIN schedule
WHERE b.slug IN ('michal', 'kamil', 'adrian');
