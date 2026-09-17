const axios = require('axios');
const path = require('path');
const { jsonrepair } = require('jsonrepair');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * Gemini Service for Generation 3.x+ Models Only
 * Strict Policy: Only gemini-3.5-flash-lite, gemini-3.6-flash, gemini-3.5-flash, gemini-3.7-flash, gemini-3.8-flash
 * Multi-Key Rotation + Intelligent Model Fallback + Auto JSON Repair
 */
class GeminiService {
  constructor() {
    this.reloadKeys();
    // Strict Gen 3.x+ Hierarchy
    this.gen3Models = [
      'gemini-3.5-flash-lite', // Primary workhorse (highest free tier quota & fastest speed)
      'gemini-3.6-flash',      // Latest balanced model
      'gemini-3.5-flash',      // High capability fallback
      'gemini-3.7-flash',      // Advanced fallback
      'gemini-3.8-flash'       // Cutting-edge fallback
    ];
    this.defaultModel = process.env.DEFAULT_MODEL || 'gemini-3.5-flash-lite';
  }

  reloadKeys() {
    const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    this.geminiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
    this.currentKeyIndex = 0;
  }

  getCurrentKey() {
    if (this.geminiKeys.length === 0) {
      this.reloadKeys();
    }
    if (this.geminiKeys.length === 0) {
      throw new Error('Chưa cấu hình GEMINI_API_KEYS trong file .env hoặc GitHub Secrets.');
    }
    return this.geminiKeys[this.currentKeyIndex % this.geminiKeys.length];
  }

  rotateKey() {
    if (this.geminiKeys.length > 1) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.geminiKeys.length;
      console.log(`[Gemini 3.x Engine] Chuyển sang API Key index #${this.currentKeyIndex + 1}/${this.geminiKeys.length}`);
    }
  }

  cleanJsonString(raw) {
    if (!raw) return '{}';
    let str = raw.trim();

    // 1. Strip markdown fences
    str = str.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
    str = str.replace(/\s*```$/i, '').trim();

    // 2. Balanced brace extractor to find exact boundaries of root object/array
    const firstBrace = str.indexOf('{');
    const firstBracket = str.indexOf('[');

    let startIdx = -1;
    let isObject = true;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      isObject = true;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      isObject = false;
    }

    if (startIdx === -1) {
      return str.trim();
    }

    const openChar = isObject ? '{' : '[';
    const closeChar = isObject ? '}' : ']';

    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let endIdx = -1;

    for (let i = startIdx; i < str.length; i++) {
      const char = str[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === openChar) {
          depth++;
        } else if (char === closeChar) {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
    }

    if (endIdx !== -1) {
      return str.slice(startIdx, endIdx + 1).trim();
    }

    return str.slice(startIdx).trim();
  }

  safeJsonParse(raw) {
    if (typeof raw === 'object' && raw !== null) return raw;
    const cleaned = this.cleanJsonString(raw);

    // Layer 1: Native parse
    try {
      return JSON.parse(cleaned);
    } catch (err1) {
      // Layer 2: jsonrepair (auto-fixes unescaped quotes, trailing commas, minus signs, comments)
      try {
        const repaired = jsonrepair(cleaned);
        return JSON.parse(repaired);
      } catch (err2) {
        // Layer 3: Clean control characters and retry jsonrepair
        try {
          const sanitized = cleaned
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
            .replace(/,\s*([\]}])/g, '$1');
          const repaired2 = jsonrepair(sanitized);
          return JSON.parse(repaired2);
        } catch (err3) {
          console.error('[Gemini 3.x Engine] Parse JSON thất bại sau các bước tự sửa chữa. Lỗi:', err1.message);
          console.error('[Gemini 3.x Engine] Đoạn dữ liệu lỗi:', cleaned.slice(0, 300));
          throw new Error('Dữ liệu AI trả về không thể parse thành JSON: ' + err1.message);
        }
      }
    }
  }

  cleanMarkdownOrHtml(raw) {
    if (!raw) return '';
    let str = raw.trim();
    if (str.startsWith('```html')) {
      str = str.replace(/^```html\s*/, '').replace(/\s*```$/, '');
    } else if (str.startsWith('```markdown')) {
      str = str.replace(/^```markdown\s*/, '').replace(/\s*```$/, '');
    } else if (str.startsWith('```')) {
      str = str.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return str.trim();
  }

  async generate({
    prompt,
    systemInstruction = '',
    tools = null,
    isJson = false,
    model = null,
    temperature = 0.7,
    maxTokens = 8192
  }) {
    // Only Gen 3.x models allowed
    let modelsToTry = [...this.gen3Models];
    if (model && this.gen3Models.includes(model)) {
      modelsToTry = [model, ...this.gen3Models.filter(m => m !== model)];
    }

    let lastError = null;

    // Loop through 3.x models
    for (const activeModel of modelsToTry) {
      // For each model, try each available key
      for (let k = 0; k < Math.max(this.geminiKeys.length, 1); k++) {
        const key = this.getCurrentKey();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${key}`;

        const contents = [{ role: 'user', parts: [{ text: prompt }] }];
        const generationConfig = {
          temperature,
          maxOutputTokens: maxTokens
        };
        if (isJson) {
          generationConfig.responseMimeType = 'application/json';
        }

        const payload = { contents, generationConfig };
        if (systemInstruction) {
          payload.systemInstruction = { parts: [{ text: systemInstruction }] };
        }
        if (tools && Array.isArray(tools) && tools.length > 0) {
          payload.tools = tools;
        }

        try {
          const res = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 90000
          });

          const candidate = res.data?.candidates?.[0];
          const text = candidate?.content?.parts?.[0]?.text;
          const groundingMetadata = candidate?.groundingMetadata;

          if (!text) {
            throw new Error('Gemini không trả về nội dung.');
          }

          return {
            text,
            groundingMetadata,
            modelUsed: activeModel
          };
        } catch (err) {
          lastError = err;
          const statusCode = err.response?.status;
          const errMsg = err.response?.data?.error?.message || err.message;

          console.warn(`[Gemini 3.x Engine] ${activeModel} (Key #${this.currentKeyIndex + 1}) lỗi: ${errMsg.slice(0, 100)}`);

          // Rate limit / Quota -> rotate to next key immediately
          if (statusCode === 429) {
            this.rotateKey();
            await new Promise(r => setTimeout(r, 1200));
            continue;
          }

          // Service unavailable (503) or overloaded -> switch to next 3.x model
          if (statusCode === 503 || statusCode === 404) {
            console.log(`[Gemini 3.x Engine] Chuyển từ ${activeModel} sang model 3.x kế tiếp...`);
            break; // Break key loop, move to next model
          }

          // If tools cause quota limit, propagate so fallback can handle
          if (tools && (statusCode === 400 || statusCode === 429 || errMsg.includes('quota'))) {
            throw err;
          }

          this.rotateKey();
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    const finalMsg = lastError?.response?.data?.error?.message || lastError?.message || 'Tất cả model Gemini 3.x đều bận hoặc hết hạn ngạch.';
    throw new Error(`Gemini 3.x Error: ${finalMsg}`);
  }

  async generateJson({
    prompt,
    systemInstruction = '',
    model = null,
    temperature = 0.2,
    maxTokens = 8192,
    retries = 2
  }) {
    let currentPrompt = prompt;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await this.generate({
          prompt: currentPrompt,
          systemInstruction,
          isJson: true,
          model,
          temperature: attempt === 0 ? temperature : 0.1,
          maxTokens
        });

        const parsed = this.safeJsonParse(res.text);
        return {
          data: parsed,
          text: res.text,
          modelUsed: res.modelUsed
        };
      } catch (err) {
        lastError = err;
        console.warn(`[Gemini 3.x Engine] Parse JSON thất bại (thử lần ${attempt + 1}/${retries + 1}): ${err.message}`);

        if (attempt < retries) {
          currentPrompt = `${prompt}\n\n[LƯU Ý CỰC KỲ QUAN TRỌNG VỀ ĐỊNH DẠNG: Lần tạo trước bị lỗi cú pháp JSON: "${err.message}". Vui lòng chỉ trả về DUY NHẤT 1 chuỗi JSON hợp lệ 100%, không kèm bất kỳ giải thích, markdown hay ký tự thừa nào bên ngoài. Đảm bảo escape toàn bộ dấu ngoặc kép bên trong nội dung văn bản (\\") và không dùng dấu gạch đầu dòng '-' không bọc trong chuỗi string.]`;
          this.rotateKey();
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    throw lastError;
  }
}

module.exports = new GeminiService();
