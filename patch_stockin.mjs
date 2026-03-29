import { readFileSync, writeFileSync } from 'fs';

const file = new URL('./src/components/StockIn.jsx', import.meta.url).pathname.slice(1);
let src = readFileSync(file, 'utf8');

// ── 1. Make expiry date field visually required ──────────────────────────────
const oldExpiry = `                 {/* Expiry Date (Optional) \u2014 2 cols */}
                 <div className="col-span-12 md:col-span-2">
                    <label className={LabelClass}>\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0627\u0646\u062a\u0647\u0627\u0621</label>
                    <input 
                      type="date" 
                      className={\`\${InputClass} text-xs font-bold text-slate-600 dark:text-slate-400\`} 
                      disabled={!selectedItemModel}
                      value={draftExpiryDate} 
                      onChange={e => setDraftExpiryDate(e.target.value)}
                    />
                 </div>`;

const newExpiry = `                 {/* Expiry Date (REQUIRED) \u2014 2 cols */}
                 <div className="col-span-12 md:col-span-2">
                    <label className={LabelClass}>
                      \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0627\u0646\u062a\u0647\u0627\u0621 <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="date" 
                      className={\`\${InputClass} text-xs font-bold \${
                        selectedItemModel && !draftExpiryDate
                          ? 'border-rose-400 dark:border-rose-500 ring-2 ring-rose-400/20'
                          : draftExpiryDate
                          ? 'border-emerald-400 dark:border-emerald-500 text-slate-700 dark:text-slate-200'
                          : 'text-slate-600 dark:text-slate-400'
                      }\`}
                      disabled={!selectedItemModel}
                      value={draftExpiryDate} 
                      onChange={e => setDraftExpiryDate(e.target.value)}
                    />
                    {selectedItemModel && !draftExpiryDate && (
                      <p className="text-[10px] text-rose-500 font-bold mt-0.5">\u26a0\ufe0f \u0645\u0637\u0644\u0648\u0628 \u0644\u0644\u062a\u062c\u0645\u064a\u062f \u0648\u0627\u0644\u062a\u0628\u0631\u064a\u062f</p>
                    )}
                 </div>`;

if (src.includes(oldExpiry)) {
  src = src.replace(oldExpiry, newExpiry);
  writeFileSync(file, src, 'utf8');
  console.log('✅ Expiry field updated to required');
} else {
  // Try to find and report what's actually there
  const idx = src.indexOf('Expiry Date');
  if (idx !== -1) {
    console.log('Found "Expiry Date" at char', idx);
    console.log('Context:', JSON.stringify(src.slice(idx - 20, idx + 200)));
  } else {
    console.log('❌ "Expiry Date" not found in file');
    // Show lines around 900
    const lines = src.split('\n');
    lines.slice(895, 915).forEach((l, i) => console.log(896 + i + ':', JSON.stringify(l)));
  }
}
