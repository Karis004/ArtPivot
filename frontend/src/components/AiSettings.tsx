import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AddControls.css';
import './AiSettings.css';

const LS_KEY = 'ai.apiKey';
const LS_NAME = 'ai.apiName';

const AiSettings: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiName, setApiName] = useState('');
  const [saving, setSaving] = useState(false);
  const [testMsg, setTestMsg] = useState<string | undefined>(undefined);
  const [testing, setTesting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) || '';
    setApiKey(saved);
    const savedName = localStorage.getItem(LS_NAME) || '';
    setApiName(savedName);
  }, []);

  // 名称用于展示，Key 不再显示明文或掩码

  const onSave = () => {
    setSaving(true);
    setError(undefined);
    try {
      localStorage.setItem(LS_KEY, apiKey.trim());
      localStorage.setItem(LS_NAME, apiName.trim());
      setTestMsg('已保存到本地浏览器');
    } catch (e) {
      setError('保存失败：浏览器不支持或存储受限');
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setTestMsg(undefined);
    setError(undefined);
    try {
      const res = await axios.post('/api/ai/test', { apiKey: apiKey.trim() });
      if (res.data?.ok) setTestMsg(res.data?.message || '测试通过');
      else setError(res.data?.message || res.data?.error || '测试失败');
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || '请求失败');
    } finally {
      setTesting(false);
    }
  };

  const onFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files && ev.target.files[0];
    setFile(f || null);
    setPreview('');
    setError(undefined);
  };

  const onReadDoc = async () => {
    if (!file) {
      setError('请先选择 .docx 文件');
      return;
    }
    setReading(true);
    setError(undefined);
    setPreview('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await axios.post('/api/ai/read-doc', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        maxBodyLength: 20 * 1024 * 1024,
      });
      const text: string = res.data?.text || '';
      setPreview(text.slice(0, 1200));
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || '读取失败');
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="ai-settings">
      <button className="btn" onClick={() => setOpen(true)}>
        AI 设置{apiKey ? `（${apiName || '已配置'}）` : ''}
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>AI 设置</h3>

            <div className="form-row">
              <label>名称（自定义）</label>
              <input
                value={apiName}
                onChange={e => setApiName(e.target.value)}
                placeholder="给这组 API 配置一个名字"
              />
            </div>
            <div className="form-row">
              <label>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="粘贴你的 API Key"
              />
            </div>
            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn secondary" onClick={() => setOpen(false)}>关闭</button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" disabled={saving} onClick={onSave}>保存</button>
                <button className="btn primary" disabled={testing || !apiKey.trim()} onClick={onTest}>
                  {testing ? '测试中…' : '测试 API Key'}
                </button>
              </div>
            </div>

            <hr style={{ margin: '14px 0', border: 0, borderTop: '1px solid #eee' }} />
            <div className="form-row">
              <label>读取 Word 文档（支持 .docx，.doc 暂不支持）</label>
              <input type="file" accept=".docx,.doc" onChange={onFileChange} />
            </div>
            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn primary" disabled={reading || !file} onClick={onReadDoc}>
                {reading ? '读取中…' : '读取文档测试'}
              </button>
            </div>
            {(error || testMsg) && (
              <div style={{ marginTop: 8, fontSize: 13, color: error ? '#b91c1c' : '#065f46' }}>
                {error || testMsg}
              </div>
            )}
            {preview && (
              <div className="doc-preview">
                <div className="doc-preview-title">文本预览</div>
                <div className="doc-preview-box">{preview}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AiSettings;
