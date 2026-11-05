import { Composition, Folder, Still } from 'remotion';
import { DebugBoard, DebugCalendar, DebugDashboard, DebugKit, DebugLoop, DebugWorkOrder } from './compositions/Debug';
import { DebugBoardScene, DebugBooking, DebugDashboardScene, DebugDocsScene, DebugEstimate, DebugSearchScene, DebugIntro, DebugOutro } from './compositions/DebugScenes';
import { Hero } from './compositions/Hero';
import { HeroSocial } from './compositions/Social';
import { MOBILE_FRAMES, MOBILE_H, MOBILE_W, MobileMaster } from './compositions/MobileMaster';
import { LoopBoard, LoopBooking, LoopDiscounts, LoopEstimate, LoopMasterMobile, LoopPriceList } from './compositions/Loops';
import { Cover, OG, ReadmeBoard, ReadmeEstimate, STILLS } from './compositions/Stills';
import { LOOP_DEFS, LOOP_H, LOOP_W, type LoopId } from './compositions/loop-defs';
import { defaultProps, showcaseSchema, type ShowcaseProps } from './schema';
import { FPS, SCENES, SCENES_SOCIAL, totalDuration, type SceneId } from './timing';

const HERO_FRAMES = totalDuration(SCENES);
/** A debug scene runs as long as the scene does in the hero. */
const sceneDur = (id: SceneId) => SCENES.find((s) => s.id === id)!.dur;
const SOCIAL_FRAMES = totalDuration(SCENES_SOCIAL);

const LOOP_COMPONENTS: Record<LoopId, (p: ShowcaseProps) => JSX.Element> = {
  LoopBooking,
  LoopEstimate,
  LoopDiscounts,
  LoopPriceList,
  LoopBoard,
  LoopMasterMobile,
};

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
      {/* Pre-rendered by `npm run prerender:mobile` → public/prerender/mobile-master.mp4 (PhoneFrame plays it). */}
      <Composition
        id="MobileMaster"
        component={MobileMaster}
        schema={showcaseSchema}
        defaultProps={defaultProps}
        width={MOBILE_W}
        height={MOBILE_H}
        fps={FPS}
        durationInFrames={MOBILE_FRAMES}
      />
      {/* Feature loops: 1600×1000, each ends in its first frame (`npm run loops:check`). */}
      <Folder name="Loops">
        {LOOP_DEFS.map((d) => (
          <Composition
            key={d.id}
            id={d.id}
            component={LOOP_COMPONENTS[d.id]}
            schema={showcaseSchema}
            defaultProps={defaultProps}
            width={LOOP_W}
            height={LOOP_H}
            fps={FPS}
            durationInFrames={d.dur}
          />
        ))}
      </Folder>
      {/* One-frame stills: `npm run render:stills` (Cover at --scale=2). */}
      <Folder name="Stills">
        <Still id="Cover" component={Cover} schema={showcaseSchema} defaultProps={defaultProps} {...STILLS.Cover} />
        <Still id="OG" component={OG} schema={showcaseSchema} defaultProps={defaultProps} {...STILLS.OG} />
        <Still id="ReadmeEstimate" component={ReadmeEstimate} schema={showcaseSchema} defaultProps={defaultProps} {...STILLS.ReadmeEstimate} />
        <Still id="ReadmeBoard" component={ReadmeBoard} schema={showcaseSchema} defaultProps={defaultProps} {...STILLS.ReadmeBoard} />
      </Folder>
      <Folder name="Debug">
        <Composition id="Debug-BoardStatic" component={DebugBoard} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{ theme: 'light' as const }} />
        <Composition id="Debug-WorkOrder" component={DebugWorkOrder} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{ theme: 'light' as const }} />
        <Composition id="Debug-Calendar" component={DebugCalendar} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{ theme: 'light' as const }} />
        <Composition id="Debug-DashboardStatic" component={DebugDashboard} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{ theme: 'light' as const }} />
        <Composition id="Debug-Kit" component={DebugKit} durationInFrames={90} fps={30} width={1920} height={1080} defaultProps={{ theme: 'light' as const }} />
        <Composition id="Debug-Intro" component={DebugIntro} durationInFrames={sceneDur('intro')} fps={30} width={1920} height={1080} defaultProps={defaultProps} />
        <Composition id="Debug-Booking" component={DebugBooking} durationInFrames={sceneDur('booking')} fps={30} width={1920} height={1080} defaultProps={defaultProps} />
        <Composition id="Debug-Estimate" component={DebugEstimate} durationInFrames={sceneDur('estimate')} fps={30} width={1920} height={1080} defaultProps={defaultProps} />
        <Composition id="Debug-Board" component={DebugBoardScene} durationInFrames={sceneDur('board')} fps={30} width={1920} height={1080} defaultProps={defaultProps} />
        <Composition id="Debug-Docs" component={DebugDocsScene} durationInFrames={sceneDur('docs')} fps={30} width={1920} height={1080} defaultProps={defaultProps} />
        <Composition id="Debug-Search" component={DebugSearchScene} durationInFrames={sceneDur('search')} fps={30} width={1920} height={1080} defaultProps={defaultProps} />
        <Composition id="Debug-Dashboard" component={DebugDashboardScene} durationInFrames={sceneDur('dashboard')} fps={30} width={1920} height={1080} defaultProps={defaultProps} />
        <Composition id="Debug-Outro" component={DebugOutro} durationInFrames={sceneDur('outro')} fps={30} width={1920} height={1080} defaultProps={defaultProps} />
        <Composition id="Debug-Loop" component={DebugLoop} durationInFrames={60} fps={30} width={1920} height={1080} />
      </Folder>
    </>
  );
};
