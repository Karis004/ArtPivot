import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AddControls.css';
import './AiSettings.css';

const LS_KEY = 'ai.apiKey';
const LS_NAME = 'ai.apiName';
const LS_MODEL = 'ai.model';
const LS_BASE_URL = 'ai.baseUrl';

interface Props {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const AiSettings: React.FC<Props> = ({ open, setOpen }) => {
  const [apiKey, setApiKey] = useState('');
  const [apiName, setApiName] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
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
    const savedModel = localStorage.getItem(LS_MODEL) || '';
    setModel(savedModel);
    const savedBaseUrl = localStorage.getItem(LS_BASE_URL) || '';
    setBaseUrl(savedBaseUrl);
  }, []);

  // 名称用于展示，Key 不再显示明文或掩码

  const onSave = () => {
    setSaving(true);
    setError(undefined);
    try {
      localStorage.setItem(LS_KEY, apiKey.trim());
      localStorage.setItem(LS_NAME, apiName.trim());
      localStorage.setItem(LS_MODEL, model.trim());
      localStorage.setItem(LS_BASE_URL, baseUrl.trim());
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
      const payload: any = { apiKey: apiKey.trim() };
      if (model.trim()) payload.model = model.trim();
      if (baseUrl.trim()) payload.baseUrl = baseUrl.trim();
      
      const res = await axios.post('/api/ai/test', payload);
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
    <div className="ai-settings-modal-container">
      {/* Button moved to App header menu */}

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
              <label>Base URL（完整API端点）</label>
              <input
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1/chat/completions"
              />
              <small style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                填写完整的 API 端点 URL（包含 /chat/completions）<br/>
                OpenAI: https://api.openai.com/v1/chat/completions<br/>
                ModelScope: https://api-inference.modelscope.cn/v1/chat/completions
              </small>
            </div>
            <div className="form-row">
              <label>Model Name（模型名称）</label>
              <input
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="gpt-4o-mini"
              />
              <small style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                填写模型名称，留空使用 gpt-4o-mini
              </small>
            </div>
            <div className="form-row">
              <label>API Key (Token)</label>
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
