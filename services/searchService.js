const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

class SearchService {
  constructor() {
    this.serperKeys = (process.env.SERPER_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
    this.serperIndex = 0;
  }

  /**
   * Fast & reliable live web search using DuckDuckGo Lite
   */
  async searchDuckDuckGoLite(query, maxResults = 6) {
    try {
      const res = await axios.post('https://lite.duckduckgo.com/lite/', 'q=' + encodeURIComponent(query), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 9000
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

        // Get snippet from following td.result-snippet if exists
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
      console.warn(`[SearchService] DDG Lite search error: ${err.message}`);
      return [];
    }
  }

  /**
   * Serper Google Search (if API keys available)
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
   * Jina Reader: 100% Free Full-Page Scraper & Markdown Converter
   * Extracts the full text, ingredients, specifications, and genuine review notes
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
        // Clean out excessive whitespace
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
   * 1. Multi-query search across web
   * 2. Scrapes full text from top 2-3 authoritative sources (official producer, encyclopedic, review)
   */
  async gatherGroundingContext(productName, category = '', keywords = '', onProgress = () => {}) {
    const queries = [
      `${productName} chính hãng nhà sản xuất`,
      `${productName} review đánh giá chất lượng thực tế`,
      `${productName} ${category} thành phần công dụng quy trình sản xuất`
    ];

    const allResults = [];
    const seenLinks = new Set();

    onProgress({ step: 0, status: 'searching', message: `Đang quét tìm kiếm nguồn dữ liệu xác thực cho "${productName}"...` });

    for (const q of queries) {
      let items = await this.searchSerper(q, 4);
      if (items.length === 0) {
        items = await this.searchDuckDuckGoLite(q, 4);
      }

      for (const item of items) {
        if (!seenLinks.has(item.link)) {
          seenLinks.add(item.link);
          allResults.push(item);
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // Filter candidate URLs for deep scraping: prefer producer sites, wiki, or trusted reviews
    // Avoid social media login pages or empty search redirects
    const filterCandidateUrls = allResults.filter(r => {
      const u = r.link.toLowerCase();
      return !u.includes('facebook.com') &&
             !u.includes('youtube.com') &&
             !u.includes('tiktok.com') &&
             !u.includes('instagram.com') &&
             !u.includes('shopee.vn') &&
             !u.includes('lazada.vn');
    });

    const urlsToScrape = filterCandidateUrls.slice(0, 2);
    const deepScrapedContents = [];

    for (let i = 0; i < urlsToScrape.length; i++) {
      const item = urlsToScrape[i];
      onProgress({
        step: 0,
        status: 'deep_scraping',
        message: `Đang trích xuất nội dung gốc từ: ${item.title.slice(0, 40)}...`
      });

      const fullText = await this.scrapeWebpageContent(item.link);
      if (fullText && fullText.length > 300) {
        deepScrapedContents.push({
          title: item.title,
          url: item.link,
          content: fullText
        });
      }
    }

    // Build rich Grounding Dossier
    let contextText = `=== DỮ LIỆU TÌM KIẾM & NGUỒN XÁC THỰC (AUTHENTIC GROUNDING DOSSIER) ===\n\n`;
    
    // Part 1: Organic Search Overview
    contextText += `--- CÁC KẾT QUẢ TÌM KIẾM TRỰC TUYẾN ---\n`;
    allResults.slice(0, 6).forEach((r, idx) => {
      contextText += `[Nguồn ${idx + 1}]: ${r.title}\nURL: ${r.link}\nTrích dẫn tóm tắt: ${r.snippet}\n\n`;
    });

    // Part 2: Full Scraped Authoritative Webpages
    if (deepScrapedContents.length > 0) {
      contextText += `--- NỘI DUNG CHI TIẾT TRÍCH XUẤT TRỰC TIẾP TỪ TRANG GỐC ---\n`;
      deepScrapedContents.forEach((sc, idx) => {
        contextText += `\n[VĂN BẢN GỐC TỪ: ${sc.title} (${sc.url})]:\n${sc.content}\n--- HẾT VĂN BẢN NGUỒN ${idx + 1} ---\n`;
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
