import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

import VerticalTimeline from './components/VerticalTimeline';
import AddControls from './components/AddControls';
import AiSettings from './components/AiSettings';
import { ArtPeriod, Artwork } from './types/timeline';
import DetailModal, { DetailState } from './components/DetailModal';
import PreviewPane from './components/PreviewPane';
import { useTimelinePosition } from './hooks/useTimelinePosition';
import axios from 'axios';

function App() {
  // 从后端加载数据
  const [periods, setPeriods] = useState<ArtPeriod[]>([]);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [detail, setDetail] = useState<DetailState | undefined>(undefined);
  const [previewMode, setPreviewMode] = useState<'side-pane' | 'modal'>('side-pane');
  const [loading, setLoading] = useState(true);
  const [modalEntryMode, setModalEntryMode] = useState<'view' | 'edit'>('view');
  const consumeModalEntryMode = useCallback(() => setModalEntryMode('view'), [setModalEntryMode]);

  // 仅为提供 formatYear 给弹窗使用（避免重复逻辑）
  const { formatYear } = useTimelinePosition(periods, artworks);

  const periodMap = useMemo(() => new Map(periods.map(p => [p.id, p])), [periods]);

  // 首次加载：从 API 获取数据
  useEffect(() => {
    (async () => {
      try {
        const [pRes, aRes] = await Promise.all([
          axios.get('/api/periods'),
          axios.get('/api/artworks')
        ]);
  const toPeriod = (p: any): ArtPeriod => ({ id: String(p._id), name: p.name, startYear: p.startYear, endYear: p.endYear, color: p.color, description: p.description, imageUrl: p.imageUrl || '' });
        const toArtwork = (a: any): Artwork => ({ id: String(a._id), title: a.title, artist: a.artist, year: a.year, imageUrl: a.imageUrl || '', description: a.description || '', periodId: a.periodId ? String(a.periodId) : '' });
        setPeriods((pRes.data?.list || []).map(toPeriod));
        setArtworks((aRes.data?.list || []).map(toArtwork));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="App">
      <header className="app-header">
        <h1>ArtPivot</h1>
        <div className="app-header-actions">
          <AiSettings />
        </div>
      </header>

      <main style={{ position: 'relative', paddingRight: previewMode === 'side-pane' && !!detail ? 412 : 0, transition: 'padding-right 220ms ease' }}>
        {loading && <div style={{ padding: 12, color: '#666' }}>加载中…</div>}
        <AddControls
          periods={periods}
          onAddPeriod={async (p: ArtPeriod) => {
            const res = await axios.post('/api/periods', { name: p.name, startYear: p.startYear, endYear: p.endYear, color: p.color, description: p.description, imageUrl: p.imageUrl || '' });
            const np: ArtPeriod = { id: String(res.data.item._id), name: res.data.item.name, startYear: res.data.item.startYear, endYear: res.data.item.endYear, color: res.data.item.color, description: res.data.item.description, imageUrl: res.data.item.imageUrl || '' };
            setPeriods(prev => [...prev, np]);
          }}
          onAddArtwork={async (a: Artwork) => {
            const res = await axios.post('/api/artworks', { title: a.title, artist: a.artist, year: a.year, imageUrl: a.imageUrl, description: a.description, periodId: a.periodId || null });
            const na: Artwork = { id: String(res.data.item._id), title: res.data.item.title, artist: res.data.item.artist, year: res.data.item.year, imageUrl: res.data.item.imageUrl || '', description: res.data.item.description || '', periodId: res.data.item.periodId ? String(res.data.item.periodId) : '' };
            setArtworks(prev => [...prev, na]);
          }}
        />
        <div>
          <VerticalTimeline
            periods={periods}
            artworks={artworks}
            onSelectArtwork={(a, p) => setDetail({ type: 'artwork', artwork: a, period: p ?? periodMap.get(a.periodId) })}
            onSelectPeriod={(p) => setDetail({ type: 'period', period: p })}
            selectedArtworkId={detail?.type === 'artwork' ? detail.artwork.id : undefined}
            selectedPeriodId={detail?.type === 'period' ? detail.period.id : undefined}
          />
        </div>
        {previewMode === 'side-pane' && (
          <PreviewPane
            open={!!detail}
            detail={detail as any}
            formatYear={formatYear}
            onClose={() => setDetail(undefined)}
            onSwitchToModal={() => {
              setModalEntryMode('view');
              setPreviewMode('modal');
            }}
            onEdit={() => {
              setModalEntryMode('edit');
              setPreviewMode('modal');
            }}
          />
        )}
        <DetailModal
          open={!!detail && previewMode === 'modal'}
          detail={detail}
          onClose={() => { setDetail(undefined); setPreviewMode('side-pane'); consumeModalEntryMode(); }}
          formatYear={formatYear}
          onUpdateArtwork={(a) => {
            (async () => {
              await axios.put(`/api/artworks/${a.id}`, { title: a.title, artist: a.artist, year: a.year, imageUrl: a.imageUrl, description: a.description, periodId: a.periodId || null });
              setArtworks(prev => prev.map(x => x.id === a.id ? a : x));
            })();
            setDetail(d => d && d.type === 'artwork' ? { ...d, artwork: a } : d);
          }}
          onUpdatePeriod={(p) => {
            (async () => {
              await axios.put(`/api/periods/${p.id}`, { name: p.name, startYear: p.startYear, endYear: p.endYear, color: p.color, description: p.description, imageUrl: p.imageUrl || '' });
              setPeriods(prev => prev.map(x => x.id === p.id ? p : x));
            })();
            setDetail(d => d && d.type === 'period' ? { ...d, period: p } : d);
          }}
          startInEdit={modalEntryMode === 'edit'}
          onStartEditConsumed={consumeModalEntryMode}
          onDeleteArtwork={(id) => {
            (async () => {
              await axios.delete(`/api/artworks/${id}`);
              setArtworks(prev => prev.filter(x => x.id !== id));
            })();
            setDetail(undefined);
            setPreviewMode('side-pane');
            consumeModalEntryMode();
          }}
        />
      </main>
    </div>
  );
}

export default App;