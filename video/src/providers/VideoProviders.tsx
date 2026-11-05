import type { ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { NowProvider } from '@crm/lib/now';
import { meta } from '../fixtures';
// Order matters: the CRM's layered stylesheet, every feature stylesheet the app loads globally,
// then the unlayered video overrides last.
import '@crm/index.css';
import './crm-styles';
import '../video.css';
import '../fonts';

/** The video's «now» — never the wall clock (see CLAUDE.md «Video», determinism). */
const DEMO_NOW = new Date(meta.demoNow);

/**
 * Everything a composition needs around the CRM views: pinned «now», the CRM stylesheet + video
 * overrides, fonts, and the theme's tokens for whatever is drawn outside an AppWindow.
 *
 * No router here: react-router forbids nesting routers, and each AppWindow owns a MemoryRouter
 * for its own route (active nav item), so two windows can show different screens side by side.
 */
export function VideoProviders({ theme, children }: { theme: 'light' | 'dark'; children: ReactNode }) {
  return (
    <NowProvider value={DEMO_NOW}>
      <AbsoluteFill data-theme={theme}>{children}</AbsoluteFill>
    </NowProvider>
  );
}
