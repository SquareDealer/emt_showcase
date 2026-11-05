-- Aggregates for fixtures/dashboard.json (DashboardData). Run by scripts/export-fixtures.ts, one
-- statement per «-- name:» section. $1 = DEMO_NOW (timestamptz). Months and weeks are Moscow-local;
-- «revenue» is total_frozen of closed orders by closed_at, as in the seed's own stats.

-- name: revenue_by_month
-- The 6 months ending with DEMO_NOW's month; the current one is month-to-date.
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
-- Month-to-date revenue and closed orders, and the same stretch of the previous month
-- (1st .. same day and hour) for the delta — a full previous month would always look like a drop.
WITH b AS (
  SELECT $1::timestamptz AT TIME ZONE 'Europe/Moscow' AS now_l,
         date_trunc('month', $1::timestamptz AT TIME ZONE 'Europe/Moscow') AS cur
), c AS (
  SELECT w.total_frozen, w.closed_at AT TIME ZONE 'Europe/Moscow' AS at_l
  FROM work_orders w
  WHERE w.status = 'closed' AND w.closed_at <= $1
)
SELECT coalesce(sum(c.total_frozen) FILTER (WHERE c.at_l >= b.cur), 0)::text AS revenue,
       count(*) FILTER (WHERE c.at_l >= b.cur)::int AS orders,
       coalesce(sum(c.total_frozen) FILTER (
         WHERE c.at_l >= b.cur - interval '1 month' AND c.at_l <= b.now_l - interval '1 month'
       ), 0)::text AS prev_revenue
FROM b CROSS JOIN c
GROUP BY b.cur, b.now_l;

-- name: master_load
-- Booked hours of each active master in DEMO_NOW's working week (Mon–Fri, any status) against the
-- shop's opening hours (settings working_hours_*) × 5 days.
WITH b AS (
  SELECT (date_trunc('week', $1::timestamptz AT TIME ZONE 'Europe/Moscow')) AT TIME ZONE 'Europe/Moscow' AS mon
), s AS (
  SELECT (SELECT value::int FROM settings WHERE key = 'working_hours_end')
       - (SELECT value::int FROM settings WHERE key = 'working_hours_start') AS day_h,
         (SELECT value::int FROM settings WHERE key = 'default_appointment_min') AS def_min
)
SELECT u.name,
       (coalesce(sum(coalesce(w.scheduled_duration_min, s.def_min)), 0) / 60.0)::text AS hours,
       (s.day_h * 5)::int AS capacity_hours
FROM users u
CROSS JOIN b
CROSS JOIN s
LEFT JOIN work_orders w
  ON w.assigned_master_id = u.id
 AND w.scheduled_at >= b.mon
 AND w.scheduled_at < b.mon + interval '5 days'
WHERE u.role = 'master' AND u.is_active
GROUP BY u.id, u.name, s.day_h
ORDER BY u.name;

-- name: top_works
-- Labor lines of orders closed this month (to date), by work name: revenue net of the line's own
-- discount (the order-level discount is not split across lines).
WITH b AS (SELECT date_trunc('month', $1::timestamptz AT TIME ZONE 'Europe/Moscow') AS cur),
l AS (
  SELECT l.name,
         coalesce(l.price_override, coalesce(l.hours, 0) * l.rate_snapshot) AS gross,
         l.discount_type, l.discount_value
  FROM labor_lines l
  JOIN work_orders w ON w.id = l.work_order_id
  CROSS JOIN b
  WHERE w.status = 'closed' AND w.closed_at <= $1
    AND w.closed_at AT TIME ZONE 'Europe/Moscow' >= b.cur
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
