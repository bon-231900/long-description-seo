const axios = require('axios');
const cheerio = require('cheerio');

class RootsProductService {
  constructor() {
    this.cache = new Map();
  }

  async searchRoots(query) {
    if (!query || !query.trim()) return [];
    const cleanQuery = query.trim().toLowerCase();

    if (this.cache.has(cleanQuery)) {
      return this.cache.get(cleanQuery);
    }

    try {
      const encoded = encodeURIComponent(cleanQuery);
      const searchUrls = [
        `https://roots.vn/danh-muc/de-xuat?search=${encoded}`,
        `https://roots.vn/search?q=${encoded}`
      ];

      const products = [];
      const seenUrls = new Set();

      for (const url of searchUrls) {
        try {
          const res = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept-Language': 'vi,en;q=0.9'
            },
            timeout: 10000
          });

          const $ = cheerio.load(res.data);

          $('a[href*="/san-pham/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (!href) return;

            const link = href.startsWith('http') ? href : `https://roots.vn${href}`;
            if (seenUrls.has(link)) return;
            seenUrls.add(link);

            const imgEl = $(el).find('img');
            let imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || '';
            if (imgSrc && !imgSrc.startsWith('http')) {
              imgSrc = `https://roots.vn${imgSrc}`;
            }

            let name = imgEl.attr('alt') || $(el).attr('title') || $(el).text().trim();
            name = name.replace(/\s+/g, ' ').trim();

            const parent = $(el).closest('.product-item, .product-card, .item, div');
            const rawPriceText = parent.find('.price, .product-price, .current-price, span[class*="price"]').text().trim();
            const priceMatches = rawPriceText.match(/\d+[\.,\d]*\s*đ/gi) || [];

            let currentPrice = priceMatches.length > 0 ? priceMatches[0].trim() : '';

            if (name && name.length > 3) {
              products.push({
                name,
                url: link,
                image: imgSrc,
                price: currentPrice
              });
            }
          });

          if (products.length >= 3) break;
        } catch (e) {
          // ignore single url error
        }
      }

      this.cache.set(cleanQuery, products);
      return products;
    } catch (err) {
      console.warn('[RootsProductService] Search error:', err.message);
      return [];
    }
  }

  /**
   * Search for multiple candidate keywords (Product name, brand, category)
   */
  async getRecommendedLinks({ productName, category = '', brand = '' }) {
    const results = {
      exactProducts: [],
      categoryProducts: [],
      brandProducts: []
    };

    if (productName) {
      results.exactProducts = await this.searchRoots(productName);
    }

    if (category && category !== productName) {
      results.categoryProducts = await this.searchRoots(category);
    }

    if (brand && brand !== productName) {
      results.brandProducts = await this.searchRoots(brand);
    }

    return results;
  }
}

module.exports = new RootsProductService();
