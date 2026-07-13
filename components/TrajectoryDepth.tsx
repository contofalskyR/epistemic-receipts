type Props = {
  transitionCount: number;
  firstYear?: number | null;
  lastYear?: number | null;
  className?: string;
};

export function TrajectoryDepth({ transitionCount, firstYear, lastYear, className = "" }: Props) {
  const hasTrajectory = transitionCount >= 2;

  if (!hasTrajectory) {
    return (
      <span className={`font-mono text-[10px] text-gray-600 italic ${className}`}>
        Reference record · no traced trajectory yet
      </span>
    );
  }

  const yearSpan =
    firstYear && lastYear && firstYear !== lastYear
      ? ` · ${firstYear} → ${lastYear}`
      : firstYear
      ? ` · ${firstYear}`
      : "";

  return (
    <span className={`font-mono text-[10px] text-gray-400 ${className}`}>
      {transitionCount} receipts{yearSpan}
    </span>
  );
}
