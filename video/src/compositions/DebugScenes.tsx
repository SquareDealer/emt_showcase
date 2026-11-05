// Standalone scene compositions for stills: one per scene, full props from the schema defaults.
import { VideoProviders } from '../providers/VideoProviders';
import type { ShowcaseProps } from '../schema';
import { IntroScene } from '../scenes/Intro';
import { BookingScene } from '../scenes/Booking';
import { EstimateScene } from '../scenes/Estimate';
import { BoardScene } from '../scenes/Board';
import { DocsScene } from '../scenes/Docs';
import { SearchScene } from '../scenes/Search';
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
export const DebugEstimate = (p: ShowcaseProps) => (
  <VideoProviders theme={p.theme}>
    <EstimateScene {...p} />
  </VideoProviders>
);
export const DebugBoardScene = (p: ShowcaseProps) => (
  <VideoProviders theme={p.theme}>
    <BoardScene {...p} />
  </VideoProviders>
);
export const DebugDocsScene = (p: ShowcaseProps) => (
  <VideoProviders theme={p.theme}>
    <DocsScene {...p} />
  </VideoProviders>
);
export const DebugSearchScene = (p: ShowcaseProps) => (
  <VideoProviders theme={p.theme}>
    <SearchScene {...p} />
  </VideoProviders>
);
