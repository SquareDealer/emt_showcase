// TEMPORARY placeholder: one block per scene (id + frame range) until the scene tasks land.
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { ShowcaseProps } from '../schema';
import { SCENES, SCENES_SOCIAL, sceneStart } from '../timing';
import type { SceneDef } from '../timing';

const Placeholder = ({ scenes, props }: { scenes: readonly SceneDef[]; props: ShowcaseProps }) => {
  const frame = useCurrentFrame();
  const active = [...scenes].reverse().find((s) => frame >= sceneStart(s.id, scenes)) ?? scenes[0];
  const start = sceneStart(active.id, scenes);
  return (
    <AbsoluteFill
      style={{ background: props.theme === 'dark' ? '#111' : '#fff', color: '#888', justifyContent: 'center', alignItems: 'center', fontSize: 48 }}
    >
      {props.brand.name} · {active.id} [{start}–{start + active.dur}] · frame {frame}
    </AbsoluteFill>
  );
};

export const Hero = (props: ShowcaseProps) => <Placeholder scenes={SCENES} props={props} />;
export const HeroSocial = (props: ShowcaseProps) => <Placeholder scenes={SCENES_SOCIAL} props={props} />;
