const fs = require('fs');
let code = fs.readFileSync('src/components/MasterDataUploadModal.tsx', 'utf8');

code = code.replace(
  /color:\s*\(r\.scannedQty \?\? 0\) === \(r\.systemQty \?\? 0\)\s*\? \('GREEN' as const\)\s*: \(r\.scannedQty \?\? 0\) < \(r\.systemQty \?\? 0\)\s*\? \('RED' as const\)\s*: \('YELLOW' as const\),\s*\}\)\);/s,
  `color:
          (r.scannedQty ?? 0) === (r.systemQty ?? 0)
            ? ('GREEN' as const)
            : (r.scannedQty ?? 0) < (r.systemQty ?? 0)
            ? ('RED' as const)
            : ('YELLOW' as const),
        };
      });`
);

fs.writeFileSync('src/components/MasterDataUploadModal.tsx', code);
