const rootsProductService = require('./rootsProductService');

class Step5Linker {
  async execute({ productName, category = '', brand = '', html, onProgress = () => {} }) {
    onProgress({ step: 5, status: 'starting', message: 'Bắt đầu Bước 5: Tìm kiếm liên kết sản phẩm liên quan trên ROOTS.VN...' });

    let brandGuess = brand;
    if (!brandGuess && productName) {
      // Try to extract first 2 words if capitalized
      const words = productName.split(' ');
      if (words.length >= 2) {
        brandGuess = words.slice(0, 2).join(' ');
      }
    }

    const recommended = await rootsProductService.getRecommendedLinks({
      productName,
      category,
      brand: brandGuess
    });

    const totalFound = (recommended.exactProducts?.length || 0) +
                       (recommended.categoryProducts?.length || 0) +
                       (recommended.brandProducts?.length || 0);

    onProgress({
      step: 5,
      status: 'success',
      message: `Đã tìm thấy ${totalFound} gợi ý liên kết trên ROOTS.VN!`
    });

    return {
      recommendations: recommended,
      html
    };
  }

  /**
   * Intelligently insert an anchor link into the first occurrence of a keyword in HTML
   * without breaking HTML tags.
   */
  injectLinkIntoHtml(html, keyword, targetUrl, title = '') {
    if (!html || !keyword || !targetUrl) return html;

    const cleanKeyword = keyword.trim();
    // Match outside of HTML tags: <[^>]+>
    // We only replace the first occurrence in text nodes
    let replaced = false;

    const parts = html.split(/(<[^>]+>)/g);
    const newParts = parts.map(part => {
      if (replaced || part.startsWith('<')) {
        return part;
      }

      const regex = new RegExp(`(${cleanKeyword})`, 'i');
      if (regex.test(part)) {
        replaced = true;
        const linkTitle = title ? ` title="${title}"` : '';
        return part.replace(regex, `<a href="${targetUrl}" target="_blank" rel="noopener"${linkTitle}>$1</a>`);
      }
      return part;
    });

    return newParts.join('');
  }
}

module.exports = new Step5Linker();
