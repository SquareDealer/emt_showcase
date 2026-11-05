// One-frame compositions that render each real CRM view with fixtures — the scaffold's smoke test
// (fonts, CSS, dedupe, brand, TZ) before any animation exists.
import type { ReactNode } from 'react';
import { AbsoluteFill, staticFile } from 'remotion';
import { addDays, startOfWeek } from 'date-fns';
import { AppShellView } from '@crm/components/AppShellView';
import { BoardView } from '@crm/features/board/BoardView';
import { WorkOrderView } from '@crm/features/work-orders/WorkOrderView';
import { ScheduleFields } from '@crm/features/work-orders/ScheduleFields';
import { CalendarView } from '@crm/features/calendar/CalendarView';
import { DashboardView } from '@crm/features/dashboard/DashboardView';
import { calendarRangeLabel, navForRole, workOrderToEvent } from '@crm/lib/view-helpers';
import { blockToEvent } from '@crm/lib/schedule';
import type { TimelineCfg } from '@crm/lib/schedule';
import type { Brand } from '@crm/lib/brand';
import {
  blocksWeek,
  boardOwner,
  calendarWeek,
  dashboard,
  DEMO_NOW,
  settings,
  templates,
  users,
  woHero,
} from '../fixtures';
import { VideoProviders } from '../providers/VideoProviders';
import { AppWindow } from '../kit/AppWindow';
import { Background } from '../kit/Background';
import { Camera } from '../kit/Camera';
import { Cursor } from '../kit/Cursor';
import { Highlight } from '../kit/Highlight';
import { Callout } from '../kit/Callout';
import { TypeText } from '../kit/TypeText';
import { CountUp } from '../kit/CountUp';
import { FakeSelect } from '../kit/FakeSelect';

type Theme = 'light' | 'dark';
export type DebugProps = { theme: Theme };

const noop = () => {};

// Trimmed logos: the originals carry wide transparent padding and read tiny at the sidebar's 44px.
const BRAND: Brand = {
  name: 'Гараж CRM',
  logoLight: staticFile('brand/garage-crm-logo-light-sidebar.png'),
  logoDark: staticFile('brand/garage-crm-logo-dark-sidebar.png'),
};

const owner = users.find((u) => u.role === 'owner');
if (!owner) throw new Error('fixtures/users.json: no owner');

/** Frame background + centred window. */
function Stage({ theme, route, children }: { theme: Theme; route: string; children: ReactNode }) {
  return (
    <VideoProviders theme={theme}>
      <Background theme={theme} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <AppWindow theme={theme} route={route}>
          <AppShellView
            userName={owner!.name}
            nav={navForRole('owner')}
            theme={theme}
            drawerOpen={false}
            brand={BRAND}
            onOpenSearch={noop}
            onNewIntake={noop}
            onToggleTheme={noop}
            onLogout={noop}
            onOpenDrawer={noop}
            onCloseDrawer={noop}
          >
            {children}
          </AppShellView>
        </AppWindow>
      </AbsoluteFill>
    </VideoProviders>
  );
}

export function DebugBoard({ theme }: DebugProps) {
  return (
    <Stage theme={theme} route="/board">
      <BoardView
        columns={boardOwner}
        showMaster
        activeId={null}
        onOpen={noop}
        onDragStart={noop}
        onDragEnd={noop}
      />
    </Stage>
  );
}

export function DebugWorkOrder({ theme }: DebugProps) {
  const wo = woHero[3];
  return (
    <Stage theme={theme} route={`/work-orders/${wo.id}`}>
      <WorkOrderView
        wo={wo}
        back={{ to: '/calendar', label: 'Календарь' }}
        templates={templates}
        staff={users}
        canAssign
        laborRate={settings.labor_rate}
        editLaborId={null}
        editPartId={null}
        pending={{}}
        scheduleSlot={
          <ScheduleFields
            wo={wo}
            defaultDurMin={settings.default_appointment_min}
            disabled={false}
            onChange={noop}
            onOpenPicker={noop}
          />
        }
        onUpdate={noop}
        onStatus={noop}
        onCloseOrder={noop}
        onPdf={noop}
        onOrderPdf={noop}
        onPaid={noop}
        onAddLabor={noop}
        onEditLabor={noop}
        onDelLabor={noop}
        onAddPart={noop}
        onEditPart={noop}
        onDelPart={noop}
        onRenameGroup={noop}
        onMoveGroup={noop}
        onUngroup={noop}
        onPickTemplate={noop}
        onDuplicate={noop}
        onAskDelete={noop}
        onSave={noop}
        onStartEditLabor={noop}
        onStartEditPart={noop}
      />
    </Stage>
  );
}

export function DebugCalendar({ theme }: DebugProps) {
  const start = startOfWeek(DEMO_NOW, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const defaultDur = settings.default_appointment_min;
  const cfg: TimelineCfg = {
    startHour: settings.working_hours_start,
    endHour: settings.working_hours_end,
    slotMin: settings.slot_minutes,
    pxPerMin: 0.8,
  };
  const events = [
    ...calendarWeek.flatMap((w) => workOrderToEvent(w, defaultDur, { showMaster: true }) ?? []),
    ...blocksWeek.map(blockToEvent),
  ];
  return (
    <Stage theme={theme} route="/calendar">
      <CalendarView
        days={days}
        view="week"
        orientation="vertical"
        rangeLabel={calendarRangeLabel('week', days)}
        events={events}
        cfg={cfg}
        now={DEMO_NOW}
        defaultDurationMin={defaultDur}
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
    </Stage>
  );
}

export function DebugDashboard({ theme }: DebugProps) {
  // The dashboard is video-only and has no route in the CRM: no nav item is active.
  return (
    <Stage theme={theme} route="/dashboard">
      <DashboardView data={dashboard} />
    </Stage>
  );
}

// Kit smoke test: every kit piece on one screen, 90 frames. Click at frame 30; UI = 1440×900.
// Debug scaffolding only — PhoneFrame/PaperSheet/LoopCrossfade need media and are used by scenes.
export function DebugKit({ theme }: DebugProps) {
  return (
    <VideoProviders theme={theme}>
      <Background theme={theme} />
      <Camera
        keys={[
          { at: 0, x: 720, y: 450, zoom: 1 },
          { at: 1, x: 640, y: 380, zoom: 1.25 },
          { at: 2.5, x: 640, y: 380, zoom: 1.25 },
        ]}
      >
        <AppWindow theme={theme} route="/board">
          <div style={{ padding: 40, background: 'var(--bg)', height: '100%', position: 'relative' }}>
            <h2 style={{ margin: 0, color: 'var(--ink)' }}>Kit</h2>
            <div style={{ marginTop: 24, display: 'flex', gap: 32, alignItems: 'center' }}>
              <input
                className="input"
                readOnly
                style={{ width: 280 }}
                value=""
                placeholder="VIN"
              />
              <span className="mono" style={{ color: 'var(--ink)', fontSize: 22 }}>
                <TypeText text="WMWSV32010T" startFrame={10} framesPerChar={3} />
              </span>
            </div>
            <div style={{ marginTop: 40, fontSize: 40, fontWeight: 600, color: 'var(--ink)' }}>
              <CountUp from={0} to={36517.5} fromFrame={30} toFrame={75} />
            </div>
            <FakeSelect
              rect={{ x: 600, y: 150, w: 280, h: 36 }}
              options={['Диагностика', 'Замена масла', 'Цепь ГРМ']}
              openAt={36}
              pickIndex={1}
              pickAt={66}
              placeholder="Работа"
            />
            <div
              style={{
                position: 'absolute',
                left: 80,
                top: 520,
                width: 360,
                height: 80,
                borderRadius: 10,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
              }}
            />
            <Highlight rect={{ x: 80, y: 520, w: 360, h: 80 }} appearAt={45} />
            <Callout
              text="Цена — под поколение"
              at={45}
              anchor={{ x: 440, y: 560 }}
              side="right"
            />
            <Cursor
              path={[
                { at: 0, x: 200, y: 250 },
                { at: 1, x: 640, y: 168 },
                { at: 3, x: 640, y: 168 },
              ]}
              clicks={[30]}
            />
          </div>
        </AppWindow>
      </Camera>
    </VideoProviders>
  );
}

