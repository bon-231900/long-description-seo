const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const rootsProductService = require('./rootsProductService');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

class SearchService {
  constructor() {
    this.serperKeys = (process.env.SERPER_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
    this.serperIndex = 0;
  }

  /**
   * Cleans raw product titles from Excel/Sheets by removing technical weights,
   * package units, and excessive punctuation to produce a high-hit-rate search query.
   */
  cleanSearchQuery(rawName, brand = '') {
    if (!rawName) return '';
    let q = rawName
      .replace(/\(.*?\)/g, ' ')
      .replace(/\[.*?\]/g, ' ')
      .replace(/\b\d+(\.\d+)?\s*(g|kg|ml|l|oz|gói|hop|chai|lon|viên)\b/gi, ' ')
      .replace(/\b\d+\s*gói\b/gi, ' ')
      .replace(/[,;:\-\/\|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // If brand is known and not present in query, append for precision
    if (brand && !q.toLowerCase().includes(brand.toLowerCase())) {
      q = `${q} ${brand}`;
    }
    return q.trim();
  }

  /**
   * Search official Wikipedia (Encyclopedia knowledge for categories, ingredients, history)
   * 100% Free, high-speed, never blocked, zero hallucination.
   */
  async searchWikipedia(query, limit = 3) {
    if (!query || !query.trim()) return [];
    try {
      const url = `https://vi.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&limit=${limit}`;
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'RootsSEOAutomation/1.0 (https://roots.vn; contact@roots.vn)'
        },
        timeout: 6000
      });

      const items = res.data?.query?.search || [];
      return items.map(it => ({
        title: it.title,
        link: `https://vi.wikipedia.org/wiki/${encodeURIComponent(it.title.replace(/ /g, '_'))}`,
        snippet: (it.snippet || '').replace(/<[^>]+>/g, ''),
        source: 'Wikipedia Bách Khoa Toàn Thư'
      }));
    } catch (err) {
      return [];
    }
  }

  /**
   * Live Web Search via DuckDuckGo Lite
   */
  async searchDuckDuckGoLite(query, maxResults = 5) {
    try {
      const res = await axios.post('https://lite.duckduckgo.com/lite/', 'q=' + encodeURIComponent(query), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 8000
      });

      const $ = cheerio.load(res.data);
      const results = [];

      $('a.result-link').each((i, el) => {
        if (results.length >= maxResults) return false;
        let title = $(el).text().trim();
        let rawHref = $(el).attr('href') || '';

        let link = rawHref;
        if (rawHref.includes('uddg=')) {
          try {
            link = decodeURIComponent(rawHref.split('uddg=')[1].split('&')[0]);
          } catch (e) {
            link = rawHref;
          }
        }

        const parentTr = $(el).closest('tr');
        const snippetTr = parentTr.next('tr');
        const snippet = snippetTr.find('.result-snippet').text().trim();

        if (title && link && link.startsWith('http')) {
          results.push({
            title,
            link,
            snippet: snippet || '',
            source: 'DuckDuckGo Live'
          });
        }
      });

      return results;
    } catch (err) {
      return [];
    }
  }

  /**
   * Serper Google Search (if API keys available and active)
   */
  async searchSerper(query, maxResults = 5) {
    if (this.serperKeys.length === 0) return [];

    for (let i = 0; i < this.serperKeys.length; i++) {
      const idx = (this.serperIndex + i) % this.serperKeys.length;
      const key = this.serperKeys[idx];

      try {
        const res = await axios.post('https://google.serper.dev/search', {
          q: query,
          hl: 'vi',
          gl: 'vn',
          num: maxResults
        }, {
          headers: {
            'X-API-KEY': key,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        });

        if (res.data?.organic) {
          this.serperIndex = idx;
          return res.data.organic.map(item => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet || '',
            source: 'Google (Serper)'
          }));
        }
      } catch (err) {
        continue;
      }
    }

    return [];
  }

  /**
   * Jina Reader: Full-Page Scraper & Markdown Converter
   */
  async scrapeWebpageContent(url, maxChars = 12000) {
    if (!url || !url.startsWith('http')) return '';
    try {
      const jinaUrl = `https://r.jina.ai/${url}`;
      const res = await axios.get(jinaUrl, {
        headers: {
          'Accept': 'text/plain',
          'X-No-Cache': 'true',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 12000
      });

      if (typeof res.data === 'string') {
        let cleaned = res.data.replace(/\n{3,}/g, '\n\n').trim();
        return cleaned.slice(0, maxChars);
      }
    } catch (err) {
      console.warn(`[SearchService] Jina Reader error for ${url}: ${err.message}`);
    }
    return '';
  }

  /**
   * Deep Multi-Source Grounding Context Gathering
   * 1. Sheet Packaging Specs (100% genuine ingredients, storage, usage)
   * 2. Live Store Product Scraping (ROOTS.VN real prices, packaging, descriptions)
   * 3. Wikipedia Encyclopedia (Nutritional science, origins, culinary background)
   * 4. Multi-query web search
   */
  async gatherGroundingContext({
    productName,
    category = '',
    brand = '',
    ingredients = '',
    storage = '',
    usage = '',
    code = '',
    onProgress = () => {}
  }) {
    const allResults = [];
    const seenLinks = new Set();
    const deepScrapedContents = [];

    const cleanName = this.cleanSearchQuery(productName, brand);

    onProgress({
      step: 0,
      status: 'searching',
      message: `Đang quét dữ liệu xác thực từ ROOTS.VN, Wikipedia và bao bì chính hãng...`
    });

    // 1. Check live ROOTS.VN product catalog
    try {
      const rootsProducts = await rootsProductService.searchRoots(cleanName || productName);
      if (rootsProducts && rootsProducts.length > 0) {
        const topRoots = rootsProducts[0];
        allResults.push({
          title: `[ROOTS.VN] ${topRoots.name}`,
          link: topRoots.url,
          snippet: `Giá bán niêm yết: ${topRoots.price} | Hình ảnh: ${topRoots.image}`,
          source: 'ROOTS.VN Store Catalog'
        });

        // Deep scrape official product page
        onProgress({
          step: 0,
          status: 'deep_scraping',
          message: `Đang trích xuất nội dung sản phẩm trực tiếp từ ROOTS.VN...`
        });

        const scrapedRoots = await this.scrapeWebpageContent(topRoots.url, 8000);
        if (scrapedRoots && scrapedRoots.length > 200) {
          deepScrapedContents.push({
            title: `ROOTS.VN - ${topRoots.name}`,
            url: topRoots.url,
            content: scrapedRoots
          });
        }
      }
    } catch (e) {
      console.warn('[SearchService] Lỗi quét ROOTS.VN:', e.message);
    }

    // 2. Wikipedia knowledge search (Category & Key ingredients)
    try {
      const wikiTerms = [category, brand, cleanName.split(' ').slice(0, 3).join(' ')].filter(Boolean);
      for (const term of wikiTerms.slice(0, 2)) {
        const wikiItems = await this.searchWikipedia(term, 2);
        for (const item of wikiItems) {
          if (!seenLinks.has(item.link)) {
            seenLinks.add(item.link);
            allResults.push(item);
          }
        }
      }
    } catch (e) {
      console.warn('[SearchService] Lỗi quét Wikipedia:', e.message);
    }

    // 3. Web Search for product reviews & specs
    const searchQueries = [
      `${cleanName} thành phần công dụng`,
      `${cleanName} review đánh giá`
    ].filter(Boolean);

    for (const q of searchQueries) {
      let items = await this.searchSerper(q, 3);
      if (items.length === 0) {
        items = await this.searchDuckDuckGoLite(q, 3);
      }

      for (const item of items) {
        if (!seenLinks.has(item.link)) {
          seenLinks.add(item.link);
          allResults.push(item);
        }
      }
    }

    // Build Grounding Dossier
    let contextText = `=== HỒ SƠ DỮ LIỆU XÁC THỰC CỦA SẢN PHẨM (AUTHENTIC GROUNDING DOSSIER) ===\n\n`;

    // Part 1: Official Packaging Data from Google Sheet
    contextText += `--- THÔNG SỐ CHÍNH HÃNG TỪ BAO BÌ NHÀ SẢN XUẤT (GOOGLE SHEET) ---\n`;
    contextText += `- Tên sản phẩm đầy đủ: ${productName}\n`;
    if (brand) contextText += `- Thương hiệu: ${brand}\n`;
    if (code) contextText += `- Mã barcode/SKU: ${code}\n`;
    if (ingredients) contextText += `- Thành phần công bố chính thức: ${ingredients}\n`;
    if (storage) contextText += `- Hướng dẫn bảo quản từ hãng: ${storage}\n`;
    if (usage) contextText += `- Hướng dẫn sử dụng: ${usage}\n`;
    contextText += `\n`;

    // Part 2: Live Store & Wikipedia Overview
    contextText += `--- CÁC NGUỒN THAM KHẢO XÁC THỰC TRỰC TUYẾN ---\n`;
    allResults.forEach((r, idx) => {
      contextText += `[Nguồn ${idx + 1} - ${r.source}]: ${r.title}\nURL: ${r.link}\nTrích dẫn: ${r.snippet}\n\n`;
    });

    // Part 3: Deep Scraped Webpages
    if (deepScrapedContents.length > 0) {
      contextText += `--- NỘI DUNG CHI TIẾT TRÍCH XUẤT TỪ TRANG GỐC ---\n`;
      deepScrapedContents.forEach((sc, idx) => {
        contextText += `\n[VĂN BẢN TRANG SẢN PHẨM: ${sc.title} (${sc.url})]:\n${sc.content}\n--- HẾT VĂN BẢN NGUỒN ${idx + 1} ---\n`;
      });
    }

    return {
      results: allResults,
      deepScrapedCount: deepScrapedContents.length,
      contextText
    };
  }
}

module.exports = new SearchService();
