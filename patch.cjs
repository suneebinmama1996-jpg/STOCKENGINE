const fs = require('fs');
let code = fs.readFileSync('src/utils/excelParser.ts', 'utf8');

code = code.replace(
  /function processRawRows.*?const name =.*?สินค้า \$\{sku\}`;/s,
  `function processRawRows(rows: ImportedRow[]): Omit<StockItem, 'id'>[] {
  return rows.map((row, index) => {
    const record = row as Record<string, unknown>;
    
    const barcodeRaw = getValueFromRow(record, ['บาร์โค้ด', 'barcode', 'รหัสสินค้า', 'sku', 'productcode']);
    const skuRaw = getValueFromRow(record, ['รหัสสินค้า', 'sku', 'productcode', 'barcode', 'บาร์โค้ด']);
    const sku = skuRaw || barcodeRaw || \`SKU-\${index + 1001}\`;
    const barcode = barcodeRaw || sku;
    
    const name = getValueFromRow(record, ['ชื่อสินค้า', 'name', 'productname', 'description', 'รายละเอียด']) || \`สินค้า \${sku}\`;`
);

fs.writeFileSync('src/utils/excelParser.ts', code);
