// TEMPORARY placeholder: one block per scene (id + frame range) until the scene tasks land.
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { VideoProviders } from '../providers/VideoProviders';
import { IntroScene } from '../scenes/Intro';
import { OutroScene } from '../scenes/Outro';
import type { ShowcaseProps } from '../schema';
import { SCENES, SCENES_SOCIAL, sceneStart } from '../timing';
import type { SceneDef } from '../timing';

const Placeholder = ({ scenes, props }: { scenes: readonly SceneDef[]; props: ShowcaseProps }) => {
  const frame = useCurrentFrame();
  const active = [...scenes].reverse().find((s) => frame >= sceneStart(s.id, scenes)) ?? scenes[0];
  const start = sceneStart(active.id, scenes);
  const real = (id: 'intro' | 'outro', Scene: typeof IntroScene) => {
    const def = scenes.find((s) => s.id === id);
    return def ? (
      <Sequence from={sceneStart(id, scenes)} durationInFrames={def.dur} layout="none">
        <Scene {...props} />
      </Sequence>
    ) : null;
  };
  return (
    <VideoProviders theme={props.theme}>
    <AbsoluteFill
      style={{ background: props.theme === 'dark' ? '#111' : '#fff', color: '#888', justifyContent: 'center', alignItems: 'center', fontSize: 48 }}
    >
      {props.brand.name} · {active.id} [{start}–{start + active.dur}] · frame {frame}
    </AbsoluteFill>
    {real('intro', IntroScene)}
    {real('outro', OutroScene)}
    </VideoProviders>
  );
};

export const Hero = (props: ShowcaseProps) => <Placeholder scenes={SCENES} props={props} />;
export const HeroSocial = (props: ShowcaseProps) => <Placeholder scenes={SCENES_SOCIAL} props={props} />;
