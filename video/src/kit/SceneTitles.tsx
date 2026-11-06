import { chapterIndex, cutScenes, type ChapterKey } from '../chapters';
import type { ShowcaseProps } from '../schema';
import { useVideoConfig } from 'remotion';
import { ChapterTitle, SLATE_BG } from './ChapterTitle';
import { captionBandFits } from './Background';
import { useLayout } from './useLayout';
import { SOCIAL_FRAME } from './math';

/** One chapter title of a scene: its copy, and the scene-local frames it comes in (`at`, on a beat) and
 *  goes out (`out`). */
export type TitleCue = { key: ChapterKey; at: number; out: number };

/**
 * A scene's chapter titles (and, in the social cut, the band they sit in), frame-fixed (draw it outside
 * the scene's Camera), numbered in the cut the
 * scene plays in (hero «NN / 07», social «NN / 06»). `numbered={false}` (the feature loops): the slate
 * without an index — a loop is not a chapter of anything.
 */
export function SceneTitles({
  cues,
  chapters,
  accent,
  numbered = true,
}: {
  cues: readonly TitleCue[];
  chapters: ShowcaseProps['chapters'];
  accent: string;
  numbered?: boolean;
}) {
  const layout = useLayout();
  const { width, height } = useVideoConfig();
  const scenes = cutScenes(layout === 'social');
  return (
    <>
      {/* Social: the chapter band is the frame's, over the UI at all times (between titles too, and
          through the transitions, where both scenes carry it), never a strip of window. */}
      {captionBandFits(layout, width, height) ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width,
            height: SOCIAL_FRAME.captionH,
            background: SLATE_BG,
            zIndex: 89,
          }}
        />
      ) : null}
      {cues.map((c) => (
        <ChapterTitle
          key={c.key}
          copy={chapters[c.key]}
          index={numbered ? chapterIndex(c.key, scenes) : undefined}
          at={c.at}
          out={c.out}
          accent={accent}
        />
      ))}
    </>
  );
}
