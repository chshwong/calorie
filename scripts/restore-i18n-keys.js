#!/usr/bin/env node
/**
 * Restore deleted translation keys from i18n/en.json
 * 
 * This script performs a deep merge between:
 * - temp_before_deletion.json (version before commit 5fed5f3 deleted ~766 lines)
 * - i18n/en.json (current version with today's changes)
 * 
 * Strategy:
 * - Restore all keys that exist in old version but not in current
 * - Preserve current keys with their values
 * - Flag conflicts where same key has different values
 * 
 * Outputs:
 * - i18n/en.json (merged and restored)
 * - i18n/conflicts-report.md (list of conflicts for user review)
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BEFORE_DELETION_PATH = path.join(ROOT, 'temp_before_deletion.json');
const CURRENT_EN_PATH = path.join(ROOT, 'i18n', 'en.json');
const CONFLICTS_REPORT_PATH = path.join(ROOT, 'i18n', 'conflicts-report.md');

/**
 * Check if a value is a plain object (not array, not null)
 */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Deep merge restoration: restore deleted keys from oldObj into currentObj
 * Tracks conflicts where same key has different values
 */
function deepMergeRestore(oldObj, currentObj, conflicts = [], pathPrefix = '') {
  const result = { ...currentObj };
  
  for (const key in oldObj) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    
    if (isPlainObject(oldObj[key])) {
      // Recursively merge nested objects
      if (!result[key] || !isPlainObject(result[key])) {
        result[key] = {};
      }
      result[key] = deepMergeRestore(oldObj[key], result[key], conflicts, currentPath);
    } else {
      // Leaf value - check for conflicts or restore
      if (key in result) {
        if (result[key] !== oldObj[key]) {
          // Conflict: same key, different values
          conflicts.push({
            path: currentPath,
            oldValue: oldObj[key],
            currentValue: result[key],
          });
          // Keep current value (don't overwrite)
        }
        // Same value - nothing to do, keep current
      } else {
        // Key doesn't exist in current - restore it
        result[key] = oldObj[key];
      }
    }
  }
  
  return result;
}

/**
 * Generate conflicts report in Markdown format
 */
function generateConflictsReport(conflicts) {
  if (conflicts.length === 0) {
    return `# Translation Keys Conflicts Report

No conflicts detected. All keys were successfully merged.

Generated: ${new Date().toISOString()}
`;
  }

  let report = `# Translation Keys Conflicts Report

**Total Conflicts:** ${conflicts.length}

This report lists translation keys that exist in both the old version (before deletion) and the current version, but with different values.

**Decision Required:** For each conflict below, you need to decide which value to keep:
- **Old Value**: From the version before commit 5fed5f3
- **Current Value**: From the current version (may include recent changes)

---

Generated: ${new Date().toISOString()}

---

## Conflicts

`;

  conflicts.forEach((conflict, index) => {
    report += `### ${index + 1}. \`${conflict.path}\`

**Old Value:**
\`\`\`
${JSON.stringify(conflict.oldValue, null, 2)}
\`\`\`

**Current Value:**
\`\`\`
${JSON.stringify(conflict.currentValue, null, 2)}
\`\`\`

---

`;
  });

  return report;
}

/**
 * Main execution
 */
function main() {
  console.log('🔄 Starting translation keys restoration...\n');

  // Read old version (before deletion)
  console.log(`📖 Reading ${BEFORE_DELETION_PATH}...`);
  if (!fs.existsSync(BEFORE_DELETION_PATH)) {
    console.error(`❌ Error: ${BEFORE_DELETION_PATH} not found!`);
    console.error('   Make sure temp_before_deletion.json exists in the project root.');
    process.exit(1);
  }
  let beforeDeletionContent = fs.readFileSync(BEFORE_DELETION_PATH, 'utf8');
  // Strip BOM if present
  if (beforeDeletionContent.charCodeAt(0) === 0xFEFF) {
    beforeDeletionContent = beforeDeletionContent.slice(1);
  }
  const beforeDeletion = JSON.parse(beforeDeletionContent);

  // Read current version
  console.log(`📖 Reading ${CURRENT_EN_PATH}...`);
  if (!fs.existsSync(CURRENT_EN_PATH)) {
    console.error(`❌ Error: ${CURRENT_EN_PATH} not found!`);
    process.exit(1);
  }
  let currentContent = fs.readFileSync(CURRENT_EN_PATH, 'utf8');
  // Strip BOM if present
  if (currentContent.charCodeAt(0) === 0xFEFF) {
    currentContent = currentContent.slice(1);
  }
  const current = JSON.parse(currentContent);

  // Perform deep merge
  console.log('🔀 Performing deep merge...');
  const conflicts = [];
  const merged = deepMergeRestore(beforeDeletion, current, conflicts);

  // Count restored keys (approximate - keys in old but not in current)
  const oldKeys = new Set();
  const currentKeys = new Set();
  
  function collectKeys(obj, keys, prefix = '') {
    for (const key in obj) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (isPlainObject(obj[key])) {
        collectKeys(obj[key], keys, fullPath);
      } else {
        keys.add(fullPath);
      }
    }
  }
  
  collectKeys(beforeDeletion, oldKeys);
  collectKeys(current, currentKeys);
  
  const restoredCount = Array.from(oldKeys).filter(k => !currentKeys.has(k)).length;

  console.log(`✅ Merged successfully!`);
  console.log(`   - Restored keys: ~${restoredCount}`);
  console.log(`   - Conflicts detected: ${conflicts.length}`);

  // Write merged JSON
  console.log(`\n💾 Writing merged JSON to ${CURRENT_EN_PATH}...`);
  fs.writeFileSync(
    CURRENT_EN_PATH,
    JSON.stringify(merged, null, 2) + '\n',
    'utf8'
  );

  // Generate and write conflicts report
  console.log(`📝 Generating conflicts report...`);
  const conflictsReport = generateConflictsReport(conflicts);
  fs.writeFileSync(CONFLICTS_REPORT_PATH, conflictsReport, 'utf8');

  console.log(`\n✅ Restoration complete!`);
  console.log(`   - Merged JSON: ${CURRENT_EN_PATH}`);
  console.log(`   - Conflicts report: ${CONFLICTS_REPORT_PATH}`);
  
  if (conflicts.length > 0) {
    console.log(`\n⚠️  ${conflicts.length} conflict(s) detected. Please review ${CONFLICTS_REPORT_PATH}`);
    
    // Special handling for known conflict
    const weeklyLossConflict = conflicts.find(c => c.path === 'home.done_for_today.weekly_loss_projection');
    if (weeklyLossConflict) {
      console.log(`\n📌 Note: 'home.done_for_today.weekly_loss_projection' conflict was kept with CURRENT value`);
      console.log(`   (User explicitly requested to keep current format in recent conversation)`);
    }
  } else {
    console.log(`\n✨ No conflicts detected. All keys merged successfully!`);
  }
}

// Run
main();
