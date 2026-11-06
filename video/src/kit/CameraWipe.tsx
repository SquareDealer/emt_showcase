import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { Background } from './Background';
import { CAM_EASE } from './math';

// ---------------------------------------------------------------------------------------------
// «Непрерывная камера» — the one transition family of the showcase (no blur, no cross-fade):
//   wipe  the outgoing shot keeps travelling (drifts along the travel and pushes in on its detail),
//         the incoming shot is revealed by a crisp diagonal mask whose edge travels the same way, a
//         2-px brass leading edge on it; the incoming layer arrives with a parallax offset (it starts
//         behind the edge and settles), so both layers move one way at different speeds.
//   card  the outgoing scene's own camera pushes into a card; the incoming shot opens out of that
//         card's on-screen rect (a rounded clip growing to the frame, the shot scaled with it) under a
//         brass outline — «open the record → its page».
// Every value is a pure function of the presentation progress (linear time 0 → 1), eased here with
// the camera's own curve (CAM_EASE: soft in and out, no overshoot). Both layers stay opaque, so no
// frame ever shows a double exposure of two UIs. The geometry is exported and unit-tested.
// ---------------------------------------------------------------------------------------------

export type Pt = { x: number; y: number };
export type FrameRect = { x: number; y: number; w: number; h: number };
/** Where the incoming shot comes from: its side of the frame; the edge travels to the opposite side. */
export type WipeFrom = 'right' | 'bottom';

/** The edge's slant from the perpendicular of the travel (a diagonal, not a flat curtain). */
export const WIPE_SLANT_DEG = 14;
/** Outgoing: drift along the travel (share of the frame's size along it) and push-in (scale gain). */
export const OUT_DRIFT = 0.07;
export const OUT_PUSH = 0.06;
/** Incoming: parallax offset at the start (share of the frame along the travel), settled at the end. */
export const IN_OFFSET = 0.14;
/** The brass leading edge (px at 1080 frame height). */
export const EDGE_PX = 3;

/** The travel's unit normal pointing into the revealed side (towards where the incoming comes from). */
export function wipeNormal(from: WipeFrom): Pt {
  const a = (WIPE_SLANT_DEG * Math.PI) / 180;
  return from === 'right' ? { x: Math.cos(a), y: -Math.sin(a) } : { x: Math.sin(a), y: Math.cos(a) };
}

const dot = (p: Pt, n: Pt) => p.x * n.x + p.y * n.y;
const corners = (w: number, h: number): Pt[] => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: h },
  { x: 0, y: h },
];

/** The edge's offset c (revealed = { p : p·n ≥ c }) at eased progress e: just past the frame's last
 *  corner at 0 (nothing revealed) to just past its first at 1 (all revealed). */
export function wipeOffset(e: number, n: Pt, w: number, h: number): number {
  const ds = corners(w, h).map((p) => dot(p, n));
  const pad = EDGE_PX * 2;
  const hi = Math.max(...ds) + pad;
  const lo = Math.min(...ds) - pad;
  return hi + (lo - hi) * e;
}

/** The revealed region at offset c: the frame rect clipped by the half-plane p·n ≥ c (Sutherland–Hodgman). */
export function wipePolygon(c: number, n: Pt, w: number, h: number): Pt[] {
  const pts = corners(w, h);
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const da = dot(a, n) - c;
    const db = dot(b, n) - c;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** The edge's segment inside the frame (empty when the line misses it). */
export function wipeEdge(c: number, n: Pt, w: number, h: number): Pt[] {
  const pts = corners(w, h);
  const hits: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const da = dot(a, n) - c;
    const db = dot(b, n) - c;
    if (da === 0) hits.push(a);
    else if ((da > 0) !== (db > 0) && db !== 0) {
      const t = da / (da - db);
      hits.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return hits.slice(0, 2);
}

const polygonCss = (pts: Pt[]) =>
  pts.length < 3 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(${pts.map((p) => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`).join(', ')})`;

/** Transforms of the two layers at eased progress e (frame px). */
export function wipeLayers(e: number, from: WipeFrom, w: number, h: number) {
  const along = from === 'right' ? w : h;
  const axis: Pt = from === 'right' ? { x: 1, y: 0 } : { x: 0, y: 1 };
  return {
    /** The outgoing shot moves against the normal (the way the edge travels) and pushes in. */
    out: { dx: -axis.x * along * OUT_DRIFT * e, dy: -axis.y * along * OUT_DRIFT * e, scale: 1 + OUT_PUSH * e },
    /** The incoming shot starts offset towards its side and settles at 0. */
    in: { dx: axis.x * along * IN_OFFSET * (1 - e), dy: axis.y * along * IN_OFFSET * (1 - e) },
  };
}

export type WipeProps = {
  kind: 'wipe';
  from: WipeFrom;
  /** The outgoing shot's push-in centre, in shares of the frame (0.5, 0.5 = centre). */
  focus: Pt;
  /** Backdrop under the incoming layer's parallax gap (its scene's own Background theme). */
  backdrop: 'light' | 'dark';
  accent: string;
};

export type CardProps = {
  kind: 'card';
  /** The card's on-screen rect in the OUTGOING shot at transition progress p (linear), for the
   *  composition's frame size — the scene's camera pushes into it. */
  rect: (p: number, width: number, height: number) => FrameRect;
  /** The card's corner radius on screen at p. */
  radius: (p: number, width: number, height: number) => number;
  accent: string;
};

export type CameraProps = WipeProps | CardProps;

/** Share of the (eased) card opening over which the page grows from the card's centre to the card. */
export const CARD_GROW = 0.3;

/** The incoming shot's clip, scale and centre at eased e, opening from `r0` to the whole frame. */
export function cardOpen(e: number, r0: FrameRect, w: number, h: number) {
  const lerp = (a: number, b: number) => a + (b - a) * e;
  const open = { x: lerp(r0.x, 0), y: lerp(r0.y, 0), w: lerp(r0.w, w), h: lerp(r0.h, h) };
  // The page first grows out of the card's centre (to the card's own size by e = CARD_GROW), so the
  // card is covered from inside instead of swapping its content in one frame.
  const g = CAM_EASE(Math.min(1, e / CARD_GROW));
  const rect = {
    x: open.x + (open.w * (1 - g)) / 2,
    y: open.y + (open.h * (1 - g)) / 2,
    w: open.w * g,
    h: open.h * g,
  };
  // The shot covers the card from the start (scaled by the card's larger share) and grows with it.
  const s0 = Math.max(r0.w / w, r0.h / h);
  const scale = lerp(s0, 1);
  const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  return { rect, scale, centre };
}

function CameraPresentation({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}: TransitionPresentationComponentProps<CameraProps>) {
  const { width, height } = useVideoConfig();
  const e = CAM_EASE(Math.min(1, Math.max(0, presentationProgress)));
  const u = height / 1080;
  if (passedProps.kind === 'card') {
    if (presentationDirection === 'exiting') return <AbsoluteFill>{children}</AbsoluteFill>;
    const r0 = passedProps.rect(presentationProgress, width, height);
    const { rect, scale, centre } = cardOpen(e, r0, width, height);
    const radius = passedProps.radius(presentationProgress, width, height) * (1 - e);
    return (
      <AbsoluteFill>
        <AbsoluteFill
          style={{
            clipPath: `inset(${rect.y}px ${width - rect.x - rect.w}px ${height - rect.y - rect.h}px ${rect.x}px round ${radius}px)`,
          }}
        >
          <AbsoluteFill
            style={{
              transformOrigin: '0 0',
              transform: `translate(${centre.x - (width / 2) * scale}px, ${centre.y - (height / 2) * scale}px) scale(${scale})`,
            }}
          >
            {children}
          </AbsoluteFill>
        </AbsoluteFill>
        {e < 1 ? (
          <div
            style={{
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              borderRadius: radius,
              boxShadow: `inset 0 0 0 ${2 * u}px ${passedProps.accent}`,
              opacity: 1 - e,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </AbsoluteFill>
    );
  }
  const { from, focus, backdrop, accent } = passedProps;
  const layers = wipeLayers(e, from, width, height);
  if (presentationDirection === 'exiting') {
    const o = layers.out;
    return (
      <AbsoluteFill
        style={{
          transformOrigin: `${focus.x * width}px ${focus.y * height}px`,
          transform: `translate(${o.dx}px, ${o.dy}px) scale(${o.scale})`,
        }}
      >
        {children}
      </AbsoluteFill>
    );
  }
  const n = wipeNormal(from);
  const c = wipeOffset(e, n, width, height);
  const poly = wipePolygon(c, n, width, height);
  const edge = wipeEdge(c, n, width, height);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: polygonCss(poly) }}>
        {/* The incoming scene's own backdrop, unmoved: whatever its parallax offset uncovers. */}
        <Background theme={backdrop} captionBand />
        <AbsoluteFill style={{ transform: `translate(${layers.in.dx}px, ${layers.in.dy}px)` }}>{children}</AbsoluteFill>
      </AbsoluteFill>
      {edge.length === 2 ? (
        <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          <line
            x1={edge[0].x}
            y1={edge[0].y}
            x2={edge[1].x}
            y2={edge[1].y}
            stroke={accent}
            strokeWidth={EDGE_PX * u}
            strokeLinecap="butt"
          />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
}

/** The presentation for a TransitionSeries.Transition. */
export const cameraTransition = (props: CameraProps): TransitionPresentation<CameraProps> => ({
  component: CameraPresentation,
  props,
});

