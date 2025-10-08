import React from 'react';
import { ArtPeriod } from '../types/timeline';

interface Props {
  period: ArtPeriod;
  startPercent: number;
  endPercent: number;
  formatYear: (year: number) => string;
  onClick?: (period: ArtPeriod) => void;
  selected?: boolean;
}

const PeriodBlock: React.FC<Props> = ({ period, startPercent, endPercent, formatYear, onClick, selected }) => {
  const height = Math.max(1, endPercent - startPercent);
  return (
    <div
      className={"period-block" + (selected ? " is-selected" : "")}
      style={{
        top: `${startPercent}%`,
        height: `${height}%`
      }}
      role="button"
      onClick={() => onClick?.(period)}
    >
      {/* 用于绘制中部竖线的伪元素承载（见 CSS: .period-block .period-content::before） */}
      <div className="period-content" aria-hidden="true" />

      {/* 左侧小型信息卡片 */}
      <div className="period-mini-card">
        <h4>{period.name}</h4>
        <div className="period-years">
          {formatYear(period.startYear)} - {formatYear(period.endYear)}
        </div>
        <p>{period.description}</p>
      </div>
    </div>
  );
};

export default PeriodBlock;
