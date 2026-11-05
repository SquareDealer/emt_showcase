# demo-seed

Детерминированная демо-база для CRM «Татарин»: 150 клиентов, ~800 нарядов за полгода, без реальных данных. Нужна для скриншотов и видео.

## Подготовка

```bash
# зависимости: корень (backend + сид) и client (vite, playwright)
npm ci
cd client && npm ci && cd ..
# если lockfile указывает на недоступное зеркало реестра — без правки lockfile:
#   npm ci --replace-registry-host=always --registry=https://registry.npmjs.org/
# браузер для скриншотов: свой Chromium Playwright или уже установленный
cd client && npx playwright install chromium && cd ..   # или PW_CHROMIUM_PATH=/path/to/chromium
```

Нужен Postgres 16 с базой, в имени которой есть `demo`. Dev-базу (`tatarin_pg`, :5544) не трогаем.

```bash
# вариант 1: compose, только БД (порт 5545, слушает 127.0.0.1)
docker compose -f docker-compose.demo.yml up -d db
# вариант 2: локальный Postgres (порт 5432): роль crm и база tatarin_demo
sudo -u postgres psql -c "CREATE ROLE crm LOGIN PASSWORD 'crm'"
sudo -u postgres createdb -O crm tatarin_demo     # pg_trgm миграции ставит владелец базы (trusted extension)
```

## Запуск

```bash
export DATABASE_URL=postgres://crm:crm@localhost:5545/tatarin_demo   # обязателен, из .env НЕ берётся (локально — :5432)
export DEMO_PASSWORD=demo-showcase-2026                              # пароль owner и остальных логинов
npm run seed:demo -- --now=2026-11-18            # на пустой базе; 2026-11-18 — дата видео
npm run seed:demo -- --force --now=2026-11-18    # сброс (TRUNCATE) и повторный сид
npm run seed:demo:verify                          # проверка; exit 0 = всё сходится
```

Сид отказывается работать при `NODE_ENV=production`, без явного `DATABASE_URL`, без `demo` в имени БД, на непустой базе без `--force`, при неизвестных флагах (`--froce`, `--now 2026-11-18` без `=`).

Приложение на демо-базе:

```bash
# compose (профиль app): api :3100, web :8088 (оба на 127.0.0.1)
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
DEMO_WEB_URL=http://127.0.0.1:5173 DEMO_PASSWORD=$DEMO_PASSWORD DATABASE_URL=$DATABASE_URL \
  PW_CHROMIUM_PATH=/path/to/chromium npx playwright test -c playwright.demo.config.ts
```

`DEMO_WEB_URL` по умолчанию `http://127.0.0.1:8088` (compose). Время страницы фиксируется на 12:00 MSK дня `DEMO_NOW`; без него — `settings.demo_now` засеянной базы (нужен `DATABASE_URL`), иначе 2026-11-18.

**Скриншоты только для проверки сида.** На них логотип EMT заказчика: приложение рисует свой бренд. Нейтральный бренд «Гараж CRM» подставляет план видео (`docs/superpowers/plans/2026-11-04-showcase-video.md`), не сид.

## Обновление из upstream

Шоукейс — зеркало `emt_service` с аддитивными добавками. После `git merge upstream/main` конфликтуют обычно `package.json` и `package-lock.json`:

```bash
git checkout --theirs package.json package-lock.json   # берём upstream целиком
npm i -D --save-exact @faker-js/faker@9.9.0            # возвращаем faker (ровно 9.9.0) и пересобираем lockfile
# вернуть 4 скрипта в package.json, если upstream их перезаписал:
#   "seed:demo", "seed:demo:verify", "test:demo", "lint:demo" (см. `git show ORIG_HEAD:package.json` — версия до merge)
git add package.json package-lock.json && git commit
```

Проверить, что `tsconfig.build.json` всё ещё исключает `demo`.

## Hero-сущности

ID выдаёт `demoId()`, поэтому не зависят от `--now`; в `demo/seed/hero.ts` (`HERO`, `heroSchedule`) они записаны литералами (Remotion-бандл видео не тянет Node `crypto`), `hero.spec.ts` сверяет их с `demoId()`. Даты ниже — для `--now=2026-11-18`.

| Что | ID / значение |
|---|---|
| Клиент (Ковалёв Артём Сергеевич, +7 (555) 010-56-56) | `c42601d6-92c3-57bd-bc73-fcdad7897046` |
| MINI Cooper S R56, М056РК 77, VIN WMWSV32050TZ56421 | `884787df-de44-5f5e-9433-faaec4bc7aa7` |
| Вторая машина клиента (Toyota RAV4) | `2c048705-f215-5def-aba5-05b4c9a5e728` |
| Наряд «Диагностика двигателя» (R56) | `ce67ea41-ab1c-5b9e-a60e-b8f079906691` |
| Большой наряд MINI Countryman F60 (4 блока + мойка, 15 строк, скидка 10% на диски, скидка наряда 5%) | `1e5ef750-2752-5d09-8cf1-0d1333f76619` |
| — его машина / клиент | `116df04b-e370-59e7-9c9d-193700588c63` / `9e0779f1-f195-5307-91d2-afb317048978` |
| Юрлицо (автопарк) | `6d3cc3e3-ea88-5566-a079-83816b0d038c` |
| Наряд для PDF | `74cda438-c364-5c3c-bd73-4b0df27e7554` |
| Мастер `master1` | `c8c535e3-52bd-5960-b6f1-ea4d14ff119b` |
| Шаблон «Замена цепи ГРМ (R56/N14)» | `d8ed88a0-2843-503c-ba4f-c56c5d80025f` |
| Шаблон «Диагностика двигателя» | `71c9ed38-ef30-5bf3-9f22-08d9004680ed` |
| Детали: масло 5W-30 / комплект цепи / натяжитель / натяжитель R56 | `7d05ea43-…` / `60f53037-…` / `f20bf823-…` / `7feaf7a6-…` |
| Логины | `owner`, `reception1`, `master1` (пароль — `DEMO_PASSWORD`) |
| Плотный день (`busyDay`) | 2026-11-18 (среда) |
| Свободное окно (`freeSlot`) | 2026-11-19 14:00–16:00 MSK (`2026-11-19T11:00:00Z`, 120 мин) |

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
- Колонка «Выдана» на доске показывает все закрытые наряды (739 при `--now=2026-11-18`). «Готово» — только свежие (до 14 дней) плюс два «забытых» неоплаченных.
- **Прерванный `verify`** (Ctrl-C, SIGKILL) посреди прогона может оставить изменённые `updated_at` и пробные строки (клиент/машина/наряд `verify: …`). Восстановление: `npm run seed:demo -- --force --now=…`. При штатном завершении отпечаток базы до и после совпадает.
- `docker-compose.demo.yml` в этой среде не запускался (нет docker); прогонялось на локальном Postgres 16.
