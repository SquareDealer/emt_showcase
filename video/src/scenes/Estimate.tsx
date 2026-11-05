import { type CSSProperties, type ReactNode } from 'react';
import { AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { AppShellView } from '@crm/components/AppShellView';
import { ToastView } from '@crm/components/ToastView';
import { WorkOrderView, type PartDraft } from '@crm/features/work-orders/WorkOrderView';
import { ScheduleFields } from '@crm/features/work-orders/ScheduleFields';
import { ApplyTemplateView } from '@crm/features/work-orders/ApplyTemplateView';
import { navForRole, templateTotal } from '@crm/lib/view-helpers';
import { orderTotal } from '@crm/lib/format';
import type { Brand } from '@crm/lib/brand';
import type { WorkOrder } from '@crm/lib/types';
import { HERO } from '../../../demo/seed/hero';
import { settings, templatePreview, templates, users, woHero } from '../fixtures';
import type { ShowcaseProps } from '../schema';
import { AppWindow } from '../kit/AppWindow';
import { Background } from '../kit/Background';
import { Camera } from '../kit/Camera';
import { Cursor } from '../kit/Cursor';
import { Callout } from '../kit/Callout';
import { FakeSelect } from '../kit/FakeSelect';
import { Highlight } from '../kit/Highlight';
import { SOCIAL_STAGE, countUp, socialKeyForView, typed, type CamKey, type CursorPoint } from '../kit/math';
import { useLayout } from '../kit/useLayout';
import { FPS, SCENE_CLICKS } from '../timing';

// ---------------------------------------------------------------------------------------------
// Target geometry, UI pixels of the 1440×900 AppWindow (top-left = 0,0). Measured from the
// rendered DOM: a throwaway composition rendered EstimateWindow at zoom 1 with the states of
// frames 60, 100, 125, 170, 200 and 240, waited for document.fonts.ready and printed each node's
// getBoundingClientRect() minus the `.crm-root` rect into the PNG.
//   ADD_FROM_PRICE `[data-demo="add-from-price"]` (native select, auto width): x 692 y 208 w 371 h 30.
//   DIALOG         ApplyTemplateView's <dialog> (frame 100, scale 1): x 410 y 167.3 w 620 h 565.5.
//   APPLY_LABOR    `[data-demo="apply-labor"]`: x 427 y 239.3 w 586 h 68.5.
//   checkboxes     `[data-demo="apply-part"] input[type=checkbox]`: x 443, w/h 13, y 371.5 + 62.5·i
//                  (rows 54.5 tall + the list's 8-px gap); the oil is row OIL_INDEX of template-preview.json.
//   CONFIRM        `[data-demo="apply-confirm"]`: x 823 y 683.8 w 190 h 36.
//   estimate (snapshots 1–3, same height): labor row «Замена цепи ГРМ» y 424–471, its add-form
//                  471–519 (labor panel ends 519); parts panel 535 (head + column heads to 611.8),
//                  kit row 648.3 h 47 (56 with the 10 % discount: «−1 490 ₽ (10%)» x 824.6 w 62.4).
//   SUMMARY        `[data-demo="wo-summary"]` x 1096 w 320 from y 195; «Скидка на наряд» y 471.5
//                  (h 39 once the % input shows), «Скидки по строкам» 513.5 / 522.5, «Скидка наряда»
//                  554, «Итого» 566 (snapshot 2) / 606.5 (snapshot 3) h 33, «Остаток» 714.5.
//                  Snapshots 1–3 carry the fitted duration (480 = Σ labor hours), so no «Подогнать
//                  под часы работ» button: everything below «Запись» sits 38 px (30 + the 8-px gap)
//                  higher than in snapshot 0, whose 120-min booking still shows the button.
//   new block's group headers (`.smeta-group`): works 265,377 814×47; parts 265,611.8 814×36.5.
//   DISC_TYPE      `[data-demo="wo-discount"] select` (snapshot 2, type «нет»): x 1307 y 471.5 w 92 h 30.
//   toast          `.toast` (fixed, bottom-centre of the window): x 617 y 840.5 w 205.5 h 35.5.
// ---------------------------------------------------------------------------------------------
export const ADD_FROM_PRICE = { x: 692, y: 208, w: 371, h: 30 };
export const DIALOG = { x: 410, y: 167, w: 620, h: 566 };
export const APPLY_LABOR = { x: 427, y: 239, w: 586, h: 69 };
const CHECKBOX = { x: 443, y0: 371.5, step: 62.5, size: 13 };
const CONFIRM = { x: 823, y: 684, w: 190, h: 36 };
/** FakeSelect list: 4 px below the control, 4 px padding, 36 px rows (kit/FakeSelect.tsx). */
const optionY = (i: number) => ADD_FROM_PRICE.y + ADD_FROM_PRICE.h + 4 + 4 + 36 * i + 18;
const SUMMARY_X = 1096;
/** The discounts caption's dot: the summary's left edge, between «Скидки по строкам» and «Скидка
 *  наряда» (snapshot 3: rows 522.5 and 554) — the two amounts that make the 14,5 %. */
export const DISCOUNTS_ANCHOR = { x: SUMMARY_X, y: 548 };
const NEW_HEADERS = [
  { x: 265, y: 377, w: 814, h: 47 },
  { x: 265, y: 611.8, w: 814, h: 36.5 },
];
export const DISC_TYPE = { x: 1307, y: 471.5, w: 92, h: 30 };
/** The kit's «−1 490 ₽ (10%)» (`.smeta-row .disc` x 824.6 y 657.3 w 62.4 h 36.5), padded. */
const KIT_DISC_CELL = { x: 816, y: 652, w: 80, h: 47 };

const [CLICK_SELECT, CLICK_OPTION, CLICK_OIL, CLICK_CONFIRM, CLICK_DISC_TYPE] = SCENE_CLICKS.estimate;
// Every click's effect lands 3 frames after the press, so the press and its ring hit the target.
/** The list stays open under the press, then closes with the option picked. */
export const PICK_AT = CLICK_OPTION + 3;
/** The sheet closes and wo-hero.1 arrives (the app's onSuccess). */
export const APPLY_AT = CLICK_CONFIRM + 3;
/** The order-discount type switches «нет» → «%» (its input appears), then «5» is typed. */
const DISC_TYPE_AT = CLICK_DISC_TYPE + 3;
const MODAL_IN = 80;
export const GEN_AT = 90;
export const BLOCK_AT = 135;
/** Wide overlays' exits (start of a 6-frame fade): the generation-price ring goes before the cursor
 *  reaches the checkboxes, its caption once the oil count-down settles, the block caption under the
 *  new work line with the camera's move to the summary. The LoopEstimate reuses them. */
export const GEN_RING_OUT = 110;
export const GEN_CAPTION_OUT = 126;
export const BLOCK_CAPTION_OUT = 180;
/** The block caption in the estimate: under the new work line, over the add-form placeholders. */
export const BLOCK_ANCHOR = { x: 330, y: 471 };
const TOAST_IN = 155;
const TOAST_OUT = 200;
const SNAP2_AT = 195;
const SNAP3_AT = 225;
const TOTAL_TO = 255;

const brandFor = (name: string): Brand => ({
  name,
  logoLight: staticFile('brand/garage-crm-logo-light-sidebar.png'),
  logoDark: staticFile('brand/garage-crm-logo-dark-sidebar.png'),
});

const owner = users.find((u) => u.role === 'owner');
if (!owner) throw new Error('fixtures/users.json: no owner');

// ---- data (fixtures only) ----
const [WO0, WO1, WO2, WO3] = woHero;
// The summary prints total_cached; the scene counts between orderTotal() values — they must agree.
for (const [i, w] of [WO0, WO1, WO2, WO3].entries()) {
  if (Math.abs(orderTotal(w) - w.total_cached) > 0.001) {
    throw new Error(`wo-hero.${i}: orderTotal ${orderTotal(w)} ≠ total_cached ${w.total_cached}`);
  }
}
const OPTION_NAME = templatePreview.group_name;
const TEMPLATE_INDEX = templates.findIndex((t) => t.id === templatePreview.template_id);
if (TEMPLATE_INDEX < 0) throw new Error('templates.json: no template of template-preview.json');
/** A native select opens scrolled; FakeSelect shows a window of the list around the target. */
export const OPTION_WINDOW = templates.slice(Math.max(0, TEMPLATE_INDEX - 5), TEMPLATE_INDEX + 3).map((t) => t.name);
export const PICK_INDEX = OPTION_WINDOW.indexOf(OPTION_NAME);
if (PICK_INDEX < 0) throw new Error(`templates.json: «${OPTION_NAME}» is not the template's name`);

const DEFAULT_PARTS = templatePreview.parts.filter((p) => p.is_default).map((p) => p.part_template_id);
const OIL = HERO.parts.oil5w30;
const OIL_INDEX = templatePreview.parts.findIndex((p) => p.part_template_id === OIL);
if (OIL_INDEX < 0 || !DEFAULT_PARTS.includes(OIL)) throw new Error('template-preview.json: oil is not a default part');
const PICKED_ALL: ReadonlySet<string> = new Set(DEFAULT_PARTS);
const PICKED_NO_OIL: ReadonlySet<string> = new Set(DEFAULT_PARTS.filter((id) => id !== OIL));
const QTY = Object.fromEntries(templatePreview.parts.map((p) => [p.part_template_id, String(p.qty)]));
const TOTAL_ALL = templateTotal(templatePreview, PICKED_ALL, QTY);
const TOTAL_NO_OIL = templateTotal(templatePreview, PICKED_NO_OIL, QTY);

/** Lines of `next` that `prev` doesn't have, in rowStyle index order (labor rows, then parts). */
export function newLineIds(prev: WorkOrder, next: WorkOrder): string[] {
  const had = new Set([...(prev.labor_lines ?? []), ...(prev.part_lines ?? [])].map((l) => l.id));
  return [...(next.labor_lines ?? []), ...(next.part_lines ?? [])].map((l) => l.id).filter((id) => !had.has(id));
}
export const NEW_LINES = newLineIds(WO0, WO1);
export const KIT_LINE = (WO2.part_lines ?? []).find((p) => p.part_template_id === HERO.parts.chainKit);
if (!KIT_LINE) throw new Error('wo-hero.2: no chain kit line');

const TOAST = [{ id: 1, kind: 'success' as const, text: 'Блок добавлен в смету' }];

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Scene-local state: a pure function of the frame. */
export function estimateState(frame: number, fps: number) {
  const snap = frame >= SNAP3_AT ? 3 : frame >= SNAP2_AT ? 2 : frame >= APPLY_AT ? 1 : 0;
  const base = woHero[snap];
  const wo: WorkOrder =
    snap === 3
      ? { ...base, total_cached: countUp(frame, SNAP3_AT, TOTAL_TO, orderTotal(WO2), orderTotal(WO3)) }
      : base;
  const modalIn = spring({ frame: frame - MODAL_IN, fps, config: { damping: 200 }, durationInFrames: 10 });
  const toastIn = spring({ frame: frame - TOAST_IN, fps, config: { damping: 200 }, durationInFrames: 8 });
  /** Appearance of the k-th new line (and of its block's header): 8 frames, staggered by 3. */
  const lineIn = (k: number) =>
    interpolate(frame, [APPLY_AT + 2 + 3 * k, APPLY_AT + 10 + 3 * k], [0, 1], clamp);
  const toastOut = interpolate(frame, [TOAST_OUT - 6, TOAST_OUT], [1, 0], clamp);
  return {
    wo,
    // The sheet closes on the confirm click (as the app's onSuccess does): no cross-fade over the new rows.
    modalOpacity: frame >= MODAL_IN && frame < APPLY_AT ? modalIn : 0,
    modalScale: interpolate(modalIn, [0, 1], [0.96, 1]),
    picked: frame >= CLICK_OIL ? PICKED_NO_OIL : PICKED_ALL,
    buttonTotal: countUp(frame, CLICK_OIL, CLICK_OIL + 12, TOTAL_ALL, TOTAL_NO_OIL),
    showSelect: frame >= CLICK_SELECT && frame < MODAL_IN,
    rowStyle: (id: string): CSSProperties | undefined => {
      const k = NEW_LINES.indexOf(id);
      if (k < 0 || snap !== 1) return undefined;
      const p = lineIn(k);
      return p >= 1 ? undefined : { opacity: p, transform: `translateY(${(1 - p) * 8}px)` };
    },
    /**
     * The view styles rows only; the new block's group headers would pop in at once. A panel-coloured
     * mask over each header fades out with the block's first new line (works header with the work
     * line, parts header with the first part).
     */
    headerMasks:
      snap === 1
        ? [lineIn(0), lineIn(NEW_LINES.findIndex((id) => (WO1.part_lines ?? []).some((p) => p.id === id)))].map(
            (p) => 1 - p,
          )
        : [0, 0],
    highlightLine: frame >= SNAP2_AT ? KIT_LINE!.id : undefined,
    discountDraft:
      frame >= DISC_TYPE_AT ? { type: 'percent' as const, value: typed(frame, DISC_TYPE_AT, '5', 5) } : undefined,
    toastOpacity: frame >= TOAST_IN ? Math.min(toastIn, toastOut) : 0,
    toastRise: (1 - toastIn) * 8,
  };
}

const noop = () => {};

/** The CRM window at a given state (no camera) — also what the coordinates above were measured on. */
export function EstimateWindow({
  theme,
  brandName,
  state,
  editPartId = null,
  partDraft,
  hoverLineId,
}: {
  theme: 'light' | 'dark';
  brandName: string;
  state: ReturnType<typeof estimateState>;
  /** Loops (the line-discount edit): the part line shown as its edit form, with pinned values. */
  editPartId?: string | null;
  partDraft?: Partial<PartDraft>;
  hoverLineId?: string;
}) {
  const { wo } = state;
  return (
    <AppWindow theme={theme} route={`/work-orders/${wo.id}`}>
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
        <WorkOrderView
          wo={wo}
          back={{ to: '/calendar', label: 'Календарь' }}
          templates={templates}
          staff={users}
          canAssign
          laborRate={settings.labor_rate}
          editLaborId={null}
          editPartId={editPartId}
          pending={{}}
          scheduleSlot={
            <ScheduleFields
              wo={wo}
              defaultDurMin={settings.default_appointment_min}
              disabled={false}
              onChange={noop}
              onOpenPicker={noop}
              onFit={noop}
            />
          }
          highlightLineId={state.highlightLine}
          hoverLineId={hoverLineId}
          partDraft={partDraft}
          discountDraft={state.discountDraft}
          rowStyle={(_, id) => state.rowStyle(id) ?? {}}
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
      </AppShellView>
      {state.headerMasks.map((o, i) =>
        o > 0 ? (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: NEW_HEADERS[i].x,
              top: NEW_HEADERS[i].y,
              width: NEW_HEADERS[i].w,
              height: NEW_HEADERS[i].h,
              background: 'var(--surface)',
              opacity: o,
              zIndex: 5,
            }}
          />
        ) : null,
      )}
      {state.modalOpacity > 0 ? (
        <>
          {/* The inline Modal's own dim would scale with the dialog; draw it separately. */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.35)',
              opacity: state.modalOpacity,
              zIndex: 30,
            }}
          />
          <div
            data-demo="apply-modal"
            style={
              {
                position: 'absolute',
                inset: 0,
                opacity: state.modalOpacity,
                transform: `scale(${state.modalScale})`,
                '--backdrop': 'transparent',
                zIndex: 31,
              } as CSSProperties
            }
          >
            <ApplyTemplateView
              open
              inline
              preview={templatePreview}
              picked={state.picked}
              qty={QTY}
              total={state.buttonTotal}
              onToggle={noop}
              onQty={noop}
              onConfirm={noop}
              onClose={noop}
            />
          </div>
        </>
      ) : null}
      {state.toastOpacity > 0 ? (
        // A full-window box as the toast's containing block: the transform moves the fixed
        // `.toast-wrap` exactly as the app's toast-in keyframes do, without changing its anchor.
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: state.toastOpacity,
            transform: `translateY(${state.toastRise}px)`,
            pointerEvents: 'none',
            zIndex: 40,
          }}
        >
          <ToastView toasts={TOAST} />
        </div>
      ) : null}
    </AppWindow>
  );
}


// ---- camera (seconds, UI px at frame centre) and cursor ----
// Wide 0–1 s (1.15) → a slight push towards the price select while its list opens → the modal at
// 1.45 (the whole dialog, 167–733, inside the 745-px-tall view; the generation callout fits to its
// right) → back out to 1.2 after the confirm (the whole window height: new rows + toast) → from 180
// onto the summary. That last zoom is 1.62, not 1.8: at 1.8 the view is 1067 px wide and cuts the
// highlighted kit row's name; 1.62 shows x 255–1440 (the row from its left edge to the summary's
// right edge) and y 233–900 (from «Запись» to the window's bottom edge, «Остаток» included).
const SUMMARY_FOCUS = { x: 847, y: 566, zoom: 1.62 };
const s = (f: number) => f / FPS;
const WIDE_KEYS: CamKey[] = [
  { at: 0, x: 720, y: 450, zoom: 1.15 },
  { at: s(30), x: 720, y: 450, zoom: 1.15 },
  { at: s(55), x: 740, y: 420, zoom: 1.25 },
  { at: s(CLICK_OPTION), x: 740, y: 420, zoom: 1.25 },
  { at: s(95), x: 720, y: 450, zoom: 1.45 },
  { at: s(APPLY_AT), x: 720, y: 450, zoom: 1.45 },
  { at: s(168), x: 720, y: 450, zoom: 1.2 },
  { at: s(180), x: 720, y: 450, zoom: 1.2 },
  { at: s(198), ...SUMMARY_FOCUS },
];

// SOCIAL (stage 1080×970 between the bands; at 1.7 it shows 635×571 UI px, at 1.8 600×539). One zone
// at a time — the sheet first, then the summary (with the landed block in between, as the wide cut's
// 1.2 overview):
//   SELECT 1.7 → 1.8 by 55: «+ Из прайса…» (692–1063) and its list (to y 534), view x 488–1088 y 190–729:
//          the right edge in the gap before the summary (1079–1096), the top under the vehicle line.
//   MODAL  1.7 by 95: the whole sheet (410–1030 × 167–733) in x 402–1038, y 165–735.
//   BLOCK  1.9 168–180 (view 568×511): x 262–830 — the new block from its group heads' edge (265):
//          names, qty, prices (to 783) and the toast (617–822), cut before the discount column and the
//          group total (from 838 / 866; only the empty add-form inputs are crossed); y 372–882 — both
//          group heads (377), the work line, the four parts (to 836) and the toast (to 876).
//   SUMMARY 1.7 from 198: x 789–1425, y 329–900 — the summary column (1096–1416) from «Скидка на наряд»
//          (471.5) to «Остаток» (to 734) and on to the buttons, and the parts' right half with the kit's
//          «−1 490 ₽ (10%)» (816–896).
export const SOCIAL_ZONES = {
  select: { x: ADD_FROM_PRICE.x, y: ADD_FROM_PRICE.y, w: ADD_FROM_PRICE.w, h: optionY(OPTION_WINDOW.length - 1) + 18 - ADD_FROM_PRICE.y },
  modal: DIALOG,
  /** To the toast's right edge (822); the prices end at 783. */
  block: { x: NEW_HEADERS[0].x, y: NEW_HEADERS[0].y, w: 822 - NEW_HEADERS[0].x, h: 876 - NEW_HEADERS[0].y },
  summary: { x: KIT_DISC_CELL.x, y: DISC_TYPE.y - 10, w: 1416 - KIT_DISC_CELL.x, h: 752 - (DISC_TYPE.y - 10) },
};
// Views stated by their edges (kit socialKeyForView); the select views' tops sit under the vehicle line.
const SOCIAL_SELECT_IN = socialKeyForView(770 - SOCIAL_STAGE.width / 2 / 1.7, 190, 1.7);
const SOCIAL_SELECT = socialKeyForView(488, 190, 1.8);
const SOCIAL_MODAL = { x: DIALOG.x + DIALOG.w / 2, y: 450, zoom: 1.7 };
/** Right edge 830 (toast whole, before the discount column), centred on y 627. */
const SOCIAL_BLOCK = socialKeyForView(830 - SOCIAL_STAGE.width / 1.9, 627 - SOCIAL_STAGE.height / 2 / 1.9, 1.9);
const SOCIAL_SUMMARY = { x: 1107, y: 614.7, zoom: 1.7 };
export const CAM: { wide: CamKey[]; social: CamKey[] } = {
  wide: WIDE_KEYS,
  social: [
    { at: 0, ...SOCIAL_SELECT_IN },
    { at: s(15), ...SOCIAL_SELECT_IN },
    { at: s(55), ...SOCIAL_SELECT },
    { at: s(CLICK_OPTION), ...SOCIAL_SELECT },
    { at: s(95), ...SOCIAL_MODAL },
    { at: s(APPLY_AT), ...SOCIAL_MODAL },
    { at: s(168), ...SOCIAL_BLOCK },
    { at: s(180), ...SOCIAL_BLOCK },
    { at: s(198), ...SOCIAL_SUMMARY },
  ],
};

/** Social captions (the bottom plaque): one at a time, `out` = start of a 6-frame fade (null: to the
 *  end). «block» is one plaque from the sheet through the landing (the wide cut re-anchors it); it leaves
 *  with the camera's move to the summary (180, on the beat — the wide cut's own «block» out), gone by 186. */
export const SOCIAL_CALLOUTS: readonly { key: 'generation' | 'block' | 'discounts'; at: number; out: number | null }[] = [
  { key: 'generation', at: GEN_AT, out: GEN_CAPTION_OUT },
  { key: 'block', at: BLOCK_AT, out: BLOCK_CAPTION_OUT },
  { key: 'discounts', at: SNAP3_AT, out: null },
];

const SELECT_AT = { x: ADD_FROM_PRICE.x + 70, y: ADD_FROM_PRICE.y + ADD_FROM_PRICE.h / 2 };
const OPTION_AT = { x: ADD_FROM_PRICE.x + 110, y: optionY(PICK_INDEX) };
const OIL_AT = {
  x: CHECKBOX.x + CHECKBOX.size / 2,
  y: CHECKBOX.y0 + CHECKBOX.step * OIL_INDEX + CHECKBOX.size / 2,
};
const CONFIRM_AT = { x: CONFIRM.x + 62, y: CONFIRM.y + CONFIRM.h / 2 };
const DISC_TYPE_POINT = { x: DISC_TYPE.x + 30, y: DISC_TYPE.y + DISC_TYPE.h / 2 };
// Cursor tip on each target a few frames before its click; after the confirm it leaves the window
// to the right, then comes back into the summary shot for the discount type. It stays there: once
// «%» is chosen the select moves left and the point becomes the discount input being typed into.
export const CURSOR: CursorPoint[] = [
  { at: 0, x: 1000, y: 640 },
  { at: s(12), x: 1000, y: 640 },
  { at: s(CLICK_SELECT - 6), ...SELECT_AT },
  { at: s(CLICK_SELECT + 6), ...SELECT_AT },
  { at: s(CLICK_SELECT + 16), ...OPTION_AT },
  { at: s(CLICK_OPTION + 4), ...OPTION_AT },
  { at: s(CLICK_OIL - 8), ...OIL_AT },
  { at: s(CLICK_OIL + 4), ...OIL_AT },
  { at: s(CLICK_CONFIRM - 6), ...CONFIRM_AT },
  { at: s(CLICK_CONFIRM + 6), ...CONFIRM_AT },
  { at: s(178), x: 1500, y: 820 },
  { at: s(CLICK_DISC_TYPE - 6), ...DISC_TYPE_POINT },
];

/** Opacity wrapper in stage coordinates (no offset, no transform) for overlays without an exit. */
function Fade({ opacity, z, children }: { opacity: number; z: number; children: ReactNode }) {
  if (opacity <= 0) return null;
  return <div style={{ position: 'absolute', left: 0, top: 0, opacity, zIndex: z }}>{children}</div>;
}

const fadeOut = (frame: number, from: number, dur = 4) => interpolate(frame, [from, from + dur], [1, 0], clamp);

/**
 * Estimate (270 f): «+ Из прайса…» (45) → «Замена цепи ГРМ (R56/N14)» (75) → the confirmation sheet
 * springs in (80), generation price highlighted (90) → the oil unticked, the button total counts
 * down (120) → «Добавить» (150; sheet closes at 153): the block lands in the estimate row by row,
 * toast → camera on the summary (180) → the kit line's 10 % (195) → order-discount type «%» (210;
 * switches at 213), «5» typed → saved, total counts down to 40 764,50 ₽ (225–255).
 */
export function EstimateScene({ theme, brand, callouts, accent }: ShowcaseProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const social = useLayout() === 'social';
  const state = estimateState(frame, fps);
  return (
    <AbsoluteFill>
      <Background theme={theme} />
      <Camera keys={social ? CAM.social : CAM.wide}>
        <EstimateWindow theme={theme} brandName={brand.name} state={state} />
        {state.showSelect ? (
          <FakeSelect
            rect={ADD_FROM_PRICE}
            options={OPTION_WINDOW}
            openAt={CLICK_SELECT}
            pickIndex={PICK_INDEX}
            pickAt={PICK_AT}
            placeholder="+ Из прайса…"
          />
        ) : null}
        {/* Generation price: ring the labor line of the sheet; gone before the cursor reaches the
            checkboxes (the dim would cover them). */}
        <Fade opacity={fadeOut(frame, GEN_RING_OUT, 6)} z={50}>
          <Highlight rect={APPLY_LABOR} appearAt={GEN_AT} accent={accent} />
        </Fade>
        {/* The kit's 10 % on wo-hero.2: ring the discount cell (the row keeps its outline), gone
            before the cursor reaches the order-discount type. */}
        <Fade opacity={fadeOut(frame, CLICK_DISC_TYPE - 8, 6)} z={50}>
          <Highlight rect={KIT_DISC_CELL} appearAt={SNAP2_AT} accent={accent} />
        </Fade>
        {social ? (
          // One plaque at a time, from SOCIAL_CALLOUTS.
          SOCIAL_CALLOUTS.map((c) => (
            <Fade key={c.key} opacity={c.out === null ? 1 : fadeOut(frame, c.out, 6)} z={90}>
              <Callout text={callouts[c.key]} at={c.at} accent={accent} />
            </Fade>
          ))
        ) : (
          <>
            {/* One caption per beat: «generation» leaves once the oil count-down settles, before «block». */}
            <Fade opacity={Math.min(state.modalOpacity, fadeOut(frame, GEN_CAPTION_OUT, 6))} z={90}>
              {/* Right of the dialog, level with the labor line: clear of its price and the checkboxes. */}
              <Callout
                text={callouts.generation}
                at={GEN_AT}
                anchor={{ x: APPLY_LABOR.x + APPLY_LABOR.w, y: APPLY_LABOR.y + APPLY_LABOR.h / 2 }}
                side="right"
                accent={accent}
              />
            </Fade>
            <Fade opacity={state.modalOpacity} z={90}>
              {/* Above the sheet, over the dimmed page title. */}
              <Callout
                text={callouts.block}
                at={BLOCK_AT}
                anchor={{ x: DIALOG.x + DIALOG.w / 2, y: DIALOG.y }}
                side="top"
                accent={accent}
              />
            </Fade>
            {/* The same caption follows the block into the estimate: under the new work line, over the
                add-form placeholders (left of the «2200» rate input), clear of every amount. */}
            <Fade opacity={fadeOut(frame, BLOCK_CAPTION_OUT, 6)} z={90}>
              <Callout text={callouts.block} at={APPLY_AT} anchor={BLOCK_ANCHOR} side="bottom" accent={accent} />
            </Fade>
            {/* At the summary's left edge, between the two discount rows: the pill lies over the empty
                right half of the parts panel head, above the column heads and the kit's «−1 490 ₽». */}
            <Callout text={callouts.discounts} at={SNAP3_AT} anchor={DISCOUNTS_ANCHOR} side="left" accent={accent} />
          </>
        )}
        <Cursor path={CURSOR} clicks={SCENE_CLICKS.estimate} accent={accent} />
      </Camera>
    </AbsoluteFill>
  );
}
