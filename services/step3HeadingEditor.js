const geminiService = require('./geminiService');

class Step3HeadingEditor {
  buildPrompt(draftMarkdown) {
    const editorInstructions = {
      prompt_name: "Conversational Heading Editor",
      version: "3.2",
      objective: "Refine headings to be more natural, clear, engaging, and lightly SEO/GEO-aware — without altering body content or formatting.",
      instruction: "Perform the final editorial step on the article provided below.",
      execution_instructions: {
        step_1: "Reread the full article.",
        step_2: "For each section, discard the initial heading.",
        step_3: "Craft a new Vietnamese heading that sounds like a friendly expert, reflecting the SPECIFIC content of that section. Weave in one relevant keyword only where natural.",
        step_4: "Present the entire final article with only the new headings. Keep exact formatting, bullet points, tables, punctuation, numbering — do not convert bullets/tables into paragraphs, do not add new ones, do not reorder sections."
      },
      heading_rules: {
        language_and_fluency: "100% natural, fluent Vietnamese.",
        tone_and_style: "Helpful, clear, engaging. Prefer specific, curiosity/benefit-driven headings over flat generic labels.",
        strict_prohibitions: "No promotional language, overhype, superlatives, exclamation marks, academic jargon, forced/stuffed keywords. Must read as written by a human editor. No horizontal dividers (---) between sections. Do not alter punctuation, bullet markers, numbering, or table structure.",
        roots_mention_consistency_rule: "If any section discusses where to buy, authenticity, or purchasing advice, it may naturally refer to ROOTS — both the store and website — worded plainly per roots_purchase_mention_mandate (no CTA hype, no exclamation marks, no superlatives). ROOTS has only ONE store location — if the article contains plural/multi-location phrasing ('các cửa hàng ROOTS', 'các chi nhánh', 'hệ thống cửa hàng', 'chuỗi cửa hàng'), correct to singular ('cửa hàng ROOTS', 'tại ROOTS'). Never mention any other retailer. Do not add a new purchase mention where none existed."
      },
      final_output_format: "Only the complete, refined Vietnamese article. No commentary."
    };

    return `${JSON.stringify(editorInstructions, null, 2)}\n\n=== NỘI DUNG BÀI VIẾT CẦN BIÊN TẬP LẠI HEADING ===\n\n${draftMarkdown}`;
  }

  async execute({ draftMarkdown, onProgress = () => {} }) {
    onProgress({ step: 3, status: 'starting', message: 'Bắt đầu Bước 3: Heading Editor - Tinh chỉnh các tiêu đề cuốn hút, chuẩn SEO...' });

    const prompt = this.buildPrompt(draftMarkdown);
    const res = await geminiService.generate({
      prompt,
      isJson: false,
      temperature: 0.4,
      maxTokens: 8192
    });

    const refinedMarkdown = geminiService.cleanMarkdownOrHtml(res.text);

    onProgress({ step: 3, status: 'success', message: 'Hoàn tất tinh chỉnh Heading H2 conversational!' });

    return {
      refinedMarkdown
    };
  }
}

module.exports = new Step3HeadingEditor();
