# demo-seed

Детерминированная демо-база для CRM «Татарин»: 150 клиентов, ~800 нарядов за полгода, без реальных данных. Нужна для скриншотов и видео.

## Запуск

Нужен Postgres 16 с базой, в имени которой есть `demo`. Dev-базу (`tatarin_pg`, :5544) не трогаем.

```bash
# вариант 1: compose, только БД (порт 5545)
docker compose -f docker-compose.demo.yml up -d db
# вариант 2: локальный Postgres, база tatarin_demo (у нас порт 5432)

export DATABASE_URL=postgres://crm:crm@localhost:5545/tatarin_demo   # обязателен, из .env НЕ берётся
export DEMO_PASSWORD=demo-showcase-2026                              # пароль owner и остальных логинов
npm run seed:demo -- --now=2026-11-04            # на пустой базе
npm run seed:demo -- --force --now=2026-11-04    # сброс (TRUNCATE) и повторный сид
npm run seed:demo:verify                          # проверка; exit 0 = всё сходится
```

Сид отказывается работать при `NODE_ENV=production`, без явного `DATABASE_URL`, без `demo` в имени БД, на непустой базе без `--force`, при неизвестных флагах (`--froce`, `--now 2026-11-04` без `=`).

Приложение на демо-базе:

```bash
# compose (профиль app): api :3100, web :8088
export DEMO_JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
docker compose -f docker-compose.demo.yml --profile app up -d --build

# без docker: backend :3000 + vite :5173 (проксирует /api на :3000)
npm run build && JWT_SECRET=... SEED_OWNER_PASSWORD=$DEMO_PASSWORD PORT=3000 node dist/main.js
cd client && npm run dev -- --host 127.0.0.1
```

Порты: compose — БД 5545, api 3100, web 8088; локально без docker — БД 5432, api 3000, web 5173. Встроенный `SeedService` приложения на засеянной базе ничего не добавляет (проверено: число строк до и после старта то же).

Скриншоты (6 экранов в `demo/out/screens/`, в git не попадают):

```bash
cd client
DEMO_WEB_URL=http://127.0.0.1:5173 DEMO_NOW=2026-11-04 DEMO_PASSWORD=$DEMO_PASSWORD \
  PW_CHROMIUM_PATH=/path/to/chromium npx playwright test -c playwright.demo.config.ts
```

`DEMO_WEB_URL` по умолчанию `http://127.0.0.1:8088` (compose). Время страницы фиксируется на `DEMO_NOW` 12:00 MSK.

## Hero-сущности

ID выдаёт `demoId()`, поэтому не зависят от `--now` (прогон `--now=2026-11-04`). Источник правды — `demo/seed/hero.ts` (`HERO`, `heroSchedule`).

| Что | ID / значение |
|---|---|
| Клиент (Ковалёв Артём Сергеевич, +7 (555) 010-56-56) | `c42601d6-92c3-57bd-bc73-fcdad7897046` |
| MINI Cooper S R56, М056РК 77, VIN WMWSV32050TZ56421 | `884787df-de44-5f5e-9433-faaec4bc7aa7` |
| Вторая машина клиента (Toyota RAV4) | `2c048705-f215-5def-aba5-05b4c9a5e728` |
| Наряд «Диагностика двигателя» (R56) | `ce67ea41-ab1c-5b9e-a60e-b8f079906691` |
| Большой наряд (блоки, скидка строки 10%, скидка наряда 5%) | `1e5ef750-2752-5d09-8cf1-0d1333f76619` |
| — его машина / клиент | `116df04b-e370-59e7-9c9d-193700588c63` / `9e0779f1-f195-5307-91d2-afb317048978` |
| Юрлицо (автопарк) | `6d3cc3e3-ea88-5566-a079-83816b0d038c` |
| Наряд для PDF | `74cda438-c364-5c3c-bd73-4b0df27e7554` |
| Мастер `master1` | `c8c535e3-52bd-5960-b6f1-ea4d14ff119b` |
| Шаблон «Замена цепи ГРМ (R56/N14)» | `d8ed88a0-2843-503c-ba4f-c56c5d80025f` |
| Шаблон «Диагностика двигателя» | `71c9ed38-ef30-5bf3-9f22-08d9004680ed` |
| Детали: масло 5W-30 / комплект цепи / натяжитель / натяжитель R56 | `7d05ea43-…` / `60f53037-…` / `f20bf823-…` / `7feaf7a6-…` |
| Логины | `owner`, `reception1`, `master1` (пароль — `DEMO_PASSWORD`) |
| Плотный день (`busyDay`) | 2026-11-04 (среда) |
| Свободное окно (`freeSlot`) | 2026-11-05 14:00–16:00 MSK (`2026-11-05T11:00:00Z`, 120 мин) |

## Допущения

- Время московское, фиксированный сдвиг UTC+3; часовой пояс хоста и локальные методы `Date` не используются, план совпадает до байта при любом `TZ`.
- `DEMO_NOW` — день из `--now` (по умолчанию сегодня по Москве), время 12:00 MSK.
- Все UUID и `group_key` — через `demoId()` (детерминированные uuid v5), не `faker.string.uuid`. `@faker-js/faker` ровно 9.9.0 (10.x только ESM), devDependency, в прод-образ не попадает.
- Строки и номера перенумеровываются (rekey) после работы сервисов приложения, чтобы id и `doc_number` совпали с планом.
- Ключ `demo_now` в `settings` хранит день `--now`; `verify` строит по нему план и сверяет базу.
- `order_doc_number` пуст до первой печати заказ-наряда.
- Телефоны хранятся нормализованными (`+75550105656`); `+7 (555) 010-56-56` — отображаемая форма.
- Ставка: `rate_snapshot` 2000 до (`DEMO_NOW` − 3 мес.) и 2200 после; `labor_rate` 2200.

## Известное

- **`--now` для видео:** брать пн–чт, середина месяца, число ≥ 5. В начале месяца выручка «проваливается» (мало закрытых за текущий месяц, рост м/м ломается); с пт по вс свободное окно уходит на следующую неделю.
- Колонка «Выдана» на доске показывает все закрытые наряды (~700).
- **Прерванный `verify`** (Ctrl-C, SIGKILL) посреди прогона может оставить изменённые `updated_at` и пробные строки (клиент/машина/наряд `verify: …`). Восстановление: `npm run seed:demo -- --force --now=…`. При штатном завершении отпечаток базы до и после совпадает.
- `docker-compose.demo.yml` в этой среде не запускался (нет docker); прогонялось на локальном Postgres 16.
