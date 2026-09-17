const geminiService = require('./geminiService');
const searchService = require('./searchService');

class Step0Research {
  buildPrompt({ productName, category = '', verifiedKeywordsOverride = '' }) {
    const promptObject = {
      prompt_name: "Product Research & Grounding Brief",
      version: "1.1",
      role: "You are a meticulous research analyst. Your job is to use Google Search grounding to gather verified, source-backed facts, genuine review/experience insights, and current SEO signals about a specific consumer product sold at a Vietnamese supermarket named ROOTS. You do not write marketing copy. You only collect and structure verified information.",
      inputs: {
        product_name: productName,
        category: category || "[Không chỉ định]",
        verified_keywords_override: verifiedKeywordsOverride || ""
      },
      research_instructions: {
        source_priority_order: [
          "1. Official brand/manufacturer website, packaging-disclosed specs, or the original country-of-origin producer's site — the single most authoritative source for what the product actually is.",
          "2. Reputable INTERNATIONAL sources: recognized global/foreign health & food authorities (WHO, FDA, EFSA, USDA), major international encyclopedic or industry references, and well-established foreign publications relevant to the product category — prioritize these over Vietnamese sources for imported/globally-known products.",
          "3. Vietnamese government or recognized health authorities (Bộ Y Tế, Cục An toàn thực phẩm VFA) — only cite publicly disclosed statements, do not infer beyond them.",
          "4. Large, reputable Vietnamese news outlets or industry publications — used mainly for local context, local pricing/availability norms, and Vietnamese consumer FAQs.",
          "5. Wikipedia / encyclopedic sources for background, origin, history (can be either language).",
          "6. Large e-commerce/supermarket sites (Vietnamese or foreign) — use ONLY to study structure/keyword usage, never copy wording."
        ],
        review_source_vetting_criteria: "For the authentic_review_insights task below, only use sources that meet ALL of these: (a) has clear editorial oversight — named authors/editors, an established publication with a track record, not an anonymous or auto-generated page; (b) is independent from the brand — not the brand's own marketing site, not a paid/sponsored placement without disclosure; (c) is a recognized, reputable outlet in its category (established consumer-testing organizations, respected food/product review publications, recognized industry trade press, well-known culinary/critic publications) — NOT random blogs, NOT unmoderated forums, NOT anonymous UGC review aggregators, NOT sites with no verifiable publisher identity. When in doubt about a source's credibility, exclude it rather than include it.",
        tasks: [
          "Search for verified product facts: ingredients/components, specs, origin, usage, storage instructions.",
          "Search for the production process or underlying mechanism that explains the product's most notable characteristic — treat as a required research task, not optional.",
          "Search for how this product compares to 2-4 closely related alternative products/variants across multiple concrete criteria — enough to build a genuinely informative comparison table.",
          "Search for specific, observable quality-check signs a buyer can look for at the point of purchase — not generic advice.",
          "Search for stage-by-stage storage guidance (unopened / opened / frozen) with concrete temperatures and durations.",
          "IF food/beverage/condiment-related: search for genuine pairing/serving suggestions — as pairing ideas, not full recipes. Skip for non-food categories.",
          "NEW — search reputable FOREIGN review/knowledge sources (per review_source_vetting_criteria above) for genuine first-hand experience insights about this exact product or its direct product line: real tasting notes, real usage observations, commonly praised traits, commonly criticized traits, comparisons reviewers make. This is different from official spec facts — it's what real, credentialed reviewers actually experienced. This is the single best lever against generic-sounding articles, because genuine review content is inherently specific to THIS product, unlike spec sheets which read similarly across a whole category. For each insight, record which source it came from and a one-line credibility note (why that source qualifies per the vetting criteria). If no source clears the vetting bar for this product, leave authentic_review_insights empty rather than lowering the bar.",
          "If verified_keywords_override is provided, use those keywords as-is and skip keyword inference. Otherwise: search for currently trending search queries in Vietnamese, and INFER likely keywords by observing patterns across search results — label the method in keyword_derivation_method.",
          "Search for frequently asked questions consumers have about this product/category.",
          "Identify 3-5 existing articles/product pages about similar products, and extract their common opening phrases, structural patterns, and clichés — NOT to copy, but so the writer stage can deliberately avoid mirroring them.",
          "Identify the semantic ENTITIES most strongly associated with this product in real-world context (related dishes/uses, comparison entities, geographic/origin entities) — concrete nouns for the writer to weave in naturally.",
          "CRITICAL — assess real demand, don't assume it: for each candidate topic (process/mechanism, comparison, storage, pairing), rate how often it ACTUALLY surfaces in search results (headings on top-ranking pages, 'People Also Ask'-style questions, recurring themes) versus topics you were merely instructed to research. Rate honestly in topic_demand_signals rather than defaulting everything to 'high'. Also flag any topic outside the standard list (hạn sử dụng, dị ứng/thành phần, xuất xứ, giá...) showing surprisingly strong demand."
        ]
      },
      compliance_flags_to_apply: {
        no_unlicensed_claims: "Flag any health/nutrition benefit claim requiring professional medical/nutrition credentials (e.g. 'giúp giảm cân', 'tăng cường miễn dịch', 'chữa bệnh'). Only include if DIRECTLY and verifiably disclosed by an official source, marked 'requires_citation: true'.",
        sensitive_topics: "Do not research or include anything related to religion, politics, or gender identity.",
        neutrality: "Collect facts and genuine review observations only. Do not collect or generate persuasive/promotional language."
      },
      output_format: {
        type: "JSON only, no commentary",
        schema: {
          sources: "[{name, url_or_reference, info_type, credibility_note}]",
          verified_facts: "[{fact, source_index, requires_citation}]",
          process_or_mechanism_explanation: "[Detailed notes on the production process/mechanism, with sources]",
          comparison_points: "[{alternative_product_or_variant, criteria: {...}}] — at least 2-4 alternatives",
          quality_check_signs: "[list of specific, observable buyer checks]",
          storage_by_stage: "{unopened: {...}, opened: {...}, frozen: {...}}",
          pairing_suggestions: "[list, empty array if not applicable]",
          authentic_review_insights: "[{insight, source_name, source_credibility_note, sentiment: 'positive'|'negative'|'neutral'|'mixed'}] — genuine first-hand experience observations from vetted foreign review sources only. Empty array if nothing cleared the vetting bar.",
          keywords_primary: "[3-5 main SEO keywords]",
          keywords_secondary: "[5-10 related/long-tail keywords]",
          keyword_derivation_method: "'verified_override' or 'inferred_from_search_patterns' — always disclose which.",
          common_faqs: "[list of frequent questions]",
          competitor_patterns_to_avoid: "[common opening lines/structural clichés, described generally, not copied]",
          entities_to_reference: "[5-12 concrete related entities]",
          flagged_unverified_claims: "[claims lacking strong verification, to exclude]",
          topic_demand_signals: "{process_mechanism: 'high'|'medium'|'low'|'none', comparison: ..., storage: ..., pairing: ..., other_signals_found: [{topic, level, evidence_note}]} — rate genuine search demand honestly, not just 'could I find info'."
        }
      },
      final_instruction: "Return ONLY the JSON object matching output_format.schema. No extra text."
    };

    return JSON.stringify(promptObject, null, 2);
  }

  async execute({ productName, category = '', verifiedKeywordsOverride = '', onProgress = () => {} }) {
    onProgress({ step: 0, status: 'starting', message: `Bắt đầu Bước 0: Thu thập dữ liệu thực tế cho "${productName}"...` });

    const basePrompt = this.buildPrompt({ productName, category, verifiedKeywordsOverride });
    let briefResult = null;
    let methodUsed = '';

    // Step 0A: Always gather authentic grounding context from live web & authoritative sources
    const searchContext = await searchService.gatherGroundingContext(
      productName,
      category,
      verifiedKeywordsOverride,
      onProgress
    );

    const enrichedPrompt = `${basePrompt}\n\n${searchContext.contextText}\n\nCRITICAL INSTRUCTION: Analyze the above authentic web data and deeply scraped pages thoroughly. Extract exact verified facts, genuine review observations, real comparison points, and honest demand signals into the exact required JSON schema.`;

    onProgress({
      step: 0,
      status: 'analyzing',
      message: `Đã thu thập ${searchContext.results.length} nguồn trực tuyến & ${searchContext.deepScrapedCount} trang trích xuất chi tiết. Đang tổng hợp JSON Brief...`
    });

    try {
      const res = await geminiService.generate({
        prompt: enrichedPrompt,
        isJson: true,
        temperature: 0.2
      });

      briefResult = geminiService.safeJsonParse(res.text);
      methodUsed = `Deep Live Web Scraping (DuckDuckGo + Jina Reader: ${searchContext.deepScrapedCount} trang gốc)`;
      onProgress({
        step: 0,
        status: 'success',
        message: `Hoàn tất Bước 0 với ${briefResult.verified_facts?.length || 0} sự thật xác thực từ nguồn chính thống!`
      });
    } catch (err) {
      console.warn('[Step 0] Lỗi khi tổng hợp JSON Brief:', err.message);
      throw err;
    }

    return {
      productName,
      category,
      brief: briefResult,
      methodUsed
    };
  }
}

module.exports = new Step0Research();
