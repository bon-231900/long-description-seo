const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pipeline = require('./services/pipeline');

const DEFAULT_SHEET_ID = process.env.SHEET_ID;
const DEFAULT_SHEET_NAME = process.env.SHEET_NAME || 'Trang tính1';

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    batch: 10,
    continuous: false,
    delaySec: 4
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch' && args[i + 1]) {
      params.batch = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--continuous') {
      params.continuous = true;
    } else if (args[i] === '--delay' && args[i + 1]) {
      params.delaySec = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return params;
}

function getSheetsClient() {
  let credentials = null;
  const envKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (envKey) {
    try {
      credentials = typeof envKey === 'string' && envKey.trim().startsWith('{') ? JSON.parse(envKey) : envKey;
    } catch (e) {
      console.error('[Google Sheets] Lỗi đọc GOOGLE_SERVICE_ACCOUNT_KEY từ env:', e.message);
    }
  }

  if (!credentials) {
    const candidatePaths = [
      path.join(__dirname, 'service-account.json'),
      path.join(__dirname, 'credentials.json'),
      path.join(__dirname, '..', 'mo-ta-dai', 'service-account.json')
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          credentials = JSON.parse(fs.readFileSync(p, 'utf8'));
          break;
        } catch (e) {}
      }
    }
  }

  if (!credentials) {
    throw new Error(
      'Không tìm thấy thông tin xác thực Google Service Account!\n' +
      'Vui lòng cấu hình GOOGLE_SERVICE_ACCOUNT_KEY trong GitHub Secrets hoặc tạo file service-account.json cục bộ.'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function runBatch(batchLimit = 10, onRowProgress = () => {}) {
  const sheetId = DEFAULT_SHEET_ID;
  if (!sheetId) {
    throw new Error('Chưa cấu hình SHEET_ID! Vui lòng cấu hình biến môi trường SHEET_ID trong file .env hoặc GitHub Secrets.');
  }
  const sheets = getSheetsClient();

  let tabName = process.env.SHEET_NAME;
  if (!tabName) {
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      tabName = meta.data.sheets?.[0]?.properties?.title || 'Trang tính1';
      console.log(`[Google Sheets] Tự động chọn tab đầu tiên: "${tabName}"`);
    } catch (e) {
      tabName = 'Trang tính1';
    }
  }

  console.log(`\n===============================================================`);
  console.log(`  ROOTS SEO - ĐANG KẾT NỐI GOOGLE SHEET: ${sheetId}`);
  console.log(`  Tab: "${tabName}" | Giới hạn đợt này: ${batchLimit} sản phẩm`);
  console.log(`===============================================================`);

  // 1. Read Header
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tabName}'!A1:Z1`,
  });
  const header = headerRes.data.values?.[0] || [];
  
  const colName = header.indexOf('Tên Sản Phẩm');
  const colBrand = header.indexOf('Thương hiệu');
  const colCode = header.indexOf('Mã gợi nhớ');
  const colIngredients = header.indexOf('Thành phần sản phẩm');
  const colStorage = header.indexOf('Hướng dẫn bảo quản');
  const colUsage = header.indexOf('Hướng dẫn sử dụng');
  let colLongDesc = header.indexOf('Mô tả dài HTML (CMS)');
  let colStatus = header.indexOf('Trạng thái mô tả dài');

  if (colName === -1) {
    throw new Error("Không tìm thấy cột 'Tên Sản Phẩm' trong Google Sheet!");
  }

  // If column doesn't exist, create it
  if (colLongDesc === -1) {
    colLongDesc = header.length;
    colStatus = header.length + 1;
    const colL1 = String.fromCharCode(65 + colLongDesc);
    const colL2 = String.fromCharCode(65 + colStatus);
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${tabName}'!${colL1}1:${colL2}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['Mô tả dài HTML (CMS)', 'Trạng thái mô tả dài']]
      }
    });
    console.log(`Đã khởi tạo cột Mô tả dài tại cột ${colL1} và Trạng thái tại ${colL2}!`);
  }

  // 2. Read all rows to find empty long description
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tabName}'!A2:P`,
  });
  const allRows = rowsRes.data.values || [];
  console.log(`Tổng số sản phẩm trong bảng tính: ${allRows.length} dòng.`);

  const pendingRows = [];
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const name = (row[colName] || '').trim();
    const currentLongDesc = (row[colLongDesc] || '').trim();

    if (name && !currentLongDesc) {
      pendingRows.push({
        rowIndex: i + 2, // 1-based index in Sheet (row 1 is header)
        name,
        brand: (colBrand !== -1 ? row[colBrand] : '') || '',
        code: (colCode !== -1 ? row[colCode] : '') || '',
        ingredients: (colIngredients !== -1 ? row[colIngredients] : '') || '',
        storage: (colStorage !== -1 ? row[colStorage] : '') || '',
        usage: (colUsage !== -1 ? row[colUsage] : '') || '',
      });
      if (pendingRows.length >= batchLimit) break;
    }
  }

  console.log(`Tìm thấy ${pendingRows.length} sản phẩm cần tạo mô tả dài trong đợt này.`);
  if (pendingRows.length === 0) {
    console.log('✅ Toàn bộ sản phẩm đã có mô tả dài! Không có việc gì cần làm.');
    return { processed: 0, totalPending: 0 };
  }

  const colDescLetter = String.fromCharCode(65 + colLongDesc);
  const colStatusLetter = String.fromCharCode(65 + colStatus);

  // 3. Process each row
  for (let idx = 0; idx < pendingRows.length; idx++) {
    const item = pendingRows[idx];
    console.log(`\n---------------------------------------------------------------`);
    console.log(`[${idx + 1}/${pendingRows.length}] Đang xử lý Dòng ${item.rowIndex}: "${item.name}" (Brand: ${item.brand || 'ROOTS'})`);
    if (item.ingredients) {
      console.log(`   [Bao bì gốc] Thành phần: ${item.ingredients.slice(0, 80)}...`);
    }
    console.log(`---------------------------------------------------------------`);

    // Mark as Processing in Sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${tabName}'!${colStatusLetter}${item.rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Đang viết mô tả dài (AI 6 bước)...']] }
    });

    try {
      const res = await pipeline.runFullWorkflow({
        productName: item.name,
        brand: item.brand,
        code: item.code,
        ingredients: item.ingredients,
        storage: item.storage,
        usage: item.usage,
        onProgress: (evt) => {
          console.log(`   [B${evt.step}] ${evt.message}`);
          onRowProgress({ item, evt });
        }
      });

      const nowStr = new Date().toLocaleString('vi-VN');
      const statusText = `Hoàn tất (${res.durationSeconds}s | ${nowStr})`;

      // Update Result to Sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${tabName}'!${colDescLetter}${item.rowIndex}:${colStatusLetter}${item.rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[res.step4Html, statusText]]
        }
      });

      console.log(`✅ ĐÃ CẬP NHẬT GOOGLE SHEET THÀNH CÔNG CHO DÒNG ${item.rowIndex}!`);
    } catch (err) {
      console.error(`❌ Lỗi tại dòng ${item.rowIndex}:`, err.message);
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${tabName}'!${colStatusLetter}${item.rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[`Lỗi: ${err.message.slice(0, 80)}`]] }
      });
    }

    // Polite delay between products
    if (idx < pendingRows.length - 1) {
      console.log(`Chờ 3 giây trước khi sang sản phẩm tiếp theo...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`\n🎉 ĐÃ HOÀN TẤT ĐỢT XỬ LÝ ${pendingRows.length} SẢN PHẨM TRÊN GOOGLE SHEET!`);
  return { processed: pendingRows.length };
}

async function main() {
  const args = parseArgs();

  if (args.continuous) {
    console.log('Chế độ 24/7 đang chạy... Mỗi chu kỳ cách nhau 60 giây.');
    while (true) {
      try {
        const res = await runBatch(args.batch);
        if (res.processed === 0) {
          console.log('Không còn sản phẩm nào cần xử lý. Nghỉ 5 phút rồi kiểm tra lại...');
          await new Promise(r => setTimeout(r, 300000));
        } else {
          console.log(`Nghỉ 10 giây trước đợt kế tiếp...`);
          await new Promise(r => setTimeout(r, 10000));
        }
      } catch (e) {
        console.error('Lỗi chu kỳ 24/7:', e.message);
        await new Promise(r => setTimeout(r, 30000));
      }
    }
  } else {
    await runBatch(args.batch);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Lỗi nghiêm trọng:', err);
    process.exit(1);
  });
}

module.exports = { runBatch, getSheetsClient };
