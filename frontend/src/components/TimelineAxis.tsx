import React, { useMemo } from 'react';
import { ArtPeriod, Artwork } from '../types/timeline';

interface Props {
  periods: ArtPeriod[];
  artworks: Artwork[];
  yearToPercent: (year: number) => number;
  formatYear: (year: number) => string;
  minYear: number;
  maxYear: number;
}

const TimelineAxis: React.FC<Props> = ({ periods, artworks, yearToPercent, formatYear, minYear, maxYear }) => {
  const majorTicks = useMemo(() => {
    const totalYears = Math.max(1, maxYear - minYear);
    const ticks: number[] = [];
    const tickInterval = Math.max(100, Math.round(totalYears / 20));
    let currentTick = Math.floor(minYear / tickInterval) * tickInterval;
    while (currentTick <= maxYear) {
      if (currentTick >= minYear) {
        ticks.push(currentTick);
      }
      currentTick += tickInterval;
    }
    return ticks;
  }, [minYear, maxYear]);

  const periodPoints = useMemo(
    () =>
      periods.flatMap(period => [
        { id: `period-start-${period.id}`, year: period.startYear, type: 'period-start' as const, label: `${period.name} 开始` },
        { id: `period-end-${period.id}`, year: period.endYear, type: 'period-end' as const, label: `${period.name} 结束` }
      ]),
    [periods]
  );

  // 右侧作品的时间点不再在轴上显示，改由右侧 Sidebar 分组左上角显示标签

  return (
    <div className="timeline-axis">
      <div className="axis-line"></div>

      {majorTicks.map((year) => (
        <div key={`tick-${year}`} className="major-tick" style={{ top: `${yearToPercent(year)}%` }}>
          <div className="tick-label">{formatYear(year)}</div>
        </div>
      ))}

      {periodPoints.map((point) => (
        <div
          key={point.id}
          className={`time-point period-point ${point.type}`}
          style={{ top: `${yearToPercent(point.year)}%` }}
          title={point.label}
        >
          <div className="time-tag time-tag--blue">{formatYear(point.year)}</div>
        </div>
      ))}

      {/* no artwork points on axis */}
    </div>
  );
};

export default TimelineAxis;
