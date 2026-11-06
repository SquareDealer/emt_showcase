import type { ComponentType, ReactNode } from 'react';
import { Audio } from '@remotion/media';
import { TransitionSeries } from '@remotion/transitions';
import { Sequence, staticFile } from 'remotion';
import { VideoProviders } from '../providers/VideoProviders';
import { IntroScene } from '../scenes/Intro';
import { BookingScene, landedCardRect } from '../scenes/Booking';
import { EstimateScene } from '../scenes/Estimate';
import { BoardScene } from '../scenes/Board';
import { DocsScene } from '../scenes/Docs';
import { SearchScene } from '../scenes/Search';
import { DashboardScene } from '../scenes/Dashboard';
import { OutroScene } from '../scenes/Outro';
import type { ShowcaseProps } from '../schema';
import { cameraTransition, type CameraProps } from '../kit/CameraWipe';
import type { Layout } from '../kit/math';
import { TRANSITION, SCENES, totalDuration, type SceneDef, type SceneId } from '../timing';
import { assemblyPlan, musicPlacement, musicVolume, sfxCues, type TransitionSpec } from './assembly';

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

/** Scenes drawn on the brand's dark ground (their Background theme); the CRM scenes use the theme prop. */
const DARK_SCENES: readonly SceneId[] = ['intro', 'docs', 'outro'];

/** The presentation of a planned transition (kit/CameraWipe). The card opens out of the landed order's
 *  on-screen rect in the outgoing booking — its camera at the transition's frame (dur − T + p·T). */
function presentation(spec: TransitionSpec, from: SceneDef, to: SceneId, props: ShowcaseProps) {
  const layout = (w: number, h: number): Layout => (w < h ? 'social' : 'wide');
  const fromFrame = (p: number) => from.dur - TRANSITION + p * TRANSITION;
  const camera: CameraProps =
    spec.kind === 'card'
      ? {
          kind: 'card',
          rect: (p, w, h) => landedCardRect(fromFrame(p), layout(w, h), w, h),
          radius: (p, w, h) => landedCardRect(fromFrame(p), layout(w, h), w, h).radius,
          accent: props.accent,
        }
      : {
          kind: 'wipe',
          from: spec.from,
          focus: spec.focus,
          backdrop: DARK_SCENES.includes(to) ? 'dark' : props.theme,
          accent: props.accent,
        };
  return cameraTransition(camera);
}

/**
 * The scenes in a TransitionSeries — each scene enters at `sceneStart()`, since every transition
 * overlaps its neighbours by TRANSITION (scene-local frames stay valid), joined by the continuous-camera
 * presentations of assemblyPlan() (kit/CameraWipe) — plus the music and exactly
 * the `sfxCues(scenes)` sounds (click / key / whoosh / pop / ding, from the same timing tables the scenes draw
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
            const from = scenes.find((x) => x.id === p.from)!;
            return (
              <TransitionSeries.Transition
                key={`${p.from}>${p.to}`}
                presentation={presentation(p.spec, from, p.to, props)}
                timing={p.timing}
              />
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
