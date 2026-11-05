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
- `apply-template` — с явным `part_template_ids` (детали по умолчанию без масла), как шлёт модалка.
- Экспорт прерван посреди героя (kill) — в базе может остаться копия: `npm run seed:demo -- --force --now=…`.
- Доска: колонка «Выдана» — 6 последних по `closed_at`. Дашборд — `scripts/dashboard.sql`.

## Рендер (Remotion 4.0.541)

```bash
npm run studio                                          # превью
npm run still -- Debug-WorkOrder out/check/wo.png       # один кадр
npm run compositions                                    # список композиций
# песочница без скачивания Chrome:
export REMOTION_BROWSER=/path/to/chrome-headless-shell  # скрипты передают --browser-executable
```

- Скрипты задают `TZ=Europe/Moscow LANG=ru_RU.UTF-8 LANGUAGE=ru` (`cross-env`): от `TZ` зависит
  время событий календаря (под UTC они съезжают на 3 ч), от `LANG` — формат нативного
  `datetime-local` (`19.11.2026, 14:00`, а не `11/19/2026, 02:00 PM`).
- Сцены рендерят настоящие View из `client/src` через алиас `@crm`; React, роутер, query, dnd-kit,
  lucide и date-fns — одна копия из `video/node_modules` (алиасы в `remotion.config.ts`);
  `lib/api` подменён заглушкой `src/providers/mockApi.ts`, которая бросает при вызове.
- Глобально подключены все CSS фич CRM в порядке приложения (`src/providers/crm-styles.ts`) —
  в приложении они глобальные (`.back-link` наряда живёт в `clients/card.css`).
- Шрифты — `@fontsource` (Inter, JetBrains Mono с кириллицей) из бандла, без сети.
- id композиций — только `a-z A-Z 0-9 -` (Remotion запрещает `_`): `Debug-Board`, не `Debug_Board`.
- Лого сайдбара — обрезанные `public/brand/garage-crm-logo-{light,dark}-sidebar.png`.
- `npm run prerender:mobile` — композиция `MobileMaster` (390×844, 6 с, h264 без звука) →
  `public/prerender/mobile-master.mp4`; её проигрывает `PhoneFrame` (луп `LoopMasterMobile`). Файл
  закоммичен (~0,8 МБ): после правок `MobileMaster`, доски или фикстур — перегенерировать.
- Лупы `Loop*` (1600×1000, `src/compositions/Loops.tsx`; таймлайны — чистый `loops.ts` со спекой):
  каждый кончается тем же кадром, с которого начинается (данные, камера, курсор), поэтому
  `LoopCrossfade` лишь страхует. Проверка — `npm run loops:check` (`scripts/loop-diff.ts`: still
  кадров 0 и `dur−1`, доля пикселей с разницей > 16 в любом канале ≤ 1 %). Рендер:
  `npm run render -- LoopBoard out/loops/board.webm --codec=vp9 --muted` (и `.mp4 --codec=h264`).
- Стиллы (`src/compositions/Stills.tsx`, папка `Stills` в Studio): `Cover` 1920×1080 (рендер в `--scale=2`,
  наклонённое окно сметы + телефон с кадром 0 пререндера + лого), `OG` 1200×630 (лого, строка intro,
  карточка итогов сметы ×1.85 — читается в ширину 600 px), `ReadmeEstimate` и `ReadmeBoard` 1600×1000
  (окно 1:1, без подписей и курсора). Состояния — финал истории героя из тех же фикстур.

## Финальный рендер

```bash
npm run render:all -- --concurrency=3     # всё: hero, social, лупы, стиллы → out/ (gitignored)
npm run render:hero                       # или по группе: render:social / render:loops / render:stills
```

`scripts/render-all.ts` собирает бандл один раз (`out/bundle`) и гонит `remotion render|still` по списку
`scripts/render-jobs.ts` (проверяется `render-jobs.spec.ts`); флаги после `--` уходят в каждый вызов.

| Выход | Композиция | Флаги |
|---|---|---|
| `out/hero.mp4` | `Hero` | h264, `--crf=16 --image-format=png` |
| `out/social.mp4` | `HeroSocial` | h264, `--image-format=png` |
| `out/loops/<луп>.webm` / `.mp4` | `Loop*` | vp9 / h264, `--muted` |
| `out/cover.png` | `Cover` | `--scale=2` (3840×2160) |
| `out/og.png`, `out/readme-estimate.png`, `out/readme-board.png` | `OG`, `ReadmeEstimate`, `ReadmeBoard` | — |

- Ни у одного `render*`/`still` нет npm-хука `pre…`: `prerender:mobile` запускается только руками, а
  `public/` после `render:all` остаётся чистым (`git status public`). Скрипта `render:mobile` нет нарочно —
  npm счёл бы `prerender:mobile` его pre-хуком.
- Длительность проверять по видеопотоку, не по контейнеру (AAC добавляет ~16 мс):
  `ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames,duration out/hero.mp4`.
