#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const pipeline = require('./services/pipeline');

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        params[key] = next;
        i++;
      } else {
        params[key] = true;
      }
    }
  }
  return params;
}

function showHelp() {
  console.log(`
===============================================================
  ROBOTS.VN - TỰ ĐỘNG HÓA MÔ TẢ DÀI CHUẨN SEO (BƯỚC 0 -> 5)
===============================================================
Cách dùng:
  1. Chạy 1 sản phẩm:
     node cli.js --product "Tên sản phẩm" [--category "Danh mục"] [--keywords "từ khóa 1, từ khóa 2"] [--roots "Thông tin quy cách tại ROOTS"]

  2. Chạy danh sách từ file (CSV / TXT / JSON):
     node cli.js --file "danh-sach-san-pham.csv"

  3. Khởi động Web Studio UI:
     npm start   (hoặc chạy chay-mo-ta-dai.bat)
`);
}

async function run() {
  const params = parseArgs();

  if (params.help || (!params.product && !params.file && !params.batch)) {
    showHelp();
    return;
  }

  const onProgress = (evt) => {
    const time = new Date().toLocaleTimeString('vi-VN');
    console.log(`[${time}] [Bước ${evt.step}] ${evt.message}`);
  };

  // Single mode
  if (params.product) {
    console.log(`\n>>> Bắt đầu tạo mô tả dài cho: "${params.product}"...`);
    try {
      const result = await pipeline.runFullWorkflow({
        productName: params.product,
        category: params.category || '',
        verifiedKeywordsOverride: params.keywords || '',
        rootsAvailabilityInfo: params.roots || '',
        onProgress
      });

      console.log(`\n✅ THÀNH CÔNG!`);
      console.log(`- Thời gian: ${result.durationSeconds} giây`);
      console.log(`- File HTML CMS: ${result.savedFiles.html}`);
      console.log(`- File Markdown: ${result.savedFiles.markdown}`);
      console.log(`- File Brief JSON: ${result.savedFiles.brief}`);
      if (result.step5Links?.exactProducts?.length > 0) {
        console.log(`- Gợi ý link ROOTS:`);
        result.step5Links.exactProducts.forEach(p => {
          console.log(`   + ${p.name}: ${p.url} (${p.price})`);
        });
      }
    } catch (err) {
      console.error(`\n❌ LỖI:`, err.message);
      process.exit(1);
    }
    return;
  }

  // Batch from file
  if (params.file) {
    const filePath = path.resolve(params.file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Không tìm thấy file: ${filePath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let items = [];

    if (filePath.endsWith('.json')) {
      items = JSON.parse(content);
    } else {
      // CSV or plain lines
      items = content.split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => {
          const parts = l.split(',');
          return {
            productName: parts[0]?.trim(),
            category: parts[1]?.trim() || ''
          };
        });
    }

    console.log(`\n>>> Đã nạp ${items.length} sản phẩm cần tạo mô tả dài.`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const name = typeof item === 'string' ? item : item.productName || item.name;
      const cat = typeof item === 'object' ? item.category : '';
      if (!name) continue;

      console.log(`\n======================================================`);
      console.log(`[${i + 1}/${items.length}] Đang xử lý: ${name}`);
      console.log(`======================================================`);

      try {
        const res = await pipeline.runFullWorkflow({
          productName: name,
          category: cat,
          onProgress
        });
        console.log(`✅ Hoàn tất [${i + 1}/${items.length}]: ${name} -> ${res.savedFiles.html}`);
      } catch (e) {
        console.error(`❌ Lỗi sản phẩm ${name}:`, e.message);
      }
    }

    console.log(`\n🎉 Đã hoàn tất toàn bộ danh mục sản phẩm! Kiểm tra thư mục output/`);
  }
}

run();
