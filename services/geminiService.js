const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * Gemini Service for Generation 3.x+ Models Only
 * Strict Policy: Only gemini-3.5-flash-lite, gemini-3.6-flash, gemini-3.5-flash, gemini-3.7-flash, gemini-3.8-flash
 * Multi-Key Rotation + Intelligent Model Fallback
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
    if (str.startsWith('```json')) {
      str = str.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (str.startsWith('```')) {
      str = str.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    const firstBrace = str.indexOf('{');
    const lastBrace = str.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      str = str.slice(firstBrace, lastBrace + 1);
    }
    return str.trim();
  }

  safeJsonParse(raw) {
    const cleaned = this.cleanJsonString(raw);
    try {
      return JSON.parse(cleaned);
    } catch (err) {
      try {
        const sanitized = cleaned
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
          .replace(/,\s*([\]}])/g, '$1');
        return JSON.parse(sanitized);
      } catch (e) {
        console.error('[Gemini 3.x Engine] Parse JSON thất bại. Snippet:', cleaned.slice(0, 300));
        throw new Error('Dữ liệu AI trả về không thể parse thành JSON: ' + err.message);
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
}

module.exports = new GeminiService();
