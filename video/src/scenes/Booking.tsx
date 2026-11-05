import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { addDays, startOfWeek } from 'date-fns';
import { AppShellView } from '@crm/components/AppShellView';
import { CalendarView } from '@crm/features/calendar/CalendarView';
import { SlotMenu } from '@crm/features/calendar/SlotMenu';
import { calendarRangeLabel, navForRole, workOrderToEvent } from '@crm/lib/view-helpers';
import { blockToEvent } from '@crm/lib/schedule';
import type { TimelineCfg, TimelineEvent } from '@crm/lib/schedule';
import { SELECTION_ID } from '@crm/components/ScheduleTimeline';
import type { Brand } from '@crm/lib/brand';
import { heroSchedule } from '../../../demo/seed/hero';
import { blocksWeek, calendarWeek, DEMO_NOW, settings, users, woHero } from '../fixtures';
import type { ShowcaseProps } from '../schema';
import { AppWindow } from '../kit/AppWindow';
import { Background } from '../kit/Background';
import { Camera } from '../kit/Camera';
import { Cursor } from '../kit/Cursor';
import { Callout } from '../kit/Callout';
import type { CamKey, CursorPoint } from '../kit/math';
import { useLayout } from '../kit/useLayout';
import { FPS, SCENE_CLICKS } from '../timing';

// ---------------------------------------------------------------------------------------------
// Target geometry, UI pixels of the 1440×900 AppWindow (top-left = 0,0). Measured from the
// rendered DOM: a throwaway composition rendered BookingWindow at zoom 1 (state of frame 95) and
// logged getBoundingClientRect() of each node minus the `.crm-root` rect. Cross-check with the
// ScheduleTimeline geometry: Thursday's column (`.stl-col[data-di="3"]`) is x 785.3, w 157.4, its
// 08:00 line at y 245 → 14:00 = 245 + 360 min · 0.8 px/min = 533, 120 min = 96 px.
//   SLOT     `.stl-ev[data-sel]` (the 14:00–16:00 ghost): x 788.3 y 533 w 152.4 h 96 — the landed
//            hero event `[data-id="hero-copy"]` takes the same box (no lane split: its neighbours
//            08:00–14:00 and 16:00–17:30 only touch it).
//   MENU     the wrapper we place the inline SlotMenu in; its <dialog> measured 420×205 at MENU.x/y.
//   BOOKING  `[data-demo="slot-booking"]` («Новая запись»): x 974 y 585.5 w 386 h 54.5; the cursor
//            tip lands on the label text, left part of the row.
// ---------------------------------------------------------------------------------------------
const SLOT = { x: 788, y: 533, w: 152, h: 96 };
const MENU = { x: 957, y: 509, w: 420, h: 205 }; // x = slot's right edge + 14, y = slot top − 24
const BOOKING = { x: 1062, y: 600 };

const slotCentre = { x: SLOT.x + SLOT.w / 2, y: SLOT.y + SLOT.h / 2 };

const [CLICK_SLOT, CLICK_BOOKING] = SCENE_CLICKS.booking;
const MENU_IN = 82;
const CALLOUT_AT = 90;
const LAND_AT = 120;

/** Brand for the sidebar: trimmed logos (the originals' padding reads tiny at 44px). */
const brandFor = (name: string): Brand => ({
  name,
  logoLight: staticFile('brand/garage-crm-logo-light-sidebar.png'),
  logoDark: staticFile('brand/garage-crm-logo-dark-sidebar.png'),
});

const owner = users.find((u) => u.role === 'owner');
if (!owner) throw new Error('fixtures/users.json: no owner');

// ---- calendar data (fixtures only) ----
const DEFAULT_DUR = settings.default_appointment_min;
const WEEK_START = startOfWeek(DEMO_NOW, { weekStartsOn: 1 });
const DAYS = Array.from({ length: 7 }, (_, i) => addDays(WEEK_START, i));
const CFG: TimelineCfg = {
  startHour: settings.working_hours_start,
  endHour: settings.working_hours_end,
  slotMin: settings.slot_minutes,
  pxPerMin: 0.8,
};
const { freeSlot } = heroSchedule(DEMO_NOW);
const HERO_WO = woHero[0];
const BASE_EVENTS: TimelineEvent[] = [
  ...calendarWeek.flatMap((w) => workOrderToEvent(w, DEFAULT_DUR, { showMaster: true }) ?? []),
  ...blocksWeek.map(blockToEvent),
];
if (BASE_EVENTS.some((e) => e.id === HERO_WO.id)) throw new Error('calendar.week.json already holds the hero order');
/** The hero order, booked into the free slot (title/client/master from wo-hero.0). */
const HERO_EVENT: TimelineEvent = {
  ...workOrderToEvent({ ...HERO_WO, scheduled_at: freeSlot.startsAt.toISOString() }, DEFAULT_DUR, { showMaster: true })!,
  durationMin: freeSlot.durationMin,
};
/** The ghost the empty-slot click leaves: same box as the order that will land there. */
const GHOST: TimelineEvent = {
  id: SELECTION_ID,
  start: freeSlot.startsAt,
  durationMin: freeSlot.durationMin,
  kind: 'selection',
};
const SLOT_ISO = freeSlot.startsAt.toISOString();

// ---- camera (seconds, UI px at frame centre) and cursor ----
// Wide 0–1 s → 1.7× on the free slot + menu by 2 s → hold → dive into the landed order 5–6 s.
// At 1.7× the frame shows 1129×635 UI px. FOCUS keeps the slot, the menu (right of it) and the day
// headers in frame: x ≤ 1440 − 960/1.7 (window's right edge at the frame's edge, menu ends at
// 1377); y 500 → rows 182–818, i.e. from just above the column heads (189.5) to the grid's bottom (821).
const FOCUS = { x: 872, y: 500 };
const cameraKeys = (wideZoom: number): CamKey[] => [
  { at: 0, x: 720, y: 450, zoom: wideZoom },
  { at: 1, x: 720, y: 450, zoom: wideZoom },
  { at: 2, x: FOCUS.x, y: FOCUS.y, zoom: 1.7 },
  { at: 5, x: FOCUS.x, y: FOCUS.y, zoom: 1.7 },
  { at: 6, x: slotCentre.x, y: slotCentre.y, zoom: 2.6 },
];

const s = (f: number) => f / FPS;
// Cursor: idles low-right, glides onto the slot, then onto «Новая запись», then clears out to
// the lower right (off-frame once the camera dives) so it never sits on the landed order.
const CURSOR: CursorPoint[] = [
  { at: 0, x: 1120, y: 780 },
  { at: s(30), x: 1120, y: 780 },
  { at: s(CLICK_SLOT - 6), x: slotCentre.x + 6, y: slotCentre.y + 4 },
  { at: s(MENU_IN + 4), x: slotCentre.x + 6, y: slotCentre.y + 4 },
  { at: s(CLICK_BOOKING - 5), x: BOOKING.x, y: BOOKING.y },
  { at: s(CLICK_BOOKING + 12), x: BOOKING.x, y: BOOKING.y },
  { at: s(150), x: 1290, y: 830 },
];

/** Scene-local state: a pure function of the frame. */
export function bookingState(frame: number, fps: number) {
  const landed = frame >= LAND_AT;
  const land = spring({ frame: frame - LAND_AT, fps, config: { damping: 14, stiffness: 160, mass: 0.6 } });
  const menuIn = spring({ frame: frame - MENU_IN, fps, config: { damping: 200 }, durationInFrames: 9 });
  const menuOut = interpolate(frame, [CLICK_BOOKING + 2, CLICK_BOOKING + 7], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return {
    selection: frame >= CLICK_SLOT && !landed ? GHOST : null,
    events: landed ? [...BASE_EVENTS, HERO_EVENT] : BASE_EVENTS,
    menuOpacity: frame >= MENU_IN ? Math.min(menuIn, menuOut) : 0,
    menuScale: interpolate(menuIn, [0, 1], [0.96, 1]),
    hoverBooking: frame >= CLICK_BOOKING - 5 && frame <= CLICK_BOOKING + 7,
    heroStyle: landed
      ? ({
          opacity: interpolate(land, [0, 0.6], [0, 1], { extrapolateRight: 'clamp' }),
          transform: `scale(${interpolate(land, [0, 1], [0.86, 1])})`,
          transformOrigin: 'center',
          zIndex: 4,
        } satisfies CSSProperties)
      : undefined,
    highlight: frame >= LAND_AT + 15,
  };
}

const noop = () => {};

/** The CRM window at a given state (no camera) — also what the coordinates above were measured on. */
export function BookingWindow({
  theme,
  brandName,
  state,
}: {
  theme: 'light' | 'dark';
  brandName: string;
  state: ReturnType<typeof bookingState>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  // SlotMenu has no hover prop; the app's own `.list-row[data-hover]` twin of :hover is toggled here.
  useLayoutEffect(() => {
    menuRef.current?.querySelector('[data-demo="slot-booking"]')?.toggleAttribute('data-hover', state.hoverBooking);
  });
  return (
    <AppWindow theme={theme} route="/calendar">
      <AppShellView
        userName={owner!.name}
        nav={navForRole('owner')}
        theme={theme}
        drawerOpen={false}
        brand={brandFor(brandName)}
        onOpenSearch={noop}
        onNewIntake={noop}
        onToggleTheme={noop}
        onLogout={noop}
        onOpenDrawer={noop}
        onCloseDrawer={noop}
      >
        <CalendarView
          days={DAYS}
          view="week"
          orientation="vertical"
          rangeLabel={calendarRangeLabel('week', DAYS)}
          events={state.events}
          cfg={CFG}
          now={DEMO_NOW}
          selection={state.selection}
          defaultDurationMin={DEFAULT_DUR}
          highlightId={state.highlight ? HERO_EVENT.id : undefined}
          eventStyle={(id) => (id === HERO_EVENT.id ? state.heroStyle : undefined)}
          onView={noop}
          onOrientation={noop}
          onPrev={noop}
          onToday={noop}
          onNext={noop}
          onEventClick={noop}
          onEventMove={noop}
          onEventResize={noop}
          onEmptyClick={noop}
        />
      </AppShellView>
      {state.menuOpacity > 0 ? (
        <div
          ref={menuRef}
          data-demo="booking-menu"
          style={
            {
              position: 'absolute',
              left: MENU.x,
              top: MENU.y,
              width: MENU.w,
              height: MENU.h,
              opacity: state.menuOpacity,
              transform: `scale(${state.menuScale})`,
              transformOrigin: '0 50%',
              // The inline Modal brings a full-cover dim; as a popover next to the slot it has none.
              '--backdrop': 'transparent',
              zIndex: 20,
            } as CSSProperties
          }
        >
          <SlotMenu
            inline
            slot={{ startISO: SLOT_ISO, durationMin: freeSlot.durationMin }}
            onClose={noop}
            onBooking={noop}
            onReserve={noop}
          />
        </div>
      ) : null}
    </AppWindow>
  );
}

/**
 * Booking (180 f): week calendar → click the free Thursday 14:00 slot (75) → ghost + slot menu (82)
 * → callout (90) → «Новая запись» (105) → the hero order springs into the slot (120) → camera dives
 * into it (150–180).
 */
export function BookingScene({ theme, brand, callouts, accent }: ShowcaseProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const social = useLayout() === 'social';
  const state = bookingState(frame, fps);
  return (
    <AbsoluteFill>
      <Background theme={theme} />
      <Camera keys={cameraKeys(social ? 0.72 : 1)}>
        <BookingWindow theme={theme} brandName={brand.name} state={state} />
        {/* Above the slot, over the empty bodies of the long morning orders: clear of the ghost,
            the menu and the landed order's text. */}
        <Callout
          text={callouts.booking}
          at={CALLOUT_AT}
          anchor={{ x: SLOT.x + 44, y: SLOT.y }}
          side="top"
          accent={accent}
        />
        <Cursor path={CURSOR} clicks={SCENE_CLICKS.booking} accent={accent} />
      </Camera>
    </AbsoluteFill>
  );
}
