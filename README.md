# 🚀 Long Description SEO: Autonomous Multi-Agent E-Commerce Guide Generator (24/7 Cloud Automation)

[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org)
[![Gemini](https://img.shields.io/badge/Gemini%20API-3.x%2B%20Generation-blue.svg)](https://ai.google.dev)
[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-24%2F7%20Runner-orange.svg)](https://github.com/features/actions)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

An enterprise-grade, autonomous multi-agent pipeline that conducts real-time web research, verifies authoritative facts, architectures bespoke outlines, and generates high-converting, human-grade long-form product guides for e-commerce stores. 

Synchronizes automatically with **Google Sheets** and runs **24/7 in the cloud via GitHub Actions** without keeping your local machine powered on.

---

## 🌟 Key Innovations

1. **Multi-Step Evidence-Driven Architecture (Steps 0 → 5)**:
   - Replaces naive "one-shot" AI descriptions with a disciplined 6-stage journalism workflow.
2. **Authentic Grounding Dossier (Zero Hallucinations)**:
   - Deep live web scraping via **DuckDuckGo Lite** + **Jina Reader** (`r.jina.ai`) pulls thousands of characters of actual manufacturer specs, certifications, and culinary review notes directly into the prompt context.
3. **Strict Gemini 3.x+ Generation Engine with Dual-Layer Failover**:
   - **Exclusively uses Gemini Generation 3.x+**: `gemini-3.5-flash-lite` (primary workhorse), `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.7-flash`, `gemini-3.8-flash`.
   - **Multi-Key Round-Robin Rotation**: Automatically rotates API keys on HTTP 429 rate limits.
   - **Intelligent Model Fallback**: Automatically escalates to the next Gen 3 model if a model is temporarily overloaded (HTTP 503).
4. **GEO / AEO & E-E-A-T Optimized**:
   - Answer-first formatting optimized for citation by **Google AI Overviews**, Perplexity, and ChatGPT Search.
   - Rich Markdown comparison tables, origin stories, and step-by-step preservation.
5. **CMS-Ready HTML Output**:
   - Formats clean HTML fragments with flat `<h2>` headings, valid `<table>`, `<ul>`, and `<ol>` tags. Zero wrapper junk (`<html>`, `<body>`), zero inline styles. Ready for 1-click copy-paste into WordPress, Sapo, Haravan, or Shopify.
6. **24/7 Cloud Runner via GitHub Actions**:
   - Runs serverless on Microsoft/GitHub infrastructure on a 30-minute cron schedule. Reads pending products from Google Sheets and writes back rich HTML in seconds.

---

## 🔄 The 6-Stage Multi-Agent Workflow

```
[Input: Product Name & Category]
        │
        ▼
[Step 0: Research & Grounding Brief v1.1]
   ├─ Search live web (DuckDuckGo Lite / Google)
   ├─ Scrape official manufacturer & review pages via Jina Reader
   └─ Synthesize strict JSON Brief (verified facts, tasting notes, comparison points, demand signals)
        │
        ▼
[Step 1: Prompt Architect v3.6]
   ├─ Evaluates demand signals (Process, Comparison, Storage, Pairings)
   └─ Constructs bespoke module outline & self-contained Writer JSON Prompt
        │
        ▼
[Step 2: Writer Engine v3.6]
   ├─ Adopts Consumer Journalist persona
   ├─ Eliminates robotic translation clichés ("trải nghiệm vị giác", "hồ sơ cảm quan"...)
   └─ Drafts complete comprehensive Vietnamese guide (prose + tables + lists)
        │
        ▼
[Step 3: Conversational Heading Editor v3.2]
   ├─ Replaces dry labels with engaging, curiosity-driven headings
   └─ Preserves 100% of body text, table structure, and punctuation
        │
        ▼
[Step 4: HTML CMS Converter]
   ├─ Strips internal editorial QA & SEO image metadata
   └─ Converts visible content into a clean, flat <h2> HTML fragment
        │
        ▼
[Step 5: E-Commerce Product Linker]
   ├─ Crawls product store (e.g. roots.vn) for exact variants, prices, and images
   └─ Generates internal linking opportunities for brand, category, and related items
        │
        ▼
[Google Sheets Updated: Column O (HTML) & Column P (Status)]
```

---

## 📁 Repository Structure

```
long-description-seo/
├── .github/
│   └── workflows/
│       └── seo_automation.yml   # 24/7 Cloud Runner workflow (GitHub Actions)
├── services/
│   ├── geminiService.js         # Gemini 3.x+ Multi-Model & Multi-Key rotation engine
│   ├── searchService.js         # Live web search & Jina Reader full-page scraper
│   ├── rootsProductService.js   # Live product crawler & price extractor
│   ├── step0Research.js         # Step 0: Research & Grounding Brief
│   ├── step1Architect.js        # Step 1: Bespoke Prompt Architect
│   ├── step2Writer.js           # Step 2: Consumer Journalist Writer Engine
│   ├── step3HeadingEditor.js    # Step 3: Conversational Heading Editor
│   ├── step4HtmlConverter.js    # Step 4: CMS-ready HTML fragment parser
│   ├── step5Linker.js           # Step 5: E-commerce Internal Linker
│   └── pipeline.js              # Master pipeline orchestrator
├── cli.js                       # Standalone CLI tool for local testing
├── sheets-runner.js             # Google Sheets batch processor
├── package.json                 # Project dependencies
├── .gitignore                   # Standard ignore rules
└── README.md                    # Documentation
```

---

## ⚙️ Configuration & Setup

### 1. Requirements
- Node.js 20.x or 22.x
- Google Gemini API Key(s) (Free tier supported from [Google AI Studio](https://aistudio.google.com/))
- Google Service Account JSON (with Editor access to your Google Sheet)

### 2. Local Environment (`.env`)
Create a `.env` file in the project root:
```env
# Google Gemini API Keys (comma-separated for auto-rotation)
GEMINI_API_KEYS=AIzaSy...Key1,AIzaSy...Key2,AIzaSy...Key3

# Default Gemini 3.x Model
DEFAULT_MODEL=gemini-3.5-flash-lite

# Google Sheet Target
SHEET_ID=your_google_sheet_id_here
SHEET_NAME=Trang tính1

# Google Service Account Credentials (JSON string)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

---

## 🚀 Running the Automation

### Method A: 24/7 Cloud Runner on GitHub Actions (Recommended)

1. Push this repository to GitHub.
2. In your GitHub repository:
   - Navigate to **Settings** ➔ **Secrets and variables** ➔ **Actions**.
   - Add the following Repository Secrets:
     - `GEMINI_API_KEYS`: Your Gemini API keys (comma-separated).
     - `GOOGLE_SERVICE_ACCOUNT_KEY`: Your Service Account JSON string.
     - `SHEET_ID`: Your Google Sheet ID.
     - `SHEET_NAME`: Name of the sheet tab (e.g. `Trang tính1`).
3. Navigate to **Actions** ➔ Select **`Long Description SEO Cloud Runner 24/7`**:
   - Click **Run workflow** to trigger immediately, or let the cron schedule run every 30 minutes automatically!

### Method B: Local CLI Execution

Test a single product:
```bash
node cli.js --product "Gạo ST25 Ông Cua Túi 5kg" --category "Gạo đặc sản"
```

Process a batch from Google Sheets locally:
```bash
node sheets-runner.js --batch 10
```

Run continuously on a local machine:
```bash
node sheets-runner.js --continuous --batch 10
```

---

## 📜 Output Format Example

```html
<p>Gạo ST25 Ông Cua là dòng gạo thơm đặc sản do Anh hùng lao động Hồ Quang Cua cùng nhóm nghiên cứu lai tạo tại vùng đất Sóc Trăng. Sản phẩm từng đạt giải Gạo ngon nhất thế giới năm 2019...</p>

<h2>Tóm tắt nhanh những điều cần biết về gạo ST25 Ông Cua</h2>
<ul>
  <li>Giống lúa thơm thuần chủng thích nghi với điều kiện đất nhiễm mặn vùng đồng bằng sông Cửu Long.</li>
  <li>Hạt gạo thon dài, màu trắng trong và tuyệt đối không bạc bụng.</li>
</ul>

<h2>Bảng so sánh gạo ST25 Ông Cua và các dòng gạo phổ biến</h2>
<table>
  <thead>
    <tr>
      <th>Tiêu chí</th>
      <th>Gạo ST25 Ông Cua</th>
      <th>Gạo ST24</th>
      <th>Gạo Jasmine</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Độ dẻo</strong></td>
      <td>Dẻo mềm, ngọt đậm hậu vị</td>
      <td>Dẻo vừa</td>
      <td>Hơi xốp nhẹ</td>
    </tr>
  </tbody>
</table>
```

---

## 📄 License

Distributed under the MIT License. Feel free to use, modify, and integrate into your e-commerce workflows.
