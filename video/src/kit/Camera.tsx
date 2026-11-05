import { createContext, useContext, type ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { cameraAt, cameraCentre, type CamKey } from './math';
import { useLayout } from './useLayout';

export type CameraState = { x: number; y: number; zoom: number; centre: { x: number; y: number } };

const CameraContext = createContext<CameraState | null>(null);
/** Current camera zoom — overlays use it to keep their text size constant on screen. */
export const useCameraZoom = () => useContext(CameraContext)?.zoom ?? 1;
/** The camera the overlay is drawn under (null outside a Camera) — Callout's social plaque pins itself
 *  to the frame with it. */
export const useCameraState = () => useContext(CameraContext);

/**
 * Pans/zooms its children (a 1440×900 UI-pixel stage). Key (x, y) is the UI point that sits at the
 * frame centre — in the social layout, at the centre of the stage between the brand band and the
 * caption plaque — so cursor/callouts placed in UI pixels inside the Camera follow the window.
 */
export function Camera({ keys, children }: { keys: CamKey[]; children: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const centre = cameraCentre(useLayout(), width, height);
  const { x, y, zoom } = cameraAt(frame, fps, keys);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: centre.x,
          top: centre.y,
          width: 0,
          height: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transformOrigin: '0 0',
            transform: `scale(${zoom}) translate(${-x}px, ${-y}px)`,
          }}
        >
          <CameraContext.Provider value={{ x, y, zoom, centre }}>{children}</CameraContext.Provider>
        </div>
      </div>
    </AbsoluteFill>
  );
}
