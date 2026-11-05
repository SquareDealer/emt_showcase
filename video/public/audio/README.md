# Звук шоукейса

Все файлы сгенерированы `ffmpeg` (синтез: синус + отфильтрованный шум с фиксированным `seed`),
48 кГц — без лицензионных ограничений.

| Файл         | Что                                               | Где звучит (`src/compositions/assembly.ts`)       |
|--------------|---------------------------------------------------|---------------------------------------------------|
| `click.wav`  | клик мыши, 60 мс                                  | `heroClickSfx()` = `clicksAbsolute()`, громкость 0.5 |
| `key.wav`    | клавиша, 30 мс, тише и выше                       | `heroKeySfx()` — каждый символ ⌘K в Search, 0.2   |
| `whoosh.wav` | «вжух», 400 мс, розовый шум в полосе + чирп       | `heroWhooshSfx()` — начало каждого `slide`, 0.3   |
| `music.mp3`  | **плейсхолдер: тишина** 37,0 с (1110 кадров)      | вся композиция, огибающая `musicVolume()`         |

## Замена музыки

`music.mp3` — заглушка, пока не выбран лицензионный трек 120 BPM (сетка видео: удар = 15 кадров,
клики и склейки стоят на ударах). Чтобы заменить:

1. Положить трек сюда же под именем `music.mp3` (длина ≥ 37 с; лишнее обрежется длиной композиции,
   последние 3 с — затухание).
2. Выровнять долю: `musicOffsetFrames` (props композиции, `src/schema.ts`) — сколько кадров трека
   пропустить, чтобы сильная доля пришлась на кадр 0; отрицательное значение — задержать старт
   музыки на столько кадров. Задаётся в Studio или `--props='{"musicOffsetFrames": 12}'`.
3. Записать источник и лицензию трека в этот README.

## Перегенерация SFX

```bash
cd video/public/audio
ffmpeg -y -filter_complex "aevalsrc='(0.6*sin(2*PI*2300*t)+0.3*sin(2*PI*4700*t))*exp(-t*110)':s=48000:d=0.06[a];anoisesrc=d=0.06:r=48000:a=0.45:c=white:seed=11,highpass=f=1800,lowpass=f=8000,afade=t=out:st=0:d=0.05:curve=exp[n];[a][n]amix=inputs=2:normalize=0,afade=t=in:d=0.0015,afade=t=out:st=0.05:d=0.01,alimiter=limit=0.9:level=disabled" -ar 48000 -ac 1 -c:a pcm_s16le -fflags +bitexact -flags:a +bitexact click.wav
ffmpeg -y -filter_complex "aevalsrc='(0.45*sin(2*PI*3600*t)+0.2*sin(2*PI*6100*t))*exp(-t*200)':s=48000:d=0.03[a];anoisesrc=d=0.03:r=48000:a=0.3:c=white:seed=23,highpass=f=3000,lowpass=f=9000,afade=t=out:st=0:d=0.025:curve=exp[n];[a][n]amix=inputs=2:normalize=0,afade=t=in:d=0.001,afade=t=out:st=0.024:d=0.006,alimiter=limit=0.7:level=disabled" -ar 48000 -ac 1 -c:a pcm_s16le -fflags +bitexact -flags:a +bitexact key.wav
ffmpeg -y -filter_complex "anoisesrc=d=0.4:r=48000:a=0.6:c=pink:seed=37,bandpass=f=1200:width_type=o:w=2.5,afade=t=in:st=0:d=0.24:curve=qsin,afade=t=out:st=0.24:d=0.16:curve=exp[n];aevalsrc='0.12*sin(2*PI*(250*t+700*t*t))*sin(PI*t/0.4)':s=48000:d=0.4[c];[n][c]amix=inputs=2:normalize=0,alimiter=limit=0.8:level=disabled" -ar 48000 -ac 1 -c:a pcm_s16le -fflags +bitexact -flags:a +bitexact whoosh.wav
ffmpeg -y -f lavfi -i anullsrc=r=48000:cl=stereo -t 37 -c:a libmp3lame -b:a 128k -fflags +bitexact -flags:a +bitexact music.mp3
```
