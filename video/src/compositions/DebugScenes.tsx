// Standalone scene compositions for stills: one per scene, full props from the schema defaults.
import { VideoProviders } from '../providers/VideoProviders';
import type { ShowcaseProps } from '../schema';
import { IntroScene } from '../scenes/Intro';
import { BookingScene } from '../scenes/Booking';
import { OutroScene } from '../scenes/Outro';

export const DebugIntro = (p: ShowcaseProps) => (
  <VideoProviders theme="dark">
    <IntroScene {...p} />
  </VideoProviders>
);
export const DebugOutro = (p: ShowcaseProps) => (
  <VideoProviders theme="dark">
    <OutroScene {...p} />
  </VideoProviders>
);
export const DebugBooking = (p: ShowcaseProps) => (
  <VideoProviders theme={p.theme}>
    <BookingScene {...p} />
  </VideoProviders>
);
