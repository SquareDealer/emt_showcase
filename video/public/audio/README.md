# Звук шоукейса

Минималистичные «SaaS»-звуки, **сделанные кодом с помощью [earshot](https://github.com/Leonxlnx/earshot)**
(банк `earshot sfx`, v0.4.0, commit `591fa3e`): это не записи, а синтез; файлы — наши, без лицензионных
ограничений. Все — 48 кГц, стерео, 24 бит, как их отдал earshot (без перекодирования).

Sounds made in code with earshot (MIT) by Leon Lin, github.com/Leonxlnx/earshot

| Файл           | earshot id (seed)            | Роль                                    | Громкость | Где звучит (`src/compositions/assembly.ts`) |
|----------------|------------------------------|-----------------------------------------|-----------|---------------------------------------------|
| `click_1.wav`  | `pro_hover_tick/soft` (0)    | клик курсора, 32 мс                     | 0.32      | `click` = `clicksAbsolute()`, чётные        |
| `click_2.wav`  | `pro_hover_tick/soft` (1)    | клик курсора, второй дубль              | 0.32      | `click`, нечётные                           |
| `key_1.wav`    | `typing_key/light` (0)       | клавиша, ~160 мс                        | 0.22      | `key` — каждый набранный символ: «10», «5» в скидках Estimate и VIN в ⌘K Search; дубли по кругу 1…4 |
| `key_2.wav`    | `typing_key/light` (4)       | клавиша                                 | 0.22      | `key`                                       |
| `key_3.wav`    | `typing_key/light` (8)       | клавиша                                 | 0.22      | `key`                                       |
| `key_4.wav`    | `typing_key/light` (3)       | клавиша                                 | 0.22      | `key`                                       |
| `whoosh_1.wav` | `whoosh_fast/heavy` (0)      | «вжух», 770 мс, пик ≈ 135 мс            | 0.28      | `whoosh` — каждый переход (вайп «непрерывной камеры» и раскрытие карточки), с 11-го кадра 30-кадрового перехода: пик — на его середине (`WHOOSH_LEAD` = 15 − 4) |
| `pop_1.wav`    | `ui_pop/soft` (0)            | «поп»: контент встал на место, 180 мс   | 0.28      | `pop` — за кадр до: запись в слоте (Booking `LAND_AT`), карточка на доске (Board `DROP_AT`); дубли через один |
| `pop_2.wav`    | `ui_pop/soft` (1)            | «поп», второй дубль                     | 0.28      | `pop`                                       |
| `ding_1.wav`   | `notify/mid_wood` (0)        | успех: тост, 317 мс                     | 0.32      | `ding` — тост «Блок добавлен в смету» (Estimate `TOAST_IN`, через 2 кадра после блока `APPLY_AT`: «динг» и отмечает его появление, попа там нет) |
| `music.mp3`    | —                            | **плейсхолдер: тишина** 49,0 с (1470 кадров) | 0.8 (огибающая) | вся композиция, `musicVolume()`   |

Громкости — одна таблица `SFX_VOLUME` рядом с `sfxCues()`, выставлены по замерам earshot (клики и
клавиши на ≥ 8 LU тише попов, «динга» и «вжухов»); дубли клавиш — сиды 0, 4, 8, 3: только они из 0–9
проходят аудит `earshot sfx check` без «metallic comb ring» (сиды 1, 2, 5, 7, 9 — с ним); длины файлов (в сэмплах) — `SFX_TAKES`
(тест сверяет их с заголовками WAV). Звуки обеих версий — один список `sfxCues(scenes)`:
`ShowcaseAssembly` рендерит ровно его (`Hero` — по `SCENES`, `HeroSocial` — по `SCENES_SOCIAL`).
Длина: hero 49,0 с (1470 кадров), social 40,0 с (1200 кадров). Лупы рендерятся без звука (`--muted`).

## Замена музыки

`music.mp3` — заглушка, пока не выбран лицензионный трек 120 BPM (сетка видео: удар = 15 кадров,
клики и склейки стоят на ударах). Чтобы заменить:

1. Положить трек сюда же под именем `music.mp3`. Длина ≥ 49 с + `musicOffsetFrames`/30 с для hero
   (при положительном смещении начало трека пропускается, а играть он должен до конца композиции);
   social (40 с) берёт тот же трек и короче. Лишнее обрежется длиной композиции, последние 3 с —
   затухание.
2. Выровнять долю: `musicOffsetFrames` (props композиции, `src/schema.ts`) — сколько кадров трека
   пропустить, чтобы сильная доля пришлась на кадр 0; отрицательное значение — задержать старт
   музыки на столько кадров. Задаётся в Studio или `--props='{"musicOffsetFrames": 12}'`.
   **Отрицательное смещение — жёсткий старт:** огибающая `musicVolume()` считается от кадра 0
   композиции, поэтому задержанный трек вступает сразу с её текущей громкостью (при −8 — 0,21, при
   −30 и больше — полные 0,8), без своего нарастания.
3. Записать источник и лицензию трека в этот README.
4. С музыкой эффекты перестанут быть всем миксом: перепроверить уровни `SFX_VOLUME` (`earshot measure`,
   `earshot timeline … --cues`) против музыкальной подложки.

## Перегенерация SFX

Нужен earshot (`pip install -e /path/to/earshot`; банк звуков моделей не грузит). Из `video/public/audio`:

```bash
earshot sfx render pro_hover_tick/soft -o click_1.wav --seed 0
earshot sfx render pro_hover_tick/soft -o click_2.wav --seed 1
earshot sfx render typing_key/light    -o key_1.wav   --seed 0
earshot sfx render typing_key/light    -o key_2.wav   --seed 4
earshot sfx render typing_key/light    -o key_3.wav   --seed 8
earshot sfx render typing_key/light    -o key_4.wav   --seed 3
earshot sfx render whoosh_fast/heavy   -o whoosh_1.wav --seed 0
earshot sfx render ui_pop/soft         -o pop_1.wav   --seed 0
earshot sfx render ui_pop/soft         -o pop_2.wav   --seed 1
earshot sfx render notify/mid_wood     -o ding_1.wav  --seed 0
```

Другая длина файла — обновить `samples` в `SFX_TAKES` (тест подскажет). Музыкальная заглушка:

```bash
ffmpeg -y -f lavfi -i anullsrc=r=48000:cl=stereo -t 49 -c:a libmp3lame -b:a 128k -fflags +bitexact -flags:a +bitexact music.mp3
```
