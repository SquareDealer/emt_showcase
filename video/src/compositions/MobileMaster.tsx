import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { MemoryRouter } from 'react-router-dom';
import { AppShellView } from '@crm/components/AppShellView';
import { BoardView } from '@crm/features/board/BoardView';
import { canAssignMaster } from '@crm/lib/roles';
import type { Brand } from '@crm/lib/brand';
import { VideoProviders } from '../providers/VideoProviders';
import type { ShowcaseProps } from '../schema';
import { MASTER, MASTER_NAV, MOBILE_COLUMNS, MOBILE_H, MOBILE_W, mobileMasterState } from './mobile-master';

export { MOBILE_FRAMES, MOBILE_H, MOBILE_W } from './mobile-master';

// MobileMaster (390×844, 180 f) — timeline, geometry and data in ./mobile-master (pure, tested).

const brandFor = (name: string): Brand => ({
  name,
  logoLight: staticFile('brand/garage-crm-logo-light-sidebar.png'),
  logoDark: staticFile('brand/garage-crm-logo-dark-sidebar.png'),
});

const noop = () => {};

/** Finger tap: a soft filled dot, squeezed on the tap, with the cursor's expanding ring. */
function TapMark({ tap, accent }: { tap: NonNullable<ReturnType<typeof mobileMasterState>['tap']>; accent: string }) {
  const dot = 34 * tap.press;
  const ring = 34 + tap.ring * 40;
  return (
    <div style={{ position: 'absolute', left: tap.x, top: tap.y, width: 0, height: 0, zIndex: tap.z, opacity: tap.opacity }}>
      <div
        style={{
          position: 'absolute',
          left: -dot / 2,
          top: -dot / 2,
          width: dot,
          height: dot,
          borderRadius: '50%',
          background: 'rgb(255 255 255 / 0.55)',
          boxShadow: '0 0 0 1.5px rgb(0 0 0 / 0.25), 0 2px 6px rgb(0 0 0 / 0.25)',
        }}
      />
      {tap.ring > 0 && tap.ring < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: -ring / 2,
            top: -ring / 2,
            width: ring,
            height: ring,
            borderRadius: '50%',
            border: `3px solid ${accent}`,
            opacity: 1 - tap.ring,
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * The master on the phone: the board (only their own orders, no master row on the cards, as the
 * app shows it to a plain master) → tap ☰ (15): the drawer with navForRole('master') — no
 * «Прайс-лист», no «Настройки» → tap × (60) → 75–180 the board pans out to «Выдана» and back.
 * Frame 0 and the last frame show the same picture.
 */
export function MobileMasterScene({ theme, brand, accent }: ShowcaseProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = mobileMasterState(frame, fps);
  return (
    <AbsoluteFill>
      <div
        className="crm-root"
        data-theme={theme}
        data-demo="mobile-master"
        style={{
          position: 'relative',
          width: MOBILE_W,
          height: MOBILE_H,
          overflow: 'hidden',
          // the window is the containing block of the drawer/backdrop (position: fixed)
          contain: 'paint',
          background: 'var(--bg)',
          ['--shell-h' as string]: `${MOBILE_H}px`,
        }}
      >
        {/* Per-frame motion of the app's own pieces (CSS transitions are off in the video):
            the drawer's slide (the app animates `.sidebar` translateX(-100%) → none), its
            backdrop's fade, and the board's horizontal pan (columns slide inside the `.board` clip,
            as in the Board scene — a scrollLeft wouldn't paint in stills). */}
        <style>{`
[data-demo="mobile-master"] .sidebar { transform: translateX(${(state.drawer - 1) * 100}%) !important; }
[data-demo="mobile-master"] .sidebar-backdrop { opacity: ${state.drawer}; }
[data-demo="mobile-master"] .board-col { transform: translateX(${-state.scroll}px); }
`}</style>
        <MemoryRouter initialEntries={['/board']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppShellView
            userName={MASTER.name}
            nav={MASTER_NAV}
            theme={theme}
            drawerOpen={state.drawerOpen}
            brand={brandFor(brand.name)}
            onOpenSearch={noop}
            onNewIntake={noop}
            onToggleTheme={noop}
            onLogout={noop}
            onOpenDrawer={noop}
            onCloseDrawer={noop}
          >
            <BoardView
              columns={MOBILE_COLUMNS}
              showMaster={canAssignMaster(MASTER.role)}
              activeId={null}
              onOpen={noop}
              onDragStart={noop}
              onDragEnd={noop}
            />
          </AppShellView>
        </MemoryRouter>
        {state.tap ? <TapMark tap={state.tap} accent={accent} /> : null}
      </div>
    </AbsoluteFill>
  );
}

export const MobileMaster = (p: ShowcaseProps) => (
  <VideoProviders theme={p.theme}>
    <MobileMasterScene {...p} />
  </VideoProviders>
);
