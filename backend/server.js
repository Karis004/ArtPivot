const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');
const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Models
const ArtPeriod = require('./models/ArtPeriod');
const Artwork = require('./models/Artwork');
const AIHistory = require('./models/AIHistory');

const app = express();
const PORT = 5001;
const MONGO_URI = process.env.MONGODB_URI; // 请在 .env 中配置

function withDefaultDb(uri, defaultDb = 'ArtPivot') {
  if (!uri) return uri;
  // 拆分查询串
  const [base, query] = uri.split('?');
  const schemeIdx = base.indexOf('://');
  const afterScheme = schemeIdx >= 0 ? schemeIdx + 3 : 0;
  const firstSlash = base.indexOf('/', afterScheme);
  // 情况1：没有任何路径（无 '/dbname'）
  if (firstSlash < 0) return base + '/' + defaultDb + (query ? '?' + query : '');
  // 情况2：有 '/' 但位于末尾（形如 '...mongodb.net/'）
  if (firstSlash === base.length - 1) return base + defaultDb + (query ? '?' + query : '');
  // 情况3：有 '/something'，说明已带数据库名
  const pathPart = base.slice(firstSlash + 1);
  if (!pathPart) return base + defaultDb + (query ? '?' + query : '');
  return uri; // 已包含 db
}

// Mongo 连接
if (!MONGO_URI) {
  console.warn('[WARN] 未检测到 MONGODB_URI 环境变量，Mongo 连接将被跳过');
} else {
  const effectiveUri = withDefaultDb(MONGO_URI, 'ArtPivot');
  mongoose.connect(effectiveUri, { serverSelectionTimeoutMS: 20000 })
    .then(() => console.log('[DB] MongoDB 已连接 ->', effectiveUri.replace(/(:)([^:@/]+)(@)/, (_, a, b, c) => a + '***' + c)))
    .catch(err => console.error('[DB] 连接失败:', err.message));
}

// 中间件
app.use(cors());
app.use(express.json());

// 简单的磁盘存储到临时目录
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// Cloudinary 配置（可选）
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// 历史改用 MongoDB 集合 AI-History，仅保存 { filename, createdAt }

function hashText(text) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

// GET请求处理
app.get('/api/hello', (req, res) => {
  res.json({ 
    message: '你好！这是来自后端的响应', 
    timestamp: new Date().toLocaleString()
  });
});

// POST请求处理
app.post('/api/send-data', (req, res) => {
  const { userInput } = req.body;
  
  res.json({
    message: `后端收到了你的消息：${userInput}`,
    processedData: userInput ? userInput.toUpperCase() : '没有数据'
  });
});

// ——— AI 相关 ———
// 仅做基础校验：检查 key 形状与是否非空；可扩展为真实的上游 API 调用
app.post('/api/ai/test', async (req, res) => {
  try {
    const { apiKey } = req.body || {};
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ ok: false, error: '缺少 apiKey' });
    }
    // 基础校验示例：长度与前缀（根据具体供应商调整）
    const isLikelyValid = apiKey.trim().length > 20; // 简单示例
    return res.json({ ok: isLikelyValid, message: isLikelyValid ? 'API Key 形式看起来有效' : 'API Key 可能无效' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: '服务器错误' });
  }
});

// 图片上传到图床（Cloudinary）
app.post('/api/upload/image', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ ok: false, error: '未收到文件' });
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    try { fs.unlinkSync(file.path); } catch (_) {}
    return res.status(500).json({ ok: false, error: '后端未配置 Cloudinary 环境变量' });
  }
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'artpivot',
      resource_type: 'image'
    });
    return res.json({ ok: true, url: result.secure_url });
  } catch (e) {
    console.error('Cloudinary 上传失败:', e?.message || e);
    return res.status(500).json({ ok: false, error: '上传失败' });
  } finally {
    try { fs.unlinkSync(file.path); } catch (_) {}
  }
});

// 上传并读取 doc/docx（使用 mammoth 读取 docx 文本，doc 将返回不支持）
app.post('/api/ai/read-doc', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ ok: false, error: '未收到文件' });
  }
  try {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: file.path });
      return res.json({ ok: true, text: result.value || '' });
    } else if (ext === '.doc') {
      const extractor = new WordExtractor();
      const doc = await extractor.extract(file.path);
      const text = doc.getBody() || '';
      return res.json({ ok: true, text });
    } else {
      return res.status(415).json({ ok: false, error: '仅支持 .docx 文件' });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: '解析文件失败' });
  } finally {
    // 清理临时文件
    try { fs.unlinkSync(file.path); } catch (_) {}
  }
});

// —— 工具：从文本中提取 IMAGES 段落 ——
function extractImagesBlock(text) {
  if (!text) return null;
  const idx = text.indexOf('IMAGES:');
  if (idx === -1) return null;
  const rest = text.slice(idx + 'IMAGES:'.length);
  // 以下一段全大写标题结尾（如 IMPORTANT FACTS:）
  const m = rest.match(/\n[A-Z][A-Z \-()&]*:\s*/m);
  const block = m ? rest.slice(0, m.index) : rest;
  return block.trim();
}

// —— 工具：年份解析 ——
function parseYearFromText(str) {
  if (!str) return null;
  // 优先解析括号中的原作时间（例如 Roman copy (...) of a Greek original (c.450-440 B.C.)）
  const parenMatches = str.match(/\(([^)]+)\)/g);
  if (parenMatches) {
    for (const seg of parenMatches) {
      const inner = seg.slice(1, -1);
      const y = parseYearCore(inner);
      if (typeof y === 'number') return y;
    }
  }
  return parseYearCore(str);
}

function parseYearCore(str) {
  const s = String(str);
  const eraBC = /(B\.C\.|BC)/i.test(s);
  const eraAD = /(A\.D\.|AD)/i.test(s);
  // 区间：1234-1200 B.C.
  let m = s.match(/c?\.?\s*(\d{2,4})\s*[-–—]\s*(\d{2,4}).{0,10}(B\.C\.|A\.D\.|BC|AD)?/i);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const era = m[3] ? m[3].toUpperCase() : (eraBC ? 'B.C.' : (eraAD ? 'A.D.' : null));
    const mid = Math.round((a + b) / 2);
    if (era === 'B.C.' || era === 'BC') return -mid;
    return mid;
  }
  // 单一年份：c.450 B.C.
  m = s.match(/c?\.?\s*(\d{2,4}).{0,10}(B\.C\.|A\.D\.|BC|AD)/i);
  if (m) {
    const y = parseInt(m[1], 10);
    const era = m[2].toUpperCase();
    return (era === 'B.C.' || era === 'BC') ? -y : y;
  }
  // 世纪：16th c. B.C. / 1st c. A.D.
  m = s.match(/(\d{1,2})(st|nd|rd|th)\s*c\.?\s*(B\.C\.|A\.D\.|BC|AD)/i);
  if (m) {
    const c = parseInt(m[1], 10);
    const era = m[3].toUpperCase();
    const mid = c * 100 - 50; // 中位近似
    return (era === 'B.C.' || era === 'BC') ? -mid : mid;
  }
  return null;
}

// —— 工具：解析 IMAGES 段落为 artworks ——
function parseArtworksFromImages(imagesText) {
  const lines = imagesText.split(/\r?\n/);
  const items = [];
  let current = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const numMatch = line.match(/^\d+\.?\s*(.+)$/);
    if (numMatch) {
      // 推入上一个
      if (current) items.push(current);
      current = { main: numMatch[1], notes: [] };
      continue;
    }
    // 子弹说明
    const noteMatch = raw.match(/^\s*[-–—]\s*(.+)$/);
    if (noteMatch && current) {
      current.notes.push(noteMatch[1].trim());
    }
  }
  if (current) items.push(current);

  function guessArtistAndTitle(parts) {
    const candidate = parts[0] || '';
    const second = parts[1] || '';
    const lower = candidate.toLowerCase();
    // 明确匿名
    if (lower === 'anonymous' || lower === 'anon' || lower === 'unknown') {
      return { artist: 'anonymous', title: second || '' };
    }
    // 名字 + and + 名字 / 含括号的名字
    if (/\b(and|&)\b/i.test(candidate) || /\([^)]+\)/.test(candidate)) {
      return { artist: candidate, title: second || '' };
    }
    // 常见作品/建筑名词触发作为标题（而非艺术家）
    const objectHints = ['palace', 'temple', 'statue', 'group of sculptures', 'Jar', 'Fresco', 'Kouros', 'amphora', 'krater', 'Birth', 'Lapiths', 'Centaurs'];
    const hit = objectHints.some(h => candidate.toLowerCase().includes(h.toLowerCase()));
    if (hit) {
      return { artist: 'anonymous', title: candidate };
    }
    // 若第二段明显为地名/材质，第一段多半是标题
    const materialGeoHints = ['marble', 'bronze', 'terracotta', 'fresco', 'Athens', 'Crete', 'Thera', 'island', 'painting'];
    const secHit = materialGeoHints.some(h => second.toLowerCase().includes(h.toLowerCase()));
    if (secHit) {
      return { artist: 'anonymous', title: candidate };
    }
    // 默认：第一段为艺术家，第二段为标题
    return { artist: candidate, title: second || '' };
  }

  const artworks = items.map(it => {
    const main = it.main;
    const parts = main.split(',').map(s => s.trim()).filter(Boolean);
    const { artist, title } = guessArtistAndTitle(parts);
    const year = parseYearFromText(main);
    const description = it.notes.join(' ');
    return {
      title,
      artist,
      year: typeof year === 'number' ? year : null,
      imageUrl: '',
      description
    };
  });

  // 过滤无标题或无作者的项；允许缺少年份（前端可再兜底）
  return artworks.filter(a => a.title && a.artist);
}

/**
 * 解析文档文本并从 AI 提取结构化数据
 * body: { apiKey?: string, text: string, model?: string, baseUrl?: string }
 * 返回: { ok: boolean, periods: [], artworks: [...] }
 */
app.post('/api/ai/extract', async (req, res) => {
  try {
    const { apiKey, text, model, baseUrl, filename } = req.body || {};
    if (!text) return res.status(400).json({ ok: false, error: '缺少 text' });
    const hash = hashText(text);

    // 1) 优先本地解析 IMAGES 段，避免 AI 失败
    const imagesBlock = extractImagesBlock(text);
    if (imagesBlock) {
      const artworks = parseArtworksFromImages(imagesBlock);
      if (artworks && artworks.length) {
        // 尝试为缺少年份的作品填充一个近似（避免前端丢弃）
        const filled = artworks.map(a => ({
          ...a,
          year: typeof a.year === 'number' ? a.year : 0
        }));
        // 仅保存历史的文件名与时间
        try {
          await AIHistory.create({ filename: filename || '未命名' });
        } catch (_) {}
        return res.json({ ok: true, periods: [], artworks: filled });
      }
    }

    // 2) 若无 IMAGES 段或解析为空，回退到 AI 抽取（仅 artworks）
    if (!apiKey) return res.status(400).json({ ok: false, error: '缺少 apiKey（AI 回退需要）' });
    const endpoint = (baseUrl || 'https://api.openai.com/v1') + '/chat/completions';
    const usedModel = model || 'gpt-4o-mini';

    const systemPrompt = `你是一名信息抽取助手。只需要从文档中的“IMAGES:”段落提取艺术作品信息，并严格输出以下 JSON（不要包含多余文字，也不要输出 periods）：
{
  "artworks": [
    {
      "title": string,
      "artist": string,
      "year": number, // 若出现区间或世纪，请给出合理的中位年份（B.C. 用负数）
      "imageUrl": string, // 文档无链接则留空字符串
      "description": string // 可使用条目下的子弹备注进行简要中文描述
    }
  ]
}
规则：
- 仅解析“IMAGES:”段落中的编号条目；忽略其他段落。
- 年份规范：B.C. 为负数，A.D. 为正数；区间取中值；如“1st c. A.D.”取 50；“16th c. B.C.”取 -1550；带 c. 视为约数即可。
- 如果标题或作者缺失，则跳过该作品。`;

    const userPrompt = `文档内容如下（UTF-8 文本）：\n\n${text}`;

    const resp = await axios.post(
      endpoint,
      {
        model: usedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        timeout: 60000
      }
    );

    const content = resp.data?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const artworks = Array.isArray(parsed.artworks) ? parsed.artworks : [];
    try {
      await AIHistory.create({ filename: filename || '未命名' });
    } catch (_) {}
    return res.json({ ok: true, periods: [], artworks });
  } catch (e) {
    console.error(e?.response?.data || e.message || e);
    return res.status(500).json({ ok: false, error: 'AI 提取失败' });
  }
});

// 历史列表（仅返回文件名与时间，按时间倒序）
app.get('/api/ai/history', async (req, res) => {
  try {
    const list = await AIHistory.find({}, { filename: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ ok: true, list });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: '获取历史失败' });
  }
});

// 新：将 artworks 批量保存到 Mongo（去重：title+artist+year）
// 已移除 /api/ai/save-sample（改为前端直接走 CRUD 创建）

// 基础 CRUD —— ArtPeriods
app.get('/api/periods', async (req, res) => {
  const list = await ArtPeriod.find().sort({ startYear: 1 });
  res.json({ ok: true, list });
});
app.post('/api/periods', async (req, res) => {
  const p = await ArtPeriod.create(req.body);
  res.json({ ok: true, item: p });
});
app.put('/api/periods/:id', async (req, res) => {
  const p = await ArtPeriod.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!p) return res.status(404).json({ ok: false, error: 'not found' });
  res.json({ ok: true, item: p });
});
app.delete('/api/periods/:id', async (req, res) => {
  await ArtPeriod.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// 基础 CRUD —— Artworks
app.get('/api/artworks', async (req, res) => {
  const list = await Artwork.find().sort({ year: 1 });
  res.json({ ok: true, list });
});
app.post('/api/artworks', async (req, res) => {
  const a = await Artwork.create(req.body);
  res.json({ ok: true, item: a });
});
app.put('/api/artworks/:id', async (req, res) => {
  const a = await Artwork.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!a) return res.status(404).json({ ok: false, error: 'not found' });
  res.json({ ok: true, item: a });
});
app.delete('/api/artworks/:id', async (req, res) => {
  await Artwork.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// 一次性种子：选部分 sample 数据写入 Mongo（幂等）
async function seedHandler(req, res) {
  try {
    const periodsSeed = [
      { name: '文艺复兴', startYear: 1400, endYear: 1600, color: '#ff6b6b', description: '欧洲文化复兴，人文主义兴起' },
      { name: '巴洛克', startYear: 1605, endYear: 1750, color: '#4ecdc4', description: '豪华夸张的艺术风格' },
      { name: '印象派', startYear: 1870, endYear: 1900, color: '#45b7d1', description: '注重光影变化的画派' }
    ];
    const periodDocs = [];
    for (const p of periodsSeed) {
      let doc = await ArtPeriod.findOne({ name: p.name });
      if (!doc) doc = await ArtPeriod.create(p);
      periodDocs.push(doc);
    }
    const map = new Map(periodDocs.map(p => [p.name, p._id]));
    const artworksSeed = [
      { title: '蒙娜丽莎', artist: '达芬奇', year: 1503, imageUrl: '', description: '文艺复兴时期肖像画杰作', periodId: map.get('文艺复兴') },
      { title: '夜巡', artist: '伦勃朗', year: 1642, imageUrl: '', description: '巴洛克时期群体肖像画', periodId: map.get('巴洛克') },
      { title: '印象·日出', artist: '莫奈', year: 1872, imageUrl: '', description: '印象派命名之作', periodId: map.get('印象派') }
    ];
    let inserted = 0;
    for (const a of artworksSeed) {
      const exist = await Artwork.findOne({ title: a.title, artist: a.artist, year: a.year });
      if (!exist) { await Artwork.create(a); inserted++; }
    }
    res.json({ ok: true, periods: periodDocs.length, artworksInserted: inserted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'seed 失败' });
  }
}
app.post('/api/seed', seedHandler);
app.get('/api/seed', seedHandler);

// 移除旧版 /api/edit/* 接口（全部改用 RESTful CRUD /api/periods 与 /api/artworks）

app.listen(PORT, () => {
  console.log(`后端服务器运行在 http://localhost:${PORT}`);
});
