import React, { useState } from 'react';
import { Artwork, ArtPeriod } from '../types/timeline';

interface Props {
  artwork: Artwork;
  period?: ArtPeriod;
  formatYear: (year: number) => string;
  onClick?: (artwork: Artwork, period?: ArtPeriod) => void;
}

const ArtworkCard: React.FC<Props> = ({ artwork, period, formatYear, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const hasImage = Boolean(artwork.imageUrl) && !imgError;

  return (
    <div className="artwork-content" role="button" onClick={() => onClick?.(artwork, period)}>
      {hasImage ? (
        <img
          src={artwork.imageUrl}
          alt={artwork.title}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <div className="artwork-image-fallback" aria-label="No image">
          <span className="artwork-image-fallback-text">No Image</span>
        </div>
      )}
      <div className="artwork-overlay">
        <span className="chip chip--title" title={artwork.title}>{artwork.title}</span>
        <span className="chip chip--year">{formatYear(artwork.year)}</span>
        {period && (
          <span className="chip chip--period" style={{ background: period.color }}>
            {period.name}
          </span>
        )}
      </div>
    </div>
  );
};

export default ArtworkCard;
