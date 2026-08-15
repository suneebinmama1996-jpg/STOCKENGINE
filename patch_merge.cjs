const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const processed = processItems\(\s*importedItems\.map\(\(item, idx\) => \(\{\s*\.\.\.item,\s*auditDate: effectiveAuditDate,\s*id: \`item-\$\{Date\.now\(\)\}-\$\{idx\}\`,\s*\}\)\)\s*\);\s*const updated: Branch = \{\s*\.\.\.branch,\s*auditDate: effectiveAuditDate,\s*auditScheduleDay: scheduleDay \|\| branch\.auditScheduleDay \|\| 'OTHER',\s*items: processed,\s*\};/s,
  `const newProcessed = processItems(
          importedItems.map((item, idx) => ({
            ...item,
            auditDate: effectiveAuditDate,
            id: \`item-\$\{Date.now()\}-\$\{idx\}\`,
          }))
        );

        // Merge existing items with newly imported items
        const combinedItems = [...branch.items, ...newProcessed];

        const updated: Branch = {
          ...branch,
          auditDate: effectiveAuditDate,
          auditScheduleDay: scheduleDay || branch.auditScheduleDay || 'OTHER',
          items: combinedItems,
        };`
);

fs.writeFileSync('src/App.tsx', code);
