import React from 'react';
import './PreviewPane.css';
import { ArtPeriod, Artwork } from '../types/timeline';
import { markdownToHtml } from '../utils/markdown';

export type PreviewDetail =
  | { type: 'artwork'; artwork: Artwork; period?: ArtPeriod }
  | { type: 'period'; period: ArtPeriod };

interface Props {
  open: boolean;
  detail?: PreviewDetail;
  formatYear: (year: number) => string;
  onClose: () => void;
  onSwitchToModal: () => void;
  onEdit: () => void;
}

const PreviewPane: React.FC<Props> = ({ open, detail, formatYear, onClose, onSwitchToModal, onEdit }) => {
  if (!open || !detail) return null;

  const renderArtwork = (art: Artwork, period?: ArtPeriod) => (
    <div className="ppane-body">
      <div className="ppane-media">
        {art.imageUrl ? (
          <img className="ppane-media-img" src={art.imageUrl} alt={art.title} />
        ) : (
          <div className="ppane-media-fallback"><span>No Image</span></div>
        )}
      </div>
      <div className="ppane-content">
        <h3 className="ppane-title">{art.title}</h3>
        <div className="ppane-meta">
          {art.artist && <span className="ppane-chip">{art.artist}</span>}
          <span className="ppane-chip">{formatYear(art.year)}</span>
          {period && (
            <span className="ppane-chip ppane-chip--period" style={{ background: period.color }}>{period.name}</span>
          )}
        </div>
        {art.description && (
          <div className="ppane-desc" dangerouslySetInnerHTML={{ __html: markdownToHtml(art.description) }} />
        )}
      </div>
    </div>
  );

  const renderPeriod = (p: ArtPeriod) => (
    <div className="ppane-body">
      <div className="ppane-media">
        {p.imageUrl ? (
          <img className="ppane-media-img" src={p.imageUrl} alt={p.name} />
        ) : (
          <div className="ppane-media-fallback"><span>No Image</span></div>
        )}
      </div>
      <div className="ppane-content">
        <h3 className="ppane-title">{p.name}</h3>
        <div className="ppane-meta">
          <span className="ppane-chip">{formatYear(p.startYear)} - {formatYear(p.endYear)}</span>
        </div>
        {p.description && (
          <div className="ppane-desc" dangerouslySetInnerHTML={{ __html: markdownToHtml(p.description) }} />
        )}
      </div>
    </div>
  );

  return (
    <aside className="preview-pane" aria-label="预览面板" style={{ transform: 'translateX(0)', transition: 'transform 200ms ease, opacity 200ms ease', opacity: 1 }}>
      <div className="ppane-header">
        <div className="ppane-actions">
          <button className="ppane-btn ppane-btn--ghost" onClick={onEdit} title="编辑并在弹窗中打开">编辑</button>
          <button className="ppane-btn" onClick={onSwitchToModal} title="切换为弹窗显示">弹窗显示</button>
          <button className="ppane-btn ppane-btn--ghost" onClick={onClose} title="清除选择">关闭</button>
        </div>
      </div>
      {detail.type === 'artwork' ? renderArtwork(detail.artwork, detail.period) : renderPeriod(detail.period)}
    </aside>
  );
};

export default PreviewPane;
