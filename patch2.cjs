const fs = require('fs');
let code = fs.readFileSync('src/components/MasterDataUploadModal.tsx', 'utf8');

code = code.replace(
  /const items = rows\.map\(\(r, i\) => \(\{\s*sku:.*?\s*barcode:.*?\s*name:.*?\s*location:.*?\s*category:.*?\s*systemQty:.*?\s*scannedQty:.*?\s*variance/s,
  `const items = rows.map((r, i) => {
        const rSku = r.sku || r.SKU || r.productcode || '';
        const rBarcode = r.barcode || r.Barcode || r.BarCode || '';
        const barcodeVal = String(rBarcode || rSku || \`BC-\${i + 1}\`).trim();
        const skuVal = String(rSku || rBarcode || \`SKU-\${i + 1}\`).trim();
        
        return {
        sku: skuVal,
        barcode: barcodeVal,
        name: String(r.name || r.Name || r.productName || \`Item \${i + 1}\`).trim(),
        location: String(r.location || r.Location || r.bin || 'A-01').trim(),
        category: String(r.category || r.Category || 'General').trim(),
        systemQty: Number(r.systemQty ?? r.system_qty ?? r.qty ?? r.quantity ?? r['จำนวนตามระบบ'] ?? 0),
        scannedQty: Number(r.scannedQty ?? r.scanned_qty ?? r['จำนวนสแกนจริง'] ?? 0),
        variance`
);

fs.writeFileSync('src/components/MasterDataUploadModal.tsx', code);
