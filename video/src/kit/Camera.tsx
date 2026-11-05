import { createContext, useContext, type ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { cameraAt, type CamKey } from './math';

const ZoomContext = createContext(1);
/** Current camera zoom — overlays use it to keep their text size constant on screen. */
export const useCameraZoom = () => useContext(ZoomContext);

/**
 * Pans/zooms its children (a 1440×900 UI-pixel stage). Key (x, y) is the UI point that sits at the
 * frame centre, so cursor/callouts placed in UI pixels inside the Camera follow the window.
 */
export function Camera({ keys, children }: { keys: CamKey[]; children: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { x, y, zoom } = cameraAt(frame, fps, keys);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: width / 2,
          top: height / 2,
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
          <ZoomContext.Provider value={zoom}>{children}</ZoomContext.Provider>
        </div>
      </div>
    </AbsoluteFill>
  );
}
