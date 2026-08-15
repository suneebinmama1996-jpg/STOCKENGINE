const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /saveBranch,\s*safeGetLocalStorage/s,
  `saveBranch,\n  importItemsToBranchInSheets,\n  safeGetLocalStorage`
);

code = code.replace(
  /const handleImportItemsToBranch = async \((.*?)\) => \{(.*?)try \{(.*?)if \(isNewBranch\) \{(.*?)try \{(.*?)await saveBranch\(newBranch\);(.*?)catch \(e\) \{(.*?)\} else \{(.*?)try \{(.*?)await saveBranch\(updated\);(.*?)catch \(e\) \{(.*?)catch \(err\) \{/s,
  `const handleImportItemsToBranch = async ($1) => {$2try {$3if (isNewBranch) {$4try {$5await saveBranch(newBranch);$6catch (e) {$7} else {$8try {$9await importItemsToBranchInSheets(updated.id, updated.items);$10catch (e) {$11catch (err) {`
);

fs.writeFileSync('src/App.tsx', code);
