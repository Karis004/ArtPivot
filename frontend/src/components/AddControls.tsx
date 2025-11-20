import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { ArtPeriod, Artwork } from '../types/timeline';
import './AddControls.css';

interface Props {
  periods: ArtPeriod[];
  onAddPeriod: (p: ArtPeriod) => void;
  onAddArtwork: (a: Artwork) => void;
  // Controlled state from parent
  showPeriod: boolean;
  setShowPeriod: (v: boolean) => void;
  showArtwork: boolean;
  setShowArtwork: (v: boolean) => void;
  showAiImport: boolean;
  setShowAiImport: (v: boolean) => void;
}

const AddControls: React.FC<Props> = ({ 
  periods, onAddPeriod, onAddArtwork,
  showPeriod, setShowPeriod,
  showArtwork, setShowArtwork,
  showAiImport, setShowAiImport
}) => {
  const periodOptions = useMemo(() => periods.map(p => ({ id: p.id, name: p.name })), [periods]);

  return (
    <div className="add-controls-modals">
      {/* Buttons moved to App header menu */}

      {showArtwork && (
        <ArtworkModal
          periods={periodOptions}
          onClose={() => setShowArtwork(false)}
          onSubmit={(a) => { onAddArtwork(a); setShowArtwork(false); }}
        />
      )}

      {showPeriod && (
        <PeriodModal
          onClose={() => setShowPeriod(false)}
          onSubmit={(p) => { onAddPeriod(p); setShowPeriod(false); }}
        />
      )}

      {showAiImport && (
        <AiImportModal
          periods={periods}
          onClose={() => setShowAiImport(false)}
          onApply={(added) => {
            // 追加 periods 和 artworks
            added.periods.forEach(onAddPeriod);
            added.artworks.forEach(onAddArtwork);
            setShowAiImport(false);
          }}
        />
      )}
    </div>
  );
};

export default AddControls;

// ——— Modals ———

const genId = () => Math.random().toString(36).slice(2);

// AI 导入弹窗
const AiImportModal: React.FC<{
  periods: ArtPeriod[];
  onClose: () => void;
  onApply: (data: { periods: ArtPeriod[]; artworks: Artwork[] }) => void;
}> = ({ periods, onClose, onApply }) => {
  const [file, setFile] = useState<File | null>(null);
  const [textPreview, setTextPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<{ periods: any[]; artworks: any[] } | null>(null);
  const [history, setHistory] = useState<{ filename: string; createdAt: string }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    setFile(f || null);
    setTextPreview('');
    setError(undefined);
    setResult(null);
  };

  const readDocOnServer = async () => {
    if (!file) { setError('请先选择 .doc/.docx 文件'); return; }
    setLoading(true); setError(undefined); setTextPreview(''); setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await axios.post('/api/ai/read-doc', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        maxBodyLength: 20 * 1024 * 1024,
      });
      const text: string = res.data?.text || '';
      setTextPreview(text.slice(0, 1200));
      return text;
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || '读取失败');
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  // 可扩展：展示完整提示词供用户参考

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await axios.get('/api/ai/history');
  setHistory(res.data?.list || []);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  React.useEffect(() => {
    loadHistory();
  }, []);

  const runExtract = async () => {
    const docText = await readDocOnServer();
    if (!docText) return;
    setLoading(true); setError(undefined);
    try {
      const apiKey = localStorage.getItem('ai.apiKey') || '';
      const model = localStorage.getItem('ai.model') || '';
      const baseUrl = localStorage.getItem('ai.baseUrl') || '';
      
      const payload: any = { text: docText, filename: file?.name || undefined };
      if (apiKey) payload.apiKey = apiKey; // 无 key 时，后端会优先本地解析 IMAGES
      if (model) payload.model = model;
      if (baseUrl) payload.baseUrl = baseUrl;
      
      const res = await axios.post('/api/ai/extract', payload);
      if (!res.data?.ok) {
        setError(res.data?.error || 'AI 提取失败');
        return;
      }
      setResult({ periods: res.data.periods || [], artworks: res.data.artworks || [] });
      loadHistory();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'AI 提取失败');
    } finally {
      setLoading(false);
    }
  };

  // 历史仅做展示，不再支持回填详情

  // 已弃用：保存到示例数据（改用 CRUD 直接入库）

  const toAppTypes = async () => {
    if (!result) return;
    // 重复 period 去重（按 name）
    const existingNames = new Set(periods.map(p => p.name));
    const newPeriods: ArtPeriod[] = (result.periods || [])
      .filter((p: any) => p?.name && !existingNames.has(p.name))
      .map((p: any) => ({
        id: genId(),
        name: String(p.name),
        startYear: Number(p.startYear) || 0,
        endYear: Number(p.endYear) || 0,
        color: '#1e6bd6',
        description: String(p.description || ''),
        imageUrl: ''
      }));

  // 仅用“已有”的 period 建立 name -> id 映射（新建的还没有真实 Mongo _id）
  const nameToId = new Map(periods.map(p => [p.name, p.id]));

    const newArtworks: Artwork[] = (result.artworks || [])
      .filter((a: any) => a?.title && a?.artist && typeof a?.year === 'number')
      .map((a: any) => ({
        id: genId(),
        title: String(a.title),
        artist: String(a.artist),
        year: Number(a.year),
        imageUrl: String(a.imageUrl || ''),
        description: String(a.description || ''),
        periodId: nameToId.get(String(a.periodName || '')) || ''
      }));

    // 直接将解析结果回传，由父组件通过 API 创建
    onApply({ periods: newPeriods, artworks: newArtworks });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>AI 读取（上传 .doc/.docx 并自动解析）</h3>

        <div className="form-row">
          <label>选择文档</label>
          <input type="file" accept=".doc,.docx" onChange={onFileChange} />
        </div>

        <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" disabled={loading || !file} onClick={runExtract}>{loading ? '处理中…' : '读取并提取'}</button>
        </div>

        <div className="form-row">
          <label>读取历史</label>
          {loadingHistory ? (
            <div>加载中…</div>
          ) : (
            <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #eee', borderRadius: 6, padding: 6 }}>
              {history.length === 0 ? (
                <div style={{ color: '#666', fontSize: 12 }}>暂无历史</div>
              ) : history.map((h, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderBottom: '1px dashed #eee' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13 }}>{h.filename}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{new Date(h.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {textPreview && (
          <div className="form-row">
            <label>文档预览（前 1200 字）</label>
            <textarea rows={6} readOnly value={textPreview} />
          </div>
        )}

        {result && (
          <div className="form-row">
            <label>提取结果（预览）</label>
            <textarea rows={8} readOnly value={JSON.stringify(result, null, 2)} />
          </div>
        )}

        {error && (
          <div style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div>
        )}

        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose}>取消</button>
          <button className="btn primary" disabled={!result} onClick={toAppTypes}>加入数据</button>
        </div>
      </div>
    </div>
  );
};

const ArtworkModal: React.FC<{
  periods: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (a: Artwork) => void;
}> = ({ periods, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [description, setDescription] = useState('');
  const [periodId, setPeriodId] = useState(''); // 允许留空

  const disabled = !title || !artist || year === '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>添加 Artwork</h3>
        <div className="form-row">
          <label>标题</label>
          <input value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="form-row">
          <label>作者</label>
          <input value={artist} onChange={e => setArtist(e.target.value)} />
        </div>
        <div className="form-row">
          <label>
            年份
            <span
              title="年份为数字：正数表示公元 (AD)，负数表示公元前 (BC)"
              style={{ marginLeft: 6, display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', border: '1px solid #9aa4b2', color: '#6b7280', fontSize: 11, alignItems: 'center', justifyContent: 'center', cursor: 'help' }}
            >i</span>
          </label>
          <input type="number" value={year} onChange={e => setYear(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
        <div className="form-row">
          <label>图片 URL</label>
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={async (e) => {
              e.preventDefault(); e.stopPropagation();
              const f = e.dataTransfer.files && e.dataTransfer.files[0];
              if (!f) return;
              setUploading(true);
              try {
                const form = new FormData();
                form.append('file', f);
                const res = await axios.post('/api/upload/image', form, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                  maxBodyLength: 20 * 1024 * 1024,
                });
                if (res.data?.ok && res.data?.url) setImageUrl(res.data.url);
              } catch (err: any) {
                alert(err?.response?.data?.error || err?.message || '上传失败');
              } finally {
                setUploading(false);
              }
            }}
            style={{ display: 'flex', gap: 8, border: '1px dashed #d1d5db', padding: 8, borderRadius: 6 }}
            title="可拖拽图片到此上传"
          >
            <input style={{ flex: 1 }} value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
              const f = e.target.files && e.target.files[0];
              if (!f) return;
              setUploading(true);
              try {
                const form = new FormData();
                form.append('file', f);
                const res = await axios.post('/api/upload/image', form, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                  maxBodyLength: 20 * 1024 * 1024,
                });
                if (res.data?.ok && res.data?.url) setImageUrl(res.data.url);
              } catch (err: any) {
                alert(err?.response?.data?.error || err?.message || '上传失败');
              } finally {
                setUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }
            }} />
            <button className="btn" disabled={uploading} onClick={() => fileInputRef.current?.click()}>{uploading ? '上传中…' : '上传图片'}</button>
          </div>
        </div>
        <div className="form-row">
          <label>描述</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="form-row">
          <label>所属 Period（可留空）</label>
          <select value={periodId} onChange={e => setPeriodId(e.target.value)}>
            <option value="">未指定</option>
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose}>取消</button>
          <button className="btn primary" disabled={disabled} onClick={() => onSubmit({
            id: genId(), title, artist, year: Number(year), imageUrl, description, periodId
          })}>添加</button>
        </div>
      </div>
    </div>
  );
};

const PeriodModal: React.FC<{
  onClose: () => void;
  onSubmit: (p: ArtPeriod) => void;
}> = ({ onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [startYear, setStartYear] = useState<number | ''>('');
  const [endYear, setEndYear] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const disabled = !name || startYear === '' || endYear === '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>添加 Period</h3>
        <div className="form-row">
          <label>名称</label>
          <input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-row">
          <label>
            开始年份
            <span
              title="开始/结束年份均为数字：正数表示公元 (AD)，负数表示公元前 (BC)。"
              style={{ marginLeft: 6, display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', border: '1px solid #9aa4b2', color: '#6b7280', fontSize: 11, alignItems: 'center', justifyContent: 'center', cursor: 'help' }}
            >i</span>
          </label>
          <input type="number" value={startYear} onChange={e => setStartYear(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
        <div className="form-row">
          <label>
            结束年份
            <span
              title="开始/结束年份均为数字：正数表示公元 (AD)，负数表示公元前 (BC)。"
              style={{ marginLeft: 6, display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', border: '1px solid #9aa4b2', color: '#6b7280', fontSize: 11, alignItems: 'center', justifyContent: 'center', cursor: 'help' }}
            >i</span>
          </label>
          <input type="number" value={endYear} onChange={e => setEndYear(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
        {/* 颜色固定为默认蓝色，无需选择 */}
        <div className="form-row">
          <label>描述</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="form-row">
          <label>封面图片</label>
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={async (e) => {
              e.preventDefault(); e.stopPropagation();
              const f = e.dataTransfer.files && e.dataTransfer.files[0];
              if (!f) return;
              setUploading(true);
              try {
                const form = new FormData();
                form.append('file', f);
                const res = await axios.post('/api/upload/image', form, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                  maxBodyLength: 20 * 1024 * 1024,
                });
                if (res.data?.ok && res.data?.url) setImageUrl(res.data.url);
              } catch (err: any) {
                alert(err?.response?.data?.error || err?.message || '上传失败');
              } finally {
                setUploading(false);
              }
            }}
            style={{ border: '1px dashed #d1d5db', padding: 8, borderRadius: 6 }}
            title="可拖拽图片到此上传"
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input style={{ flex: 1 }} value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                setUploading(true);
                try {
                  const form = new FormData();
                  form.append('file', f);
                  const res = await axios.post('/api/upload/image', form, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    maxBodyLength: 20 * 1024 * 1024,
                  });
                  if (res.data?.ok && res.data?.url) setImageUrl(res.data.url);
                } catch (err: any) {
                  alert(err?.response?.data?.error || err?.message || '上传失败');
                } finally {
                  setUploading(false);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }
              }} />
              <button className="btn" disabled={uploading} onClick={() => fileInputRef.current?.click()}>{uploading ? '上传中…' : '上传图片'}</button>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose}>取消</button>
          <button className="btn primary" disabled={disabled} onClick={() => onSubmit({
            id: genId(), name, startYear: Number(startYear), endYear: Number(endYear), color: '#1e6bd6', description, imageUrl
          })}>添加</button>
        </div>
      </div>
    </div>
  );
};
