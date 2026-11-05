import { Composition, Folder } from 'remotion';
import { DebugBoard, DebugCalendar, DebugDashboard, DebugWorkOrder } from './compositions/Debug';

export const RemotionRoot = () => {
  return (
    <Folder name="Debug">
      <Composition
        id="Debug-Board"
        component={DebugBoard}
        durationInFrames={1}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ theme: 'light' as const }}
      />
      <Composition
        id="Debug-WorkOrder"
        component={DebugWorkOrder}
        durationInFrames={1}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ theme: 'light' as const }}
      />
      <Composition
        id="Debug-Calendar"
        component={DebugCalendar}
        durationInFrames={1}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ theme: 'light' as const }}
      />
      <Composition
        id="Debug-Dashboard"
        component={DebugDashboard}
        durationInFrames={1}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ theme: 'light' as const }}
      />
    </Folder>
  );
};
