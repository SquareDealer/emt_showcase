-- Aggregates for fixtures/dashboard.json (DashboardData). Run by scripts/export-fixtures.ts, one
-- statement per «-- name:» section. $1 = DEMO_NOW (timestamptz). Months and weeks are Moscow-local;
-- «revenue» is total_frozen of closed orders by closed_at, as in the seed's own stats.
-- The report month is the last FULL calendar month before DEMO_NOW's month (DEMO_NOW is mid-month: a
-- month-to-date figure against a full month would always read as a drop). Only the chart reaches into
-- the current month, drawn as partial.

-- name: revenue_by_month
-- The 6 months ending with DEMO_NOW's month; the last one (current) is month-to-date — partial.
WITH b AS (SELECT date_trunc('month', $1::timestamptz AT TIME ZONE 'Europe/Moscow') AS cur)
SELECT to_char(m, 'YYYY-MM') AS month, coalesce(sum(w.total_frozen), 0)::text AS revenue
FROM b
CROSS JOIN generate_series(b.cur - interval '5 months', b.cur, interval '1 month') AS m
LEFT JOIN work_orders w
  ON w.status = 'closed'
 AND w.closed_at <= $1
 AND w.closed_at AT TIME ZONE 'Europe/Moscow' >= m
 AND w.closed_at AT TIME ZONE 'Europe/Moscow' < m + interval '1 month'
GROUP BY m
ORDER BY m;

-- name: kpi
-- The report month's revenue and closed orders, and the month before it (full vs full) for the delta.
WITH b AS (
  SELECT date_trunc('month', $1::timestamptz AT TIME ZONE 'Europe/Moscow') - interval '1 month' AS mon
), c AS (
  SELECT w.total_frozen, w.closed_at AT TIME ZONE 'Europe/Moscow' AS at_l
  FROM work_orders w
  WHERE w.status = 'closed' AND w.closed_at <= $1
)
SELECT to_char(b.mon, 'YYYY-MM') AS month,
       coalesce(sum(c.total_frozen) FILTER (WHERE c.at_l >= b.mon AND c.at_l < b.mon + interval '1 month'), 0)::text AS revenue,
       count(c.at_l) FILTER (WHERE c.at_l >= b.mon AND c.at_l < b.mon + interval '1 month')::int AS orders,
       coalesce(sum(c.total_frozen) FILTER (WHERE c.at_l >= b.mon - interval '1 month' AND c.at_l < b.mon), 0)::text AS prev_revenue
FROM b LEFT JOIN c ON true
GROUP BY b.mon;

-- name: master_load
-- Booked hours of each active master in the report month's working days (Mon–Fri, any status) against
-- one master's capacity: an 8-hour shift × the month's Mon–Fri count. (The shop's opening hours, settings
-- working_hours_*, are the calendar window, not a master's shift.)
WITH b AS (
  SELECT date_trunc('month', $1::timestamptz AT TIME ZONE 'Europe/Moscow') - interval '1 month' AS mon
), d AS (
  SELECT count(*)::int AS days
  FROM b CROSS JOIN generate_series(b.mon, b.mon + interval '1 month' - interval '1 day', interval '1 day') AS day
  WHERE extract(isodow FROM day) <= 5
), s AS (
  SELECT 8 AS shift_h,
         (SELECT value::int FROM settings WHERE key = 'default_appointment_min') AS def_min
)
SELECT u.name,
       (coalesce(sum(coalesce(w.scheduled_duration_min, s.def_min)), 0) / 60.0)::text AS hours,
       (s.shift_h * d.days)::int AS capacity_hours
FROM users u
CROSS JOIN b
CROSS JOIN d
CROSS JOIN s
LEFT JOIN work_orders w
  ON w.assigned_master_id = u.id
 AND w.scheduled_at AT TIME ZONE 'Europe/Moscow' >= b.mon
 AND w.scheduled_at AT TIME ZONE 'Europe/Moscow' < b.mon + interval '1 month'
 AND extract(isodow FROM w.scheduled_at AT TIME ZONE 'Europe/Moscow') <= 5
WHERE u.role = 'master' AND u.is_active
GROUP BY u.id, u.name, s.shift_h, d.days
ORDER BY u.name;

-- name: top_works
-- Labor lines of orders closed in the report month, by work name: revenue net of the line's own
-- discount (the order-level discount is not split across lines).
WITH b AS (
  SELECT date_trunc('month', $1::timestamptz AT TIME ZONE 'Europe/Moscow') - interval '1 month' AS mon
),
l AS (
  SELECT l.name,
         coalesce(l.price_override, coalesce(l.hours, 0) * l.rate_snapshot) AS gross,
         l.discount_type, l.discount_value
  FROM labor_lines l
  JOIN work_orders w ON w.id = l.work_order_id
  CROSS JOIN b
  WHERE w.status = 'closed' AND w.closed_at <= $1
    AND w.closed_at AT TIME ZONE 'Europe/Moscow' >= b.mon
    AND w.closed_at AT TIME ZONE 'Europe/Moscow' < b.mon + interval '1 month'
)
SELECT name,
       count(*)::int AS count,
       sum(gross - CASE
             WHEN discount_type = 'percent' THEN round(gross * coalesce(discount_value, 0) / 100, 2)
             WHEN discount_type = 'fixed' THEN least(coalesce(discount_value, 0), gross)
             ELSE 0
           END)::text AS revenue
FROM l
GROUP BY name
ORDER BY sum(gross - CASE
             WHEN discount_type = 'percent' THEN round(gross * coalesce(discount_value, 0) / 100, 2)
             WHEN discount_type = 'fixed' THEN least(coalesce(discount_value, 0), gross)
             ELSE 0
           END) DESC, name
LIMIT 5;
