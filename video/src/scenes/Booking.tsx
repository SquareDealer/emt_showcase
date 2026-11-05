import { useId, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { addDays, isSameDay, setHours, startOfWeek } from 'date-fns';
import { AppShellView } from '@crm/components/AppShellView';
import { CalendarView } from '@crm/features/calendar/CalendarView';
import { SlotMenu } from '@crm/features/calendar/SlotMenu';
import { calendarRangeLabel, navForRole, workOrderToEvent } from '@crm/lib/view-helpers';
import { assignLanes, blockToEvent } from '@crm/lib/schedule';
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
import { Callout, type Side } from '../kit/Callout';
import { CAM_EASE, socialKeyForView, type CamKey, type CursorPoint } from '../kit/math';
import { useLayout } from '../kit/useLayout';
import { FPS, SCENE_CLICKS } from '../timing';

// ---------------------------------------------------------------------------------------------
// The calendar is in the app's horizontal orientation («Гориз.»): time across the top, one row per
// day, overlapping orders stacked in lanes inside their day's row (ScheduleTimeline: a row is
// max(120, 80 · lanes) px tall; the time axis fills the box's width).
//
// Geometry, UI pixels of the 1440×900 AppWindow (top-left = 0,0). Measured from the rendered DOM: a
// throwaway composition rendered BookingWindow at zoom 1 (states of frames 0, 95, 112 and 140) and
// reported getBoundingClientRect() of each node minus the `.crm-root` rect:
//   `.stl-scroll`            x 264 y 188.5 w 1152 h 630 (the app's 70vh of a 900-px window — pinned below,
//                            since vh in the video is the composition's 1080/1350/1000 px)
//   `.stl-axis-h`            x 329 y 189.5 w 1086 h 28 — 08:00 … 20:00 = 720 min → 1.5083 px/min
//   `.stl-lane[data-di=i]`   x 329, tops 217.5 / 377.5 / 617.5 / 857.5 / 1097.5 / 1257.5 / 1417.5,
//                            heights 160 / 240 / 240 / 240 / 160 / 160 / 120 (Mon … Sun, unscrolled)
//   `.stl-ev[data-sel]`      (the 14:00–16:00 ghost, scrolled) x 872 y 580.5 w 181 h 235 — alone in its
//                            lane cluster (08:00–14:00 and 16:00–17:30 only touch it), so the whole row
//                            height; the landed `[data-id="hero-copy"]` takes the same box.
//   `[data-demo="booking-menu"]` (our wrapper at MENU) and its <dialog>: x 438 y 595.5 w 420 h 205.
//   `[data-demo="slot-booking"]` («Новая запись»): x 455 y 667.5 w 386 h 54.5; its label `.fw-500`
//                            x 501 y 675.5 (the text «Новая запись» ≈ 501–600).
// The row tops depend on the lane counts of the days above Thursday, so they are derived from the
// fixtures with the app's row formula (BANDS) and checked against these numbers in booking.spec.
// The 7 rows (1348 px) do not fit the 630-px box: the timeline scrolls (0 → SCROLL, frames 30–60)
// until Thursday's row ends at the box's bottom — Wednesday (today, the now-line) and Thursday whole,
// Tuesday's lower lanes under the time axis — so the empty page strip under the box (818.5–900) is
// right below the slot, for the callout. The app scrolls `.stl-scroll`; here the rows slide by the same amount inside
// its clip (a scrollTop set in a still doesn't paint), under the sticky time axis, as in the app.
// ---------------------------------------------------------------------------------------------
/** Left of the lanes = the 08:00 line. */
const AXIS_X = 329;
/** Lane width 1086 px over the 08:00–20:00 window. */
const PX_PER_MIN = 1086 / 720;
/** Top of the first row (under the 28-px time axis), unscrolled. */
const ROWS_TOP = 217.5;
/** `.stl-scroll` height: 70vh of the app's 900-px window. */
const BOX_H = 630;
/** Bottom of `.stl-scroll` (top 188.5 + 630). */
const BOX_BOTTOM = 818.5;
/** Top of the time axis (`.stl-axis-h`) — the hours above the slot. */
export const TIME_AXIS_Y = 189.5;
/** ScheduleTimeline's horizontal row height: BAND_MIN 120, PER_LANE 80 (module constants there). */
const bandPx = (lanes: number) => Math.max(120, lanes * 80);

const [CLICK_SLOT, CLICK_BOOKING] = SCENE_CLICKS.booking;
export const MENU_IN = 82;
export const CALLOUT_AT = 90;
export const LAND_AT = 120;
/** The timeline's scroll to Thursday: with the camera's push (1 → 2 s). */
const SCROLL_FROM = 30;
const SCROLL_TO = 60;

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
// The geometry is for Thursday 14:00–16:00 MSK of DEMO_NOW's week, in an 08:00–20:00 day; any other
// free slot or working day (seed change, re-export) would put the cursor and the menu on the wrong cell.
const THU = 3;
const EXPECTED_SLOT = setHours(addDays(WEEK_START, THU), 14);
if (freeSlot.startsAt.getTime() !== EXPECTED_SLOT.getTime() || freeSlot.durationMin !== 120) {
  throw new Error(
    `Booking: pixel constants assume the free slot Thu ${EXPECTED_SLOT.toISOString()} (14:00 MSK, 120 min), ` +
      `got ${freeSlot.startsAt.toISOString()} (${freeSlot.durationMin} min) — re-measure SLOT/MENU/BOOKING`,
  );
}
if (CFG.startHour !== 8 || CFG.endHour !== 20) {
  throw new Error(`Booking: PX_PER_MIN/AXIS_X were measured for 08:00–20:00, settings say ${CFG.startHour}–${CFG.endHour}`);
}
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

// ---- rows (derived from the fixtures, as ScheduleTimeline lays them out) ----
const lanesOn = (events: TimelineEvent[], day: Date) => assignLanes(events.filter((e) => isSameDay(e.start, day)));
const bandsOf = (events: TimelineEvent[]) =>
  DAYS.map((d) => bandPx(lanesOn(events, d).reduce((m, p) => Math.max(m, p.laneCount), 1)));
/** Row heights Mon … Sun. */
export const BANDS = bandsOf(BASE_EVENTS);
// The ghost (75–119) and the landed order (120–) must not change any row, or the week would jump at
// the click or the landing; and each must be alone in its lane cluster to take Thursday's whole row.
for (const [name, extra] of [['ghost', GHOST], ['hero order', HERO_EVENT]] as const) {
  const withIt = [...BASE_EVENTS, extra];
  if (bandsOf(withIt).some((b, i) => b !== BANDS[i])) throw new Error(`Booking: the ${name} changes a row height`);
  if (lanesOn(withIt, DAYS[THU]).find((p) => p.event.id === extra.id)!.laneCount !== 1) {
    throw new Error(`Booking: the ${name} shares Thursday's 14:00–16:00 with another order — SLOT is not the whole row`);
  }
}
const rowTop = (di: number) => ROWS_TOP + BANDS.slice(0, di).reduce((a, b) => a + b, 0);
/** The timeline's scroll at rest: Thursday's row ends on the inside of the box's 1-px bottom border. */
export const SCROLL = rowTop(THU + 1) - (BOX_BOTTOM - 1);
/** Thursday's row, scrolled. */
const THU_TOP = rowTop(THU) - SCROLL;
// Wednesday (today) and Thursday whole under the time axis, and a scroll the app could reach.
if (rowTop(THU - 1) - SCROLL < ROWS_TOP || SCROLL < 0 || SCROLL > ROWS_TOP + BANDS.reduce((a, b) => a + b, 0) - BOX_BOTTOM) {
  throw new Error(`Booking: Wednesday–Thursday (${BANDS[THU - 1]} + ${BANDS[THU]} px) do not fit the timeline box at scroll ${SCROLL}`);
}

// ---- targets (UI px, the timeline scrolled to SCROLL) ----
const minX = (min: number) => AXIS_X + (min - CFG.startHour * 60) * PX_PER_MIN;
/** The free slot's box: 14:00–16:00 on the time axis; the row's height less the lane's 1-px top border
 *  and the event's 2-px insets (ScheduleTimeline: top calc(0% + 2px), height calc(100% − 4px)). */
export const SLOT = {
  x: minX(14 * 60),
  y: THU_TOP + 1 + 2,
  w: freeSlot.durationMin * PX_PER_MIN,
  h: BANDS[THU] - 1 - 4,
};
const slotCentre = { x: SLOT.x + SLOT.w / 2, y: SLOT.y + SLOT.h / 2 };
/** The inline SlotMenu, a popover LEFT of the slot (14 px gap), centred on it: on the right it would
 *  end at 1487, past the window. It covers Thursday's morning orders while it is open (82–112). Its
 *  <dialog> measured 420×205. */
export const MENU = { x: SLOT.x - 14 - 420, y: slotCentre.y - 205 / 2, w: 420, h: 205 };
/** «Новая запись»: the pointer tip on its label text (left part of the row, as before). */
const BOOKING = { x: 546, y: 685 };
/** Wide callout: its dot on the middle of the slot's bottom edge, the pill below it in the empty page
 *  strip under the timeline box — clear of the slot, the menu, every order. */
export const CALLOUT_ANCHOR = { x: slotCentre.x, y: SLOT.y + SLOT.h };
export const CALLOUT_SIDE: Side = 'bottom';

// ---- camera (seconds, UI px at frame centre) and cursor ----
// Wide 0–1 s (the week from Monday) → 1.5× on Wednesday–Thursday by 2 s while the timeline scrolls
// down to them → hold → dive into the landed order 5–6 s. At 1.5 the frame shows 1280×720 UI px:
// FOCUS x 160–1440 (the window's right edge at the frame's edge; the day labels at 265–329, the menu
// at 438), y 180–900 (the time axis 189.5 to the window's bottom: the callout pill below the box ends
// at ≈ 872, 42 px above the frame's edge). The dive keeps the window's bottom at the frame's bottom.
const FOCUS = { x: 1440 - 960 / 1.5, y: 900 - 540 / 1.5, zoom: 1.5 };
const DIVE = { x: slotCentre.x, y: 900 - 540 / 2.6, zoom: 2.6 };
const wideKeys = (wideZoom: number): CamKey[] => [
  { at: 0, x: 720, y: 450, zoom: wideZoom },
  { at: 1, x: 720, y: 450, zoom: wideZoom },
  { at: 2, ...FOCUS },
  { at: 5, ...FOCUS },
  { at: 6, ...DIVE },
];
// SOCIAL (1080×1350; the stage between the brand band and the caption plaque is 1080×970). One zone,
// 1.7× (635×571 UI px): x 428–1063 — the menu (438–858) and the slot (872–1053) side by side — and
// y 300–871: Wednesday (from its top, 337.5) and Thursday whole. The hours are above it; the ghost
// («14:00–16:00») and the menu («19 ноября, 14:00») say when. The camera holds while the timeline
// scrolls Thursday up into it (30–60); from the landing (120) a push to 2.2 on the landed order
// (491×441, the window's bottom at the stage's) to the social end (150; the hero's dive is not in the cut).
const SOCIAL_ZONE = socialKeyForView(MENU.x - 10, 300, 1.7);
const SOCIAL_LANDED = { x: slotCentre.x, y: 900 - 485 / 2.2, zoom: 2.2 };
export const CAM: { wide: CamKey[]; social: CamKey[] } = {
  wide: wideKeys(1),
  social: [
    { at: 0, ...SOCIAL_ZONE },
    { at: LAND_AT / FPS, ...SOCIAL_ZONE },
    { at: 150 / FPS, ...SOCIAL_LANDED },
  ],
};

const s = (f: number) => f / FPS;
// Cursor: idles low-right, glides onto the slot once the timeline has scrolled, then — the menu opens
// on the slot's left — a steady hop onto «Новая запись», then straight down out of the frame (left of
// the slot and the callout) so it never sits on the landed order.
export const CURSOR: CursorPoint[] = [
  { at: 0, x: 1120, y: 780 },
  { at: s(30), x: 1120, y: 780 },
  { at: s(CLICK_SLOT - 6), x: slotCentre.x + 6, y: slotCentre.y + 4 },
  { at: s(CLICK_SLOT + 5), x: slotCentre.x + 6, y: slotCentre.y + 4 },
  { at: s(CLICK_BOOKING - 5), x: BOOKING.x, y: BOOKING.y, ease: 'steady' },
  { at: s(CLICK_BOOKING + 12), x: BOOKING.x, y: BOOKING.y },
  { at: s(150), x: 520, y: 930 },
];

/** The timeline's scroll (UI px) at a scene frame: 0 → SCROLL with the camera's push. */
export function bookingScroll(frame: number): number {
  return interpolate(frame, [SCROLL_FROM, SCROLL_TO], [0, SCROLL], {
    easing: CAM_EASE,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

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
    scroll: bookingScroll(frame),
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
  // Scoped to this window: a loop's cross-fade draws two BookingWindows at different scrolls.
  const scrollId = useId();
  const scope = `[data-booking-scroll="${scrollId}"]`;
  return (
    <AppWindow theme={theme} route="/calendar">
      {/* The box's height as the app has it in a 900-px window, and its scroll: the day rows slide up
          inside the box's clip, under the sticky time axis (the corner covers the day labels). */}
      <style>{`${scope} .stl-scroll { max-height: ${BOX_H}px; }
${scope} :is(.stl-rowhead, .stl-lane) { transform: translateY(${-state.scroll}px); }`}</style>
      <div data-booking-scroll={scrollId} style={{ display: 'contents' }}>
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
            orientation="horizontal"
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
      </div>
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
              // It grows out of the slot, on its right.
              transformOrigin: '100% 50%',
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
 * Booking (180 f): the week in rows → the timeline scrolls to Thursday (30–60) → click the free
 * Thursday 14:00 slot (75) → ghost + slot menu (82) → callout (90) → «Новая запись» (105) → the hero
 * order springs into the slot (120) → camera dives into it (150–180).
 */
export function BookingScene({ theme, brand, callouts, accent }: ShowcaseProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const social = useLayout() === 'social';
  const state = bookingState(frame, fps);
  return (
    <AbsoluteFill>
      <Background theme={theme} captionBand />
      <Camera keys={social ? CAM.social : CAM.wide}>
        <BookingWindow theme={theme} brandName={brand.name} state={state} />
        {/* Wide: right of the slot (CALLOUT_ANCHOR). Social: the bottom plaque. */}
        <Callout text={callouts.booking} at={CALLOUT_AT} anchor={CALLOUT_ANCHOR} side={CALLOUT_SIDE} accent={accent} />
        <Cursor path={CURSOR} clicks={SCENE_CLICKS.booking} accent={accent} />
      </Camera>
    </AbsoluteFill>
  );
}
