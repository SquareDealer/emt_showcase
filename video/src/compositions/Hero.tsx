import type { ComponentType, ReactNode } from 'react';
import { Audio } from '@remotion/media';
import { TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { Sequence, staticFile } from 'remotion';
import { VideoProviders } from '../providers/VideoProviders';
import { IntroScene } from '../scenes/Intro';
import { BookingScene } from '../scenes/Booking';
import { EstimateScene } from '../scenes/Estimate';
import { BoardScene } from '../scenes/Board';
import { DocsScene } from '../scenes/Docs';
import { SearchScene } from '../scenes/Search';
import { DashboardScene } from '../scenes/Dashboard';
import { OutroScene } from '../scenes/Outro';
import type { ShowcaseProps } from '../schema';
import { SCENES, totalDuration, type SceneDef, type SceneId } from '../timing';
import { assemblyPlan, musicPlacement, musicVolume, sfxCues, type TransitionKind } from './assembly';

const SCENE_COMPONENTS: Record<SceneId, ComponentType<ShowcaseProps>> = {
  intro: IntroScene,
  booking: BookingScene,
  estimate: EstimateScene,
  board: BoardScene,
  docs: DocsScene,
  search: SearchScene,
  dashboard: DashboardScene,
  outro: OutroScene,
};

const PRESENTATIONS = {
  fade: fade(),
  slide: slide({ direction: 'from-right' }),
} as const;
const presentation = (kind: TransitionKind) => PRESENTATIONS[kind];

/**
 * The scenes in a TransitionSeries — each scene enters at `sceneStart()`, since every transition
 * overlaps its neighbours by TRANSITION (scene-local frames stay valid) — plus the music and exactly
 * the `sfxCues(scenes)` sounds (click / key / whoosh, from the same timing tables the scenes draw
 * from). `overlay` is drawn over the scenes (the social cut's brand band).
 */
export function ShowcaseAssembly({
  scenes,
  props,
  overlay,
}: {
  scenes: readonly SceneDef[];
  props: ShowcaseProps;
  overlay?: ReactNode;
}) {
  const total = totalDuration(scenes);
  const music = musicPlacement(props.musicOffsetFrames);
  return (
    <VideoProviders theme={props.theme}>
      <TransitionSeries>
        {assemblyPlan(scenes).map((p) => {
          if (p.type === 'transition') {
            return (
              <TransitionSeries.Transition key={`${p.from}>${p.to}`} presentation={presentation(p.kind)} timing={p.timing} />
            );
          }
          const Scene = SCENE_COMPONENTS[p.id];
          return (
            <TransitionSeries.Sequence key={p.id} name={p.id} durationInFrames={p.dur}>
              <Scene {...props} />
            </TransitionSeries.Sequence>
          );
        })}
      </TransitionSeries>
      <Sequence name="music" from={music.from} layout="none">
        <Audio
          src={staticFile('audio/music.mp3')}
          trimBefore={music.trimBefore}
          volume={(f) => musicVolume(f + music.from, total)}
        />
      </Sequence>
      {sfxCues(scenes).map((c) => (
        <Sequence key={`${c.name}-${c.at}`} name={`${c.name} ${c.at}`} from={c.at} durationInFrames={c.frames} layout="none">
          <Audio src={staticFile(c.src)} volume={c.volume} />
        </Sequence>
      ))}
      {overlay}
    </VideoProviders>
  );
}

export const Hero = (props: ShowcaseProps) => <ShowcaseAssembly scenes={SCENES} props={props} />;
