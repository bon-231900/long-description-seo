const { marked } = require('marked');

class Step4HtmlConverter {
  constructor() {
    // Configure marked options if needed
    marked.setOptions({
      gfm: true,
      breaks: false
    });
  }

  /**
   * Separate visible article from internal notes
   */
  splitInternalNotes(markdown) {
    const dividerPatterns = [
      /={2,}\s*GHI CHÚ NỘI BỘ[\s\S]*$/i,
      /GHI CHÚ NỘI BỘ\s*\(không hiển thị công khai\)[\s\S]*$/i,
      /GHI CHÚ NỘI BỘ[\s\S]*$/i,
      /=== INTERNAL EDITORIAL NOTES[\s\S]*$/i
    ];

    let visibleMarkdown = markdown;
    let internalNotes = '';

    for (const pattern of dividerPatterns) {
      const match = markdown.match(pattern);
      if (match) {
        visibleMarkdown = markdown.substring(0, match.index).trim();
        internalNotes = match[0].trim();
        break;
      }
    }

    return { visibleMarkdown, internalNotes };
  }

  /**
   * Deterministic conversion matching CMS copy-paste rules
   */
  convertToHtml(visibleMarkdown) {
    // Parse using marked
    let rawHtml = marked.parse(visibleMarkdown);

    // Rule 4: All section headings become <h2> (flat module structure)
    // Convert <h1>, <h3>, <h4>, <h5>, <h6> into <h2>
    rawHtml = rawHtml.replace(/<h[1-6]>(.*?)<\/h[1-6]>/gi, '<h2>$1</h2>');

    // Rule 3: Do not include doctype, html, head, body tags or CSS
    rawHtml = rawHtml.replace(/<!DOCTYPE[^>]*>/gi, '');
    rawHtml = rawHtml.replace(/<\/?(html|head|body)[^>]*>/gi, '');

    // Discard any <hr> or dividers between sections per instructions
    rawHtml = rawHtml.replace(/<hr\s*\/?>/gi, '');

    // Clean up excessive whitespace
    rawHtml = rawHtml.replace(/\n{3,}/g, '\n\n').trim();

    return rawHtml;
  }

  execute({ markdown, onProgress = () => {} }) {
    onProgress({ step: 4, status: 'starting', message: 'Bắt đầu Bước 4: Chuyển đổi Markdown sang HTML chuẩn CMS...' });

    const { visibleMarkdown, internalNotes } = this.splitInternalNotes(markdown);
    const html = this.convertToHtml(visibleMarkdown);

    onProgress({ step: 4, status: 'success', message: 'Hoàn tất chuyển đổi HTML fragment sạch (sẵn sàng copy vào CMS)!' });

    return {
      html,
      visibleMarkdown,
      internalNotes
    };
  }
}

module.exports = new Step4HtmlConverter();
