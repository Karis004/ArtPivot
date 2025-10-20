/// <reference path="./types/ambient.d.ts" />
import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cloudinaryLib from 'cloudinary';

import ArtPeriod from './models/ArtPeriod';
import Artwork from './models/Artwork';
import AIHistory from './models/AIHistory';

import crypto from 'crypto';

dotenv.config();
const cloudinary = cloudinaryLib.v2;

const app = express();
const PORT = 5001;
const MONGO_URI = process.env.MONGODB_URI as string | undefined;

function withDefaultDb(uri?: string, defaultDb = 'ArtPivot') {
  if (!uri) return uri;
  const [base, query] = uri.split('?');
  const schemeIdx = base.indexOf('://');
  const afterScheme = schemeIdx >= 0 ? schemeIdx + 3 : 0;
  const firstSlash = base.indexOf('/', afterScheme);
  if (firstSlash < 0) return base + '/' + defaultDb + (query ? '?' + query : '');
  if (firstSlash === base.length - 1) return base + defaultDb + (query ? '?' + query : '');
  const pathPart = base.slice(firstSlash + 1);
  if (!pathPart) return base + defaultDb + (query ? '?' + query : '');
  return uri;
}

if (!MONGO_URI) {
  console.warn('[WARN] 未检测到 MONGODB_URI 环境变量，Mongo 连接将被跳过');
} else {
  const effectiveUri = withDefaultDb(MONGO_URI, 'ArtPivot') as string;
  mongoose
    .connect(effectiveUri, { serverSelectionTimeoutMS: 20000 })
    .then(() =>
      console.log(
        '[DB] MongoDB 已连接 ->',
        effectiveUri.replace(/(:)([^:@/]+)(@)/, (_, a, b, c) => a + '***' + c)
      )
    )
    .catch((err) => console.error('[DB] 连接失败:', err.message));
}

app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function hashText(text?: string) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

app.get('/api/hello', (req: Request, res: Response) => {
  res.json({ message: '你好！这是来自后端的响应', timestamp: new Date().toLocaleString() });
});

app.post('/api/send-data', (req: Request, res: Response) => {
  const { userInput } = req.body as { userInput?: string };
  res.json({
    message: `后端收到了你的消息：${userInput}`,
    processedData: userInput ? userInput.toUpperCase() : '没有数据',
  });
});

app.post('/api/ai/test', async (req: Request, res: Response) => {
  try {
    const { apiKey } = (req.body || {}) as { apiKey?: string };
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ ok: false, error: '缺少 apiKey' });
    }
    const isLikelyValid = apiKey.trim().length > 20;
    return res.json({ ok: isLikelyValid, message: isLikelyValid ? 'API Key 形式看起来有效' : 'API Key 可能无效' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: '服务器错误' });
  }
});

app.post('/api/upload/image', upload.single('file'), async (req: Request, res: Response) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ ok: false, error: '未收到文件' });
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      fs.unlinkSync(file.path);
    } catch {}
    return res.status(500).json({ ok: false, error: '后端未配置 Cloudinary 环境变量' });
  }
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'artpivot',
      resource_type: 'image',
    });
    return res.json({ ok: true, url: result.secure_url });
  } catch (e: any) {
    console.error('Cloudinary 上传失败:', e?.message || e);
    return res.status(500).json({ ok: false, error: '上传失败' });
  } finally {
    try {
      fs.unlinkSync(file.path);
    } catch {}
  }
});

app.post('/api/ai/read-doc', upload.single('file'), async (req: Request, res: Response) => {
  const file = (req as any).file as Express.Multer.File | undefined;
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
    try {
      fs.unlinkSync(file.path);
    } catch {}
  }
});

function extractImagesBlock(text?: string) {
  if (!text) return null;
  const idx = text.indexOf('IMAGES:');
  if (idx === -1) return null;
  const rest = text.slice(idx + 'IMAGES:'.length);
  const m = rest.match(/\n[A-Z][A-Z \-()&]*:\s*/m);
  const block = m ? rest.slice(0, m.index) : rest;
  return block.trim();
}

function parseYearFromText(str?: string): number | null {
  if (!str) return null;
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

function parseYearCore(str?: string): number | null {
  const s = String(str || '');
  const eraBC = /(B\.C\.|BC)/i.test(s);
  const eraAD = /(A\.D\.|AD)/i.test(s);
  let m = s.match(/c?\.?\s*(\d{2,4})\s*[-–—]\s*(\d{2,4}).{0,10}(B\.C\.|A\.D\.|BC|AD)?/i);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const era = m[3] ? m[3].toUpperCase() : (eraBC ? 'B.C.' : (eraAD ? 'A.D.' : null));
    const mid = Math.round((a + b) / 2);
    if (era === 'B.C.' || era === 'BC') return -mid;
    return mid;
  }
  m = s.match(/c?\.?\s*(\d{2,4}).{0,10}(B\.C\.|A\.D\.|BC|AD)/i);
  if (m) {
    const y = parseInt(m[1], 10);
    const era = m[2].toUpperCase();
    return era === 'B.C.' || era === 'BC' ? -y : y;
  }
  m = s.match(/(\d{1,2})(st|nd|rd|th)\s*c\.?\s*(B\.C\.|A\.D\.|BC|AD)/i);
  if (m) {
    const c = parseInt(m[1], 10);
    const era = m[3].toUpperCase();
    const mid = c * 100 - 50;
    return era === 'B.C.' || era === 'BC' ? -mid : mid;
  }
  return null;
}

function parseArtworksFromImages(imagesText: string) {
  const lines = imagesText.split(/\r?\n/);
  const items: { main: string; notes: string[] }[] = [];
  let current: { main: string; notes: string[] } | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const numMatch = line.match(/^\d+\.?\s*(.+)$/);
    if (numMatch) {
      if (current) items.push(current);
      current = { main: numMatch[1], notes: [] };
      continue;
    }
    const noteMatch = raw.match(/^\s*[-–—]\s*(.+)$/);
    if (noteMatch && current) {
      current.notes.push(noteMatch[1].trim());
    }
  }
  if (current) items.push(current);

  function guessArtistAndTitle(parts: string[]) {
    const candidate = parts[0] || '';
    const second = parts[1] || '';
    const lower = candidate.toLowerCase();
    if (lower === 'anonymous' || lower === 'anon' || lower === 'unknown') {
      return { artist: 'anonymous', title: second || '' };
    }
    if (/(and|&)/i.test(candidate) || /\([^)]+\)/.test(candidate)) {
      return { artist: candidate, title: second || '' };
    }
    const objectHints = ['palace', 'temple', 'statue', 'group of sculptures', 'Jar', 'Fresco', 'Kouros', 'amphora', 'krater', 'Birth', 'Lapiths', 'Centaurs'];
    const hit = objectHints.some((h) => candidate.toLowerCase().includes(h.toLowerCase()));
    if (hit) {
      return { artist: 'anonymous', title: candidate };
    }
    const materialGeoHints = ['marble', 'bronze', 'terracotta', 'fresco', 'Athens', 'Crete', 'Thera', 'island', 'painting'];
    const secHit = materialGeoHints.some((h) => second.toLowerCase().includes(h.toLowerCase()));
    if (secHit) {
      return { artist: 'anonymous', title: candidate };
    }
    return { artist: candidate, title: second || '' };
  }

  const artworks = items.map((it) => {
    const main = it.main;
    const parts = main.split(',').map((s) => s.trim()).filter(Boolean);
    const { artist, title } = guessArtistAndTitle(parts);
    const year = parseYearFromText(main);
    const description = it.notes.join(' ');
    return {
      title,
      artist,
      year: typeof year === 'number' ? year : (null as number | null),
      imageUrl: '',
      description,
    };
  });

  return artworks.filter((a) => a.title && a.artist);
}

app.post('/api/ai/extract', async (req: Request, res: Response) => {
  try {
    const { apiKey, text, model, baseUrl, filename } = (req.body || {}) as {
      apiKey?: string;
      text?: string;
      model?: string;
      baseUrl?: string;
      filename?: string;
    };
    if (!text) return res.status(400).json({ ok: false, error: '缺少 text' });
    const hash = hashText(text);

    const imagesBlock = extractImagesBlock(text);
    if (imagesBlock) {
      const artworks = parseArtworksFromImages(imagesBlock);
      if (artworks && artworks.length) {
        const filled = artworks.map((a) => ({
          ...a,
          year: typeof a.year === 'number' ? a.year : 0,
        }));
        try {
          await AIHistory.create({ filename: filename || '未命名' });
        } catch {}
        return res.json({ ok: true, periods: [], artworks: filled });
      }
    }

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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );

    const content = (resp as any).data?.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }
    const artworks = Array.isArray(parsed.artworks) ? parsed.artworks : [];
    try {
      await AIHistory.create({ filename: filename || '未命名' });
    } catch {}
    return res.json({ ok: true, periods: [], artworks });
  } catch (e: any) {
    console.error(e?.response?.data || e.message || e);
    return res.status(500).json({ ok: false, error: 'AI 提取失败' });
  }
});

app.get('/api/ai/history', async (_req: Request, res: Response) => {
  try {
    const list = await AIHistory.find({}, { filename: 1, createdAt: 1 }).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, list });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: '获取历史失败' });
  }
});

app.get('/api/periods', async (_req: Request, res: Response) => {
  const list = await ArtPeriod.find().sort({ startYear: 1 });
  res.json({ ok: true, list });
});
app.post('/api/periods', async (req: Request, res: Response) => {
  const p = await ArtPeriod.create(req.body);
  res.json({ ok: true, item: p });
});
app.put('/api/periods/:id', async (req: Request, res: Response) => {
  const p = await ArtPeriod.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!p) return res.status(404).json({ ok: false, error: 'not found' });
  res.json({ ok: true, item: p });
});
app.delete('/api/periods/:id', async (req: Request, res: Response) => {
  await ArtPeriod.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

app.get('/api/artworks', async (_req: Request, res: Response) => {
  const list = await Artwork.find().sort({ year: 1 });
  res.json({ ok: true, list });
});
app.post('/api/artworks', async (req: Request, res: Response) => {
  const a = await Artwork.create(req.body);
  res.json({ ok: true, item: a });
});
app.put('/api/artworks/:id', async (req: Request, res: Response) => {
  const a = await Artwork.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!a) return res.status(404).json({ ok: false, error: 'not found' });
  res.json({ ok: true, item: a });
});
app.delete('/api/artworks/:id', async (req: Request, res: Response) => {
  await Artwork.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

async function seedHandler(_req: Request, res: Response) {
  try {
    const periodsSeed = [
      { name: '文艺复兴', startYear: 1400, endYear: 1600, color: '#ff6b6b', description: '欧洲文化复兴，人文主义兴起' },
      { name: '巴洛克', startYear: 1605, endYear: 1750, color: '#4ecdc4', description: '豪华夸张的艺术风格' },
      { name: '印象派', startYear: 1870, endYear: 1900, color: '#45b7d1', description: '注重光影变化的画派' },
    ];
    const periodDocs: any[] = [];
    for (const p of periodsSeed) {
      let doc = await ArtPeriod.findOne({ name: p.name });
      if (!doc) doc = await ArtPeriod.create(p);
      periodDocs.push(doc);
    }
    const map = new Map(periodDocs.map((p: any) => [p.name, p._id] as const));
    const artworksSeed = [
      { title: '蒙娜丽莎', artist: '达芬奇', year: 1503, imageUrl: '', description: '文艺复兴时期肖像画杰作', periodId: map.get('文艺复兴') },
      { title: '夜巡', artist: '伦勃朗', year: 1642, imageUrl: '', description: '巴洛克时期群体肖像画', periodId: map.get('巴洛克') },
      { title: '印象·日出', artist: '莫奈', year: 1872, imageUrl: '', description: '印象派命名之作', periodId: map.get('印象派') },
    ];
    let inserted = 0;
    for (const a of artworksSeed) {
      const exist = await Artwork.findOne({ title: a.title, artist: a.artist, year: a.year });
      if (!exist) {
        await Artwork.create(a as any);
        inserted++;
      }
    }
    res.json({ ok: true, periods: periodDocs.length, artworksInserted: inserted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'seed 失败' });
  }
}
app.post('/api/seed', seedHandler);
app.get('/api/seed', seedHandler);

app.listen(PORT, () => {
  console.log(`后端服务器运行在 http://localhost:${PORT}`);
});
