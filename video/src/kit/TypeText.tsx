import { useCurrentFrame } from 'remotion';
import { typed } from './math';

/** Types `text` from `startFrame` (absolute scene frame), `framesPerChar` per character. */
export function TypeText({
  text,
  startFrame,
  framesPerChar = 5,
  style,
}: {
  text: string;
  startFrame: number;
  framesPerChar?: number;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  return <span style={style}>{typed(frame, startFrame, text, framesPerChar)}</span>;
}
