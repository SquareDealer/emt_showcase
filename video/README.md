# video — шоукейс «Гараж CRM»

## Фикстуры

Сцены не ходят в API: всё, что в кадре, — JSON в `src/fixtures/` и PNG настоящих PDF в
`public/docs/`, выгруженные из демо-API над засеянной демо-базой (`../demo/README.md`).

```bash
npm ci                                   # в video/
export DATABASE_URL=postgres://crm:crm@localhost:5432/tatarin_demo
export DEMO_PASSWORD=demo-showcase-2026
export DEMO_API_URL=http://127.0.0.1:3000/api
# демо-API (из корня): npm run build && TZ=Europe/Moscow JWT_SECRET=… SEED_OWNER_PASSWORD=$DEMO_PASSWORD PORT=3000 node dist/main.js
npm run fixtures         # экспорт (TZ=Europe/Moscow вписан в скрипт)
npm test                 # инварианты фикстур (src/fixtures/fixtures.spec.ts)
npm run fixtures:check   # детерминизм: сид → экспорт → git add → сид → экспорт → git diff --exit-code
```

`fixtures:check` = `npm run seed:demo -- --force --now=2026-11-18 && npm run fixtures && git add -A src/fixtures public/docs && npm run seed:demo -- --force --now=2026-11-18 && npm run fixtures && git diff --exit-code src/fixtures public/docs` (сид — в корне). Exit 0 = два экспорта совпали до байта. Скрипт пересеивает базу и индексирует фикстуры в git.

- «Сейчас» — `settings.demo_now` в 12:00 MSK (`meta.json.demoNow`, и `exportedAt` равен ему же).
- Снимки героя `wo-hero.0…4` — настоящие мутации API на **копии** закрытого наряда
  «Диагностика двигателя» (`/duplicate`); копия удаляется, счётчик номеров заказ-нарядов
  возвращается на место — `npm run seed:demo:verify` после экспорта даёт тот же отпечаток.
  Id копии и строк → `hero-copy` / `hero-line-<n>` / `hero-group-<n>`, их даты → `demoNow`.
- `apply-template` идёт без `part_template_ids` (API принимает там только UUID v4, а id каталога
  в сиде — v5) с последующим удалением строки масла: итог тот же, что «применить без масла».
- Экспорт прерван посреди героя (kill) — в базе может остаться копия: `npm run seed:demo -- --force --now=…`.
- Доска: колонка «Выдана» — 6 последних по `closed_at`. Дашборд — `scripts/dashboard.sql`.
