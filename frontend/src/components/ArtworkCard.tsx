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
      <div className="artwork-hover-backdrop"></div>
      
      <div className="artwork-image-wrapper">
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
      </div>
      
      {/* 文字信息 */}
      <div className="artwork-hover-info">
        <div className="artwork-hover-title">{artwork.title}</div>
        <div className="artwork-hover-year">{formatYear(artwork.year)}</div>
      </div>
    </div>
  );
};

export default ArtworkCard;
