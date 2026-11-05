import { Composition, Folder } from 'remotion';
import { DebugBoard, DebugCalendar, DebugDashboard, DebugKit, DebugLoop, DebugWorkOrder } from './compositions/Debug';
import { DebugBooking, DebugIntro, DebugOutro } from './compositions/DebugScenes';
import { Hero, HeroSocial } from './compositions/Hero';
import { defaultProps, showcaseSchema } from './schema';
import { FPS, SCENES, SCENES_SOCIAL, totalDuration } from './timing';

const HERO_FRAMES = totalDuration(SCENES);
const SOCIAL_FRAMES = totalDuration(SCENES_SOCIAL);

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="Hero"
        component={Hero}
        schema={showcaseSchema}
        defaultProps={defaultProps}
        width={1920}
        height={1080}
        fps={FPS}
        durationInFrames={HERO_FRAMES}
        calculateMetadata={() => ({ durationInFrames: HERO_FRAMES })}
      />
      <Composition
        id="HeroSocial"
        component={HeroSocial}
        schema={showcaseSchema}
        defaultProps={defaultProps}
        width={1080}
        height={1350}
        fps={FPS}
        durationInFrames={SOCIAL_FRAMES}
        calculateMetadata={() => ({ durationInFrames: SOCIAL_FRAMES })}
      />
      {/* TODO: Loop* (1600x1000), MobileMaster (390x844) and Stills are registered by their tasks. */}
      <Folder name="Debug">
        <Composition id="Debug-Board" component={DebugBoard} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{ theme: 'light' as const }} />
        <Composition id="Debug-WorkOrder" component={DebugWorkOrder} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{ theme: 'light' as const }} />
        <Composition id="Debug-Calendar" component={DebugCalendar} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{ theme: 'light' as const }} />
        <Composition id="Debug-Dashboard" component={DebugDashboard} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{ theme: 'light' as const }} />
        <Composition id="Debug-Kit" component={DebugKit} durationInFrames={90} fps={30} width={1920} height={1080} defaultProps={{ theme: 'light' as const }} />
        <Composition id="Debug-Intro" component={DebugIntro} durationInFrames={75} fps={30} width={1920} height={1080} defaultProps={defaultProps} />
        <Composition id="Debug-Booking" component={DebugBooking} durationInFrames={180} fps={30} width={1920} height={1080} defaultProps={defaultProps} />
        <Composition id="Debug-Outro" component={DebugOutro} durationInFrames={120} fps={30} width={1920} height={1080} defaultProps={defaultProps} />
        <Composition id="Debug-Loop" component={DebugLoop} durationInFrames={60} fps={30} width={1920} height={1080} />
      </Folder>
    </>
  );
};
