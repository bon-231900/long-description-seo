const fs = require('fs');
const path = require('path');
const step0Research = require('./step0Research');
const step1Architect = require('./step1Architect');
const step2Writer = require('./step2Writer');
const step3HeadingEditor = require('./step3HeadingEditor');
const step4HtmlConverter = require('./step4HtmlConverter');
const step5Linker = require('./step5Linker');

class Pipeline {
  slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
  }

  async runFullWorkflow({
    productName,
    category = '',
    verifiedKeywordsOverride = '',
    rootsAvailabilityInfo = '',
    brand = '',
    outputDir = path.join(__dirname, '..', 'output'),
    onProgress = () => {}
  }) {
    if (!productName || !productName.trim()) {
      throw new Error('Vui lòng cung cấp tên sản phẩm (product_name).');
    }

    const cleanProductName = productName.trim();
    const startTime = Date.now();

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Step 0: Research & Grounding Brief
    const step0Res = await step0Research.execute({
      productName: cleanProductName,
      category,
      verifiedKeywordsOverride,
      onProgress
    });

    // Step 1: Prompt Architect
    const step1Res = await step1Architect.execute({
      productName: cleanProductName,
      researchBrief: step0Res.brief,
      rootsAvailabilityInfo,
      onProgress
    });

    // Step 2: Writer
    const step2Res = await step2Writer.execute({
      writerPrompt: step1Res.writerPrompt,
      onProgress
    });

    // Step 3: Heading Editor
    const step3Res = await step3HeadingEditor.execute({
      draftMarkdown: step2Res.draftMarkdown,
      onProgress
    });

    // Step 4: Markdown -> Clean HTML
    const step4Res = await step4HtmlConverter.execute({
      markdown: step3Res.refinedMarkdown,
      onProgress
    });

    // Step 5: Related Links Discovery
    const step5Res = await step5Linker.execute({
      productName: cleanProductName,
      category,
      brand,
      html: step4Res.html,
      onProgress
    });

    // Save files to output directory
    const slug = this.slugify(cleanProductName) || 'san-pham';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const prefix = `${slug}_${timestamp}`;

    const htmlPath = path.join(outputDir, `${prefix}_cms.html`);
    const mdPath = path.join(outputDir, `${prefix}_article.md`);
    const briefPath = path.join(outputDir, `${prefix}_brief.json`);

    fs.writeFileSync(htmlPath, step4Res.html, 'utf8');
    fs.writeFileSync(mdPath, step3Res.refinedMarkdown, 'utf8');
    fs.writeFileSync(briefPath, JSON.stringify(step0Res.brief, null, 2), 'utf8');

    const totalDurationSeconds = Math.round((Date.now() - startTime) / 1000);

    onProgress({
      step: 'complete',
      status: 'finished',
      message: `Đã hoàn tất toàn bộ quy trình cho "${cleanProductName}" trong ${totalDurationSeconds}s!`
    });

    return {
      productName: cleanProductName,
      category,
      durationSeconds: totalDurationSeconds,
      step0Brief: step0Res.brief,
      step1Prompt: step1Res.writerPrompt,
      step2Draft: step2Res.draftMarkdown,
      step3Refined: step3Res.refinedMarkdown,
      step4Html: step4Res.html,
      internalNotes: step4Res.internalNotes,
      step5Links: step5Res.recommendations,
      savedFiles: {
        html: htmlPath,
        markdown: mdPath,
        brief: briefPath
      }
    };
  }
}

module.exports = new Pipeline();
