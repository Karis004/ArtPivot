import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArtPeriod, Artwork } from '../types/timeline';

type DetailState =
  | { type: 'artwork'; artwork: Artwork; period?: ArtPeriod }
  | { type: 'period'; period: ArtPeriod };

interface Props {
  open: boolean;
  detail?: DetailState;
  onClose: () => void;
  formatYear: (y: number) => string;
  onUpdateArtwork?: (a: Artwork) => void;
  onUpdatePeriod?: (p: ArtPeriod) => void;
  onDeleteArtwork?: (id: string) => void;
}

const DetailModal: React.FC<Props> = ({ open, detail, onClose, formatYear, onUpdateArtwork, onUpdatePeriod, onDeleteArtwork }) => {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ea, setEa] = useState<Artwork | null>(null);
  const [ep, setEp] = useState<ArtPeriod | null>(null);
  const [uploadingA, setUploadingA] = useState(false);
  const [uploadingP, setUploadingP] = useState(false);
  const fileInputA = React.useRef<HTMLInputElement | null>(null);
  const fileInputP = React.useRef<HTMLInputElement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const handleDelete = async () => {
    if (!ea) return;
    const ok = window.confirm('确定要删除该画作吗？');
    if (!ok) return;
    try {
      setBusy(true);
      const res = await axios.delete(`/api/artworks/${ea.id}`);
      if (res.data?.ok) {
        onDeleteArtwork && onDeleteArtwork(ea.id);
        onClose();
      } else {
        alert('删除失败');
      }
    } catch (e: any) {
      alert('删除失败：' + (e?.response?.data?.error || e?.message));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    setEditing(false);
    setBusy(false);
    if (detail?.type === 'artwork') setEa(detail.artwork);
    else setEa(null);
    if (detail?.type === 'period') setEp(detail.period);
    else setEp(null);
  }, [detail, open]);

  if (!open || !detail) return null;

  const renderMedia = () => {
    if (detail.type === 'artwork' && (editing ? ea?.imageUrl : detail.artwork.imageUrl)) {
      return (
        <img
          src={editing ? ea?.imageUrl : detail.artwork.imageUrl}
          alt={editing ? ea?.title || '' : detail.artwork.title}
          className="detail-media-img"
          style={{ cursor: 'pointer' }}
          onClick={() => setPreviewOpen(true)}
        />
      );
    }
    // Period 或无图时的占位
    return (
      <div className="detail-media-fallback">
        <div className="detail-media-fallback-inner">No Image</div>
      </div>
    );
  };

  const renderContent = () => {
    if (detail.type === 'artwork') {
      const a = editing && ea ? ea : detail.artwork;
      const p = detail.period;
      return (
        <div className="detail-content-inner">
          {editing ? (
            <>
              <div className="form-row">
                <label>标题</label>
                <input value={a.title} onChange={e => setEa({ ...(a as Artwork), title: e.target.value })} />
              </div>
              <div className="form-row">
                <label>作者</label>
                <input value={a.artist} onChange={e => setEa({ ...(a as Artwork), artist: e.target.value })} />
              </div>
              <div className="form-row">
                <label>
                  年份
                  <span
                    title="年份为数字：正数表示公元 (AD)，负数表示公元前 (BC)。"
                    style={{ marginLeft: 6, display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', border: '1px solid #9aa4b2', color: '#6b7280', fontSize: 11, alignItems: 'center', justifyContent: 'center', cursor: 'help' }}
                  >i</span>
                </label>
                <input type="number" value={a.year} onChange={e => setEa({ ...(a as Artwork), year: Number(e.target.value || 0) })} />
              </div>
              <div className="form-row">
                <label>图片 URL</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={async (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const f = e.dataTransfer.files && e.dataTransfer.files[0];
                    if (!f) return;
                    setUploadingA(true);
                    try {
                      const form = new FormData();
                      form.append('file', f);
                      const res = await axios.post('/api/upload/image', form, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        maxBodyLength: 20 * 1024 * 1024,
                      });
                      if (res.data?.ok && res.data?.url) setEa({ ...(a as Artwork), imageUrl: res.data.url });
                    } catch (err: any) {
                      alert(err?.response?.data?.error || err?.message || '上传失败');
                    } finally {
                      setUploadingA(false);
                    }
                  }}
                  style={{ display: 'flex', gap: 8, border: '1px dashed #d1d5db', padding: 8, borderRadius: 6 }}
                  title="可拖拽图片到此上传"
                >
                  <input style={{ flex: 1 }} value={a.imageUrl} onChange={e => setEa({ ...(a as Artwork), imageUrl: e.target.value })} placeholder="https://..." />
                  <input ref={fileInputA} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                    const f = e.target.files && e.target.files[0];
                    if (!f) return;
                    setUploadingA(true);
                    try {
                      const form = new FormData();
                      form.append('file', f);
                      const res = await axios.post('/api/upload/image', form, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        maxBodyLength: 20 * 1024 * 1024,
                      });
                      if (res.data?.ok && res.data?.url) setEa({ ...(a as Artwork), imageUrl: res.data.url });
                    } catch (err: any) {
                      alert(err?.response?.data?.error || err?.message || '上传失败');
                    } finally {
                      setUploadingA(false);
                      if (fileInputA.current) fileInputA.current.value = '';
                    }
                  }} />
                  <button className="btn" disabled={uploadingA} onClick={() => fileInputA.current?.click()}>{uploadingA ? '上传中…' : '上传图片'}</button>
                  <button className="btn" onClick={() => setEa({ ...(a as Artwork), imageUrl: '' })}>移除图片</button>
                </div>
              </div>
              <div className="form-row">
                <label>描述</label>
                <textarea rows={3} value={a.description} onChange={e => setEa({ ...(a as Artwork), description: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <h2 className="detail-title">{a.title}</h2>
              <div className="detail-meta">
                <span className="meta-chip">{formatYear(a.year)}</span>
                {a.artist && <span className="meta-chip">{a.artist}</span>}
                {p && (
                  <span className="meta-chip meta-chip--period" style={{ background: p.color, color: '#fff' }}>
                    {p.name}
                  </span>
                )}
              </div>
              {a.description && (
                <p className="detail-desc">{a.description}</p>
              )}
            </>
          )}
        </div>
      );
    }
    const p = editing && ep ? ep : detail.period;
    return (
      <div className="detail-content-inner">
        {editing ? (
          <>
            <div className="form-row">
              <label>名称</label>
              <input value={p.name} onChange={e => setEp({ ...(p as ArtPeriod), name: e.target.value })} />
            </div>
            <div className="form-row">
              <label>
                开始年份
                <span
                  title="开始/结束年份均为数字：正数表示公元 (AD)，负数表示公元前 (BC)。"
                  style={{ marginLeft: 6, display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', border: '1px solid #9aa4b2', color: '#6b7280', fontSize: 11, alignItems: 'center', justifyContent: 'center', cursor: 'help' }}
                >i</span>
              </label>
              <input type="number" value={p.startYear} onChange={e => setEp({ ...(p as ArtPeriod), startYear: Number(e.target.value || 0) })} />
            </div>
            <div className="form-row">
              <label>
                结束年份
                <span
                  title="开始/结束年份均为数字：正数表示公元 (AD)，负数表示公元前 (BC)。"
                  style={{ marginLeft: 6, display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', border: '1px solid #9aa4b2', color: '#6b7280', fontSize: 11, alignItems: 'center', justifyContent: 'center', cursor: 'help' }}
                >i</span>
              </label>
              <input type="number" value={p.endYear} onChange={e => setEp({ ...(p as ArtPeriod), endYear: Number(e.target.value || 0) })} />
            </div>
            <div className="form-row">
              <label>颜色</label>
              <input value={p.color} onChange={e => setEp({ ...(p as ArtPeriod), color: e.target.value })} />
            </div>
            <div className="form-row">
              <label>封面图片</label>
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={async (e) => {
                  e.preventDefault(); e.stopPropagation();
                  const f = e.dataTransfer.files && e.dataTransfer.files[0];
                  if (!f) return;
                  setUploadingP(true);
                  try {
                    const form = new FormData();
                    form.append('file', f);
                    const res = await axios.post('/api/upload/image', form, {
                      headers: { 'Content-Type': 'multipart/form-data' },
                      maxBodyLength: 20 * 1024 * 1024,
                    });
                    if (res.data?.ok && res.data?.url) setEp({ ...(p as ArtPeriod), imageUrl: res.data.url });
                  } catch (err: any) {
                    alert(err?.response?.data?.error || err?.message || '上传失败');
                  } finally {
                    setUploadingP(false);
                  }
                }}
                style={{ display: 'flex', gap: 8, border: '1px dashed #d1d5db', padding: 8, borderRadius: 6 }}
                title="可拖拽图片到此上传"
              >
                <input style={{ flex: 1 }} value={p.imageUrl || ''} onChange={e => setEp({ ...(p as ArtPeriod), imageUrl: e.target.value })} placeholder="https://..." />
                <input ref={fileInputP} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                  const f = e.target.files && e.target.files[0];
                  if (!f) return;
                  setUploadingP(true);
                  try {
                    const form = new FormData();
                    form.append('file', f);
                    const res = await axios.post('/api/upload/image', form, {
                      headers: { 'Content-Type': 'multipart/form-data' },
                      maxBodyLength: 20 * 1024 * 1024,
                    });
                    if (res.data?.ok && res.data?.url) setEp({ ...(p as ArtPeriod), imageUrl: res.data.url });
                  } catch (err: any) {
                    alert(err?.response?.data?.error || err?.message || '上传失败');
                  } finally {
                    setUploadingP(false);
                    if (fileInputP.current) fileInputP.current.value = '';
                  }
                }} />
                <button className="btn" disabled={uploadingP} onClick={() => fileInputP.current?.click()}>{uploadingP ? '上传中…' : '上传图片'}</button>
                <button className="btn" onClick={() => setEp({ ...(p as ArtPeriod), imageUrl: '' })}>移除图片</button>
              </div>
            </div>
            <div className="form-row">
              <label>描述</label>
              <textarea rows={3} value={p.description} onChange={e => setEp({ ...(p as ArtPeriod), description: e.target.value })} />
            </div>
          </>
        ) : (
          <>
            <h2 className="detail-title">{p.name}</h2>
            <div className="detail-meta">
              <span className="meta-chip" style={{ borderColor: p.color, color: p.color }}>
                {formatYear(p.startYear)} – {formatYear(p.endYear)}
              </span>
            </div>
            {p.description && (
              <p className="detail-desc">{p.description}</p>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="detail-close" onClick={onClose} aria-label="Close">×</button>
        <div className="detail-body">
          <div className="detail-media">
            {renderMedia()}
          </div>
          <div className="detail-content">
            {renderContent()}
            <div className="modal-actions" style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {!editing ? (
                <>
                  <button className="btn" onClick={() => setEditing(true)}>编辑</button>
                  {detail.type === 'artwork' && ea && (
                    <button className="btn" disabled={busy} onClick={handleDelete} style={{ color: '#b00020' }}>删除该画作</button>
                  )}
                </>
              ) : (
                <>
                  <button className="btn secondary" disabled={busy} onClick={() => setEditing(false)}>取消</button>
                  <button className="btn primary" disabled={busy} onClick={async () => {
                    if (detail.type === 'artwork' && ea) {
                      try {
                        setBusy(true);
                        await axios.put(`/api/artworks/${ea.id}`, { title: ea.title, artist: ea.artist, year: ea.year, imageUrl: ea.imageUrl, description: ea.description, periodId: ea.periodId || null });
                        onUpdateArtwork?.(ea);
                        setEditing(false);
                      } catch (e) {
                        alert('保存失败');
                      } finally {
                        setBusy(false);
                      }
                    } else if (detail.type === 'period' && ep) {
                      try {
                        setBusy(true);
                        await axios.put(`/api/periods/${ep.id}`, { name: ep.name, startYear: ep.startYear, endYear: ep.endYear, color: ep.color, description: ep.description, imageUrl: ep.imageUrl || '' });
                        onUpdatePeriod?.(ep);
                        setEditing(false);
                      } catch (e) {
                        alert('保存失败');
                      } finally {
                        setBusy(false);
                      }
                    }
                  }}>保存</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {previewOpen && detail.type === 'artwork' && (
        <div
          onClick={() => setPreviewOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30000000, cursor: 'zoom-out' }}
        >
          <img
            src={(editing ? ea?.imageUrl : detail.artwork.imageUrl) || ''}
            alt={(editing ? ea?.title : detail.artwork.title) || ''}
            style={{ maxWidth: '96vw', maxHeight: '96vh', objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  );
};

export type { DetailState };
export default DetailModal;
