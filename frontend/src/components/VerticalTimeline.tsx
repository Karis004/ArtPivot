import React from 'react';
import { ArtPeriod, Artwork } from '../types/timeline';
import './VerticalTimeline.css';
import { useTimelinePosition } from '../hooks/useTimelinePosition';
import PeriodsSidebar from './PeriodsSidebar';
import TimelineAxis from './TimelineAxis';
import ArtworksSidebar from './ArtworksSidebar';

interface Props {
  periods: ArtPeriod[];
  artworks: Artwork[];
  onSelectArtwork?: (a: Artwork, p?: ArtPeriod) => void;
  onSelectPeriod?: (p: ArtPeriod) => void;
  selectedArtworkId?: string;
  selectedPeriodId?: string;
}

const VerticalTimeline: React.FC<Props> = ({ periods, artworks, onSelectArtwork, onSelectPeriod, selectedArtworkId, selectedPeriodId }) => {
  const { minYear, maxYear, yearToPercent, formatYear } = useTimelinePosition(periods, artworks);

  return (
    <div className="timeline-grid-container">
      <PeriodsSidebar periods={periods} yearToPercent={yearToPercent} formatYear={formatYear} onSelectPeriod={onSelectPeriod} selectedPeriodId={selectedPeriodId} />
      <TimelineAxis
        periods={periods}
        artworks={artworks}
        yearToPercent={yearToPercent}
        formatYear={formatYear}
        minYear={minYear}
        maxYear={maxYear}
      />
      <ArtworksSidebar periods={periods} artworks={artworks} yearToPercent={yearToPercent} formatYear={formatYear} onSelectArtwork={onSelectArtwork} selectedArtworkId={selectedArtworkId} />
    </div>
  );
};

export default VerticalTimeline;