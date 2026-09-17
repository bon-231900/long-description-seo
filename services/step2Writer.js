const geminiService = require('./geminiService');

class Step2Writer {
  /**
   * Post-processor to ensure strict adherence to ROOTS style guide
   */
  sanitizeArticle(text) {
    if (!text) return '';
    let result = text;

    // 1. Forbid corporate / awkward phrasing
    result = result.replace(/hệ thống ROOTS/gi, 'cửa hàng ROOTS');
    result = result.replace(/cửa hàng vật lý/gi, 'cửa hàng');
    result = result.replace(/trải nghiệm vị giác/gi, 'hương vị khi thưởng thức');
    result = result.replace(/hồ sơ cảm quan/gi, 'đặc tính hương vị');
    result = result.replace(/thăng hoa vị giác/gi, 'đậm đà thơm ngon');
    result = result.replace(/bùng nổ vị giác/gi, 'dậy vị thơm ngon');
    result = result.replace(/ma trận so sánh/gi, 'bảng so sánh');
    result = result.replace(/cú cắn/gi, 'khi thưởng thức');
    result = result.replace(/vị cứu tinh/gi, 'lựa chọn lý tưởng');
    result = result.replace(/quyển sổ thông tin|cuốn cẩm nang toàn diện/gi, 'thông tin');

    // 2. Ensure "người tiêu dùng" / "người dùng" does not appear excessively
    const userWords = [/người tiêu dùng/gi, /người dùng/gi];
    for (const regex of userWords) {
      let count = 0;
      result = result.replace(regex, (match) => {
        count++;
        if (count > 1) {
          return 'bạn';
        }
        return match;
      });
    }

    return result;
  }

  async execute({ writerPrompt, onProgress = () => {} }) {
    onProgress({ step: 2, status: 'starting', message: 'Bắt đầu Bước 2: Writer - Đang chấp bút bài mô tả dài theo phong cách chuyên gia ẩm thực...' });

    const promptText = typeof writerPrompt === 'string' ? writerPrompt : JSON.stringify(writerPrompt, null, 2);

    const res = await geminiService.generate({
      prompt: promptText,
      isJson: false,
      temperature: 0.55,
      maxTokens: 8192
    });

    let markdownText = geminiService.cleanMarkdownOrHtml(res.text);
    markdownText = this.sanitizeArticle(markdownText);

    onProgress({ step: 2, status: 'success', message: 'Hoàn tất bản thảo mô tả dài xuất sắc, chuẩn phong cách ROOTS!' });

    return {
      draftMarkdown: markdownText
    };
  }
}

module.exports = new Step2Writer();
