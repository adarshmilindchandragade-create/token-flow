#!/usr/bin/env node
// scripts/dogfood.js — TokenFlow self-dogfooding measurement
// Runs the full optimizer pipeline on the TokenFlow source tree itself
// and prints a detailed token savings report.
//
// Usage:
//   node scripts/dogfood.js [--strip-comments]
//   node scripts/dogfood.js --file src/extension.ts
//
// Output:
//   Raw tokens, optimized tokens, savings %, per-stage breakdown,
//   and a cost estimate for each configured provider.

const fs = require('fs');
const path = require('path');

// ─── Configuration ─────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const STRIP_COMMENTS = process.argv.includes('--strip-comments');
const SINGLE_FILE = (() => {
  const idx = process.argv.indexOf('--file');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// Provider pricing ($/M tokens) — mirrors PricingCatalog.ts
// ADR-005: PricingCatalog is the single source of truth. This local copy
// is a temporary duplicate pending the tsx/dist-import decision (ADR-005 §Migration step 3).
// When updating model pricing, update PricingCatalog.ts FIRST, then sync here.
// TODO(M4): replace this table with a require('../dist/providers/models/PricingCatalog') import.
const PRICING = {
  'google/gemma-3-12b-it:free':          { input: 0,     output: 0     },
  'claude-3-5-sonnet-20241022':          { input: 3.0,   output: 15.0  },
  'claude-3-haiku-20240307':             { input: 0.25,  output: 1.25  },
  'meta-llama/llama-3.1-8b-instruct':   { input: 0.055, output: 0.055 },
  'deepseek/deepseek-r1':               { input: 0.55,  output: 2.19  },
};

// Extensions to include (mirrors fileFilter.ts TEXT_EXTENSIONS)
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.json', '.md', '.yaml', '.yml',
]);

// Directories to exclude (mirrors EXCLUDED_PATH_SEGMENTS)
const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'out', '.git', 'coverage', 'build',
]);

// ─── File collection ────────────────────────────────────────────────────────

function collectFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        collectFiles(path.join(dir, entry.name), results);
      }
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.has(ext)) {
        results.push(path.join(dir, entry.name));
      }
    }
  }
  return results;
}

// ─── Token counting (character-based estimate: 1 token ≈ 4 chars) ──────────

function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// ─── Optimizer stages (mirrors tokenOptimizer.ts) ──────────────────────────

function stripComments(content) {
  let result = content.replace(/\/\*[\s\S]*?\*\//g, '');
  result = result.replace(/^\s*\/\/.*$/gm, '');
  result = result.replace(/^(\s*)#(?!\s*!).*$/gm, '$1');
  return result;
}

function collapseWhitespace(content) {
  return content.replace(/\n{3,}/g, '\n\n');
}

function truncateLongCodeBlocks(content) {
  const MAX = 50;
  const KEEP = 25;
  return content.replace(/```[\s\S]*?```/g, (block) => {
    const lines = block.split('\n');
    if (lines.length <= MAX) return block;
    const head = lines.slice(0, KEEP);
    const tail = lines.slice(-KEEP);
    const omitted = lines.length - MAX;
    const notice = `\n... [${omitted} lines omitted by TokenFlow optimizer] ...\n`;
    return [...head, notice, ...tail].join('\n');
  });
}

function deduplicateSections(content) {
  const sep = '\n\n### ';
  const parts = content.split(sep);
  const seen = new Set();
  const unique = [];
  for (const part of parts) {
    const key = part.split('\n')[0] ?? part;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(part);
    }
  }
  return unique.join(sep);
}

// ─── Serialization (mirrors contextBuilder.ts) ──────────────────────────────

function serializeFile(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).slice(1);
  return `### File: ${rel}\n\n\`\`\`${ext}\n${content}\n\`\`\``;
}

// ─── Cost calculation ────────────────────────────────────────────────────────

function estimateCost(model, inputTokens, outputTokens = 500) {
  const p = PRICING[model];
  if (!p) return null;
  return ((p.input * inputTokens + p.output * outputTokens) / 1_000_000).toFixed(5);
}

// ─── Pretty printing ─────────────────────────────────────────────────────────

function bar(pct, width = 30) {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function fmt(n) {
  return n.toLocaleString().padStart(9);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           TokenFlow AI — Self-Dogfooding Report              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Collect files
  const files = SINGLE_FILE
    ? [path.resolve(ROOT, SINGLE_FILE)]
    : collectFiles(ROOT);

  console.log(`📁 Files collected: ${files.length}`);
  if (STRIP_COMMENTS) console.log('✂️  Comment stripping: ON');
  console.log('');

  // Serialize
  const rawContent = files.map(serializeFile).join('\n\n');
  const rawTokens = countTokens(rawContent);

  // Stage 1: Comment strip (optional)
  let stage1 = rawContent;
  const stage1Tokens_before = rawTokens;
  if (STRIP_COMMENTS) {
    stage1 = stripComments(stage1);
  }
  const stage1Tokens = countTokens(stage1);

  // Stage 2: Whitespace collapse
  const stage2 = collapseWhitespace(stage1);
  const stage2Tokens = countTokens(stage2);

  // Stage 3: Block truncation
  const stage3 = truncateLongCodeBlocks(stage2);
  const stage3Tokens = countTokens(stage3);

  // Stage 4: Deduplication
  const stage4 = deduplicateSections(stage3);
  const stage4Tokens = countTokens(stage4);

  const savedTokens = rawTokens - stage4Tokens;
  const savingsPct = rawTokens > 0 ? Math.round((savedTokens / rawTokens) * 100) : 0;

  // ─── Output ───────────────────────────────────────────────────────────────

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ Optimizer Pipeline                                           │');
  console.log('├──────────────────────────┬────────────┬──────────┬──────────┤');
  console.log('│ Stage                    │    Tokens  │   Delta  │ % Saved  │');
  console.log('├──────────────────────────┼────────────┼──────────┼──────────┤');

  const stages = [
    ['Raw (before)', rawTokens, 0],
    ['1. Comment strip', stage1Tokens, stage1Tokens_before - stage1Tokens],
    ['2. Whitespace collapse', stage2Tokens, stage1Tokens - stage2Tokens],
    ['3. Block truncation', stage3Tokens, stage2Tokens - stage3Tokens],
    ['4. Deduplication', stage4Tokens, stage3Tokens - stage4Tokens],
  ];

  for (const [label, tokens, delta] of stages) {
    const pct = rawTokens > 0 ? Math.round((delta / rawTokens) * 100) : 0;
    const sign = delta > 0 ? `-${delta.toLocaleString()}` : (delta < 0 ? `+${Math.abs(delta).toLocaleString()}` : '–');
    console.log(
      `│ ${label.padEnd(24)} │ ${tokens.toLocaleString().padStart(10)} │ ${sign.padStart(8)} │ ${(pct > 0 ? pct + '%' : '').padStart(8)} │`
    );
  }

  console.log('├──────────────────────────┼────────────┼──────────┼──────────┤');
  console.log(
    `│ ${'TOTAL SAVED'.padEnd(24)} │ ${savedTokens.toLocaleString().padStart(10)} │          │ ${(savingsPct + '%').padStart(8)} │`
  );
  console.log('└──────────────────────────┴────────────┴──────────┴──────────┘');

  console.log(`\n${bar(savingsPct)} ${savingsPct}% saved\n`);

  // ─── Cost comparison ──────────────────────────────────────────────────────

  console.log('┌──────────────────────────────────────────────────────────────┐');
  console.log('│ Cost Estimate (input + 500 assumed output tokens)             │');
  console.log('├──────────────────────────────────┬───────────┬───────────────┤');
  console.log('│ Model                            │ Without TF│    With TF    │');
  console.log('├──────────────────────────────────┼───────────┼───────────────┤');

  for (const [model, pricing] of Object.entries(PRICING)) {
    const costBefore = estimateCost(model, rawTokens);
    const costAfter = estimateCost(model, stage4Tokens);
    const displayModel = model.length > 32 ? model.slice(0, 31) + '…' : model;
    const costBeforeStr = pricing.input === 0 ? '    $0.00000' : `   $${costBefore}`;
    const costAfterStr =  pricing.input === 0 ? '       $0.00000' : `      $${costAfter}`;
    console.log(
      `│ ${displayModel.padEnd(32)} │ ${costBeforeStr.padStart(9)} │ ${costAfterStr.padStart(13)} │`
    );
  }

  console.log('└──────────────────────────────────┴───────────┴───────────────┘');

  // ─── Summary ──────────────────────────────────────────────────────────────

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  Raw: ${fmt(rawTokens)} tokens → Optimized: ${fmt(stage4Tokens)} tokens  ║`);
  console.log(`║  Saved: ${fmt(savedTokens)} tokens (${savingsPct}%)                        ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Write machine-readable results
  const resultsPath = path.join(ROOT, '.dogfood-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    files: files.length,
    stripComments: STRIP_COMMENTS,
    rawTokens,
    optimizedTokens: stage4Tokens,
    savedTokens,
    savingsPct,
    stages: {
      raw: rawTokens,
      afterCommentStrip: stage1Tokens,
      afterWhitespace: stage2Tokens,
      afterTruncation: stage3Tokens,
      afterDedup: stage4Tokens,
    },
  }, null, 2));

  console.log(`📊 Results written to .dogfood-results.json`);
}

main();
