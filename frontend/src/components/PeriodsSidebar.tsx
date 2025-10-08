import React from 'react';
import { ArtPeriod } from '../types/timeline';
import PeriodBlock from './PeriodBlock';

interface Props {
  periods: ArtPeriod[];
  yearToPercent: (year: number) => number;
  formatYear: (year: number) => string;
  onSelectPeriod?: (p: ArtPeriod) => void;
  selectedPeriodId?: string;
}

const PeriodsSidebar: React.FC<Props> = ({ periods, yearToPercent, formatYear, onSelectPeriod, selectedPeriodId }) => {
  return (
    <div className="left-sidebar">
      <div className="periods-container">
        {periods.map(period => (
          <PeriodBlock
            key={`period-${period.id}`}
            period={period}
            startPercent={yearToPercent(period.startYear)}
            endPercent={yearToPercent(period.endYear)}
            formatYear={formatYear}
            onClick={onSelectPeriod}
            selected={selectedPeriodId === period.id}
          />
        ))}
      </div>
    </div>
  );
};

export default PeriodsSidebar;
