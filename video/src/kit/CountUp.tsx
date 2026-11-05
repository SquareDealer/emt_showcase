import { useCurrentFrame } from 'remotion';
import { money } from '@crm/lib/format';
import { countUp } from './math';

export function CountUp({
  from,
  to,
  fromFrame,
  toFrame,
  style,
}: {
  from: number;
  to: number;
  fromFrame: number;
  toFrame: number;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  return (
    <span className="mono" style={style}>
      {money(countUp(frame, fromFrame, toFrame, from, to))}
    </span>
  );
}
