const fs = require('fs');
let code = fs.readFileSync('src/utils/googleSheetsService.ts', 'utf8');

code += `

export async function importItemsToBranchInSheets(branchId: string, items: any[]): Promise<void> {
  const currentLocals = getLocalBranches();
  const idx = currentLocals.findIndex(b => b.id === branchId);
  if (idx >= 0) {
    currentLocals[idx].items = items;
  } else {
    console.warn('[Google Sheets Service] Branch not found locally for importItems');
  }
  const locals = normalizeBranchesList(currentLocals);
  saveLocalBranches(locals);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const payload = {
      action: 'importItems',
      branchId: branchId,
      items: items,
      branches: locals
    };

    const response = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
  } catch (error) {
    console.error('[Google Sheets Service] Error importing items:', error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
`;

fs.writeFileSync('src/utils/googleSheetsService.ts', code);
