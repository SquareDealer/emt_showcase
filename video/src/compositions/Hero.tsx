import type { ComponentType } from 'react';
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
import { SCENES, SCENES_SOCIAL, totalDuration, type SceneDef, type SceneId } from '../timing';
import {
  SFX,
  assemblyPlan,
  heroClickSfx,
  heroKeySfx,
  heroWhooshSfx,
  musicPlacement,
  musicVolume,
  type TransitionKind,
} from './assembly';

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

/** One short sound per frame in `at` (absolute frames). */
function SfxTrack({ at, sfx, name }: { at: readonly number[]; sfx: (typeof SFX)[keyof typeof SFX]; name: string }) {
  return (
    <>
      {at.map((from) => (
        <Sequence key={`${name}-${from}`} name={`${name} ${from}`} from={from} durationInFrames={sfx.frames} layout="none">
          <Audio src={staticFile(sfx.src)} volume={sfx.volume} />
        </Sequence>
      ))}
    </>
  );
}

/**
 * The scenes in a TransitionSeries — each scene enters at `sceneStart()`, since every transition
 * overlaps its neighbours by TRANSITION (scene-local frames stay valid) — plus the music and the
 * click / key / whoosh sounds from the same timing tables the scenes draw from.
 */
export function ShowcaseAssembly({ scenes, props }: { scenes: readonly SceneDef[]; props: ShowcaseProps }) {
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
      <SfxTrack name="click" at={heroClickSfx(scenes)} sfx={SFX.click} />
      <SfxTrack name="key" at={heroKeySfx(scenes)} sfx={SFX.key} />
      <SfxTrack name="whoosh" at={heroWhooshSfx(scenes)} sfx={SFX.whoosh} />
    </VideoProviders>
  );
}

export const Hero = (props: ShowcaseProps) => <ShowcaseAssembly scenes={SCENES} props={props} />;
// Task 17 moves the social cut to Social.tsx.
export const HeroSocial = (props: ShowcaseProps) => <ShowcaseAssembly scenes={SCENES_SOCIAL} props={props} />;
