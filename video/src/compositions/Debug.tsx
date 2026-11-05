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

/** Frame background + centred window. Task 5's kit/Background replaces the inline gradient. */
function Stage({ theme, route, children }: { theme: Theme; route: string; children: ReactNode }) {
  return (
    <VideoProviders theme={theme}>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          background:
            theme === 'dark'
              ? 'radial-gradient(120% 90% at 50% 0%, oklch(0.32 0.03 240), oklch(0.14 0.01 240))'
              : 'radial-gradient(120% 90% at 50% 0%, oklch(0.93 0.02 235), oklch(0.78 0.03 240))',
        }}
      >
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
