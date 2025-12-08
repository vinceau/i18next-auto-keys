import fs from "fs";
import { sync as globSync } from "glob";
import { normalizeGlobPattern } from "../utils/glob";
import { loadGettextParser } from "../loadGettextParser";

export type SyncPoOptions = {
  template: string;
  poFiles: string[];
  backup?: boolean;
};

/**
 * Syncs existing .po files with new strings from a PO template.
 * Preserves existing translations and adds new entries.
 */
export async function syncPoFiles(options: SyncPoOptions): Promise<void> {
  const { template, poFiles, backup = false } = options;

  console.log(`🔄 Syncing .po files from template: ${template}`);

  // Check if template exists
  if (!fs.existsSync(template)) {
    throw new Error(`Template file not found: ${template}`);
  }

  // Find all .po files matching the patterns (normalize for cross-platform compatibility)
  const allPoFiles: string[] = [];
  for (const pattern of poFiles) {
    const matches = globSync(normalizeGlobPattern(pattern), { absolute: true });
    allPoFiles.push(...matches);
  }

  // Remove duplicates
  const uniquePoFiles = [...new Set(allPoFiles)];
  console.log(`📁 Found ${uniquePoFiles.length} .po files to sync`);

  if (uniquePoFiles.length === 0) {
    console.warn("⚠️  No .po files found matching the patterns");
    return;
  }

  // Sync each .po file
  for (const poFile of uniquePoFiles) {
    try {
      await msgmergeJs(poFile, template, poFile, backup);
    } catch (error) {
      console.error(`❌ Error syncing ${poFile}:`, error);
    }
  }

  console.log(`✅ Synced ${uniquePoFiles.length} .po files`);
}

/**
 * Merge an existing .po with an updated .pot template.
 * Keeps existing translations, adds new msgids.
 */
async function msgmergeJs(oldPoPath: string, newPotPath: string, outPath: string, backup: boolean = false) {
  const gettextParser = await loadGettextParser();

  // Create backup if requested
  if (backup && fs.existsSync(oldPoPath)) {
    const backupPath = `${oldPoPath}.backup`;
    fs.copyFileSync(oldPoPath, backupPath);
    console.log(`📋 Created backup: ${backupPath}`);
  }

  const oldPo = gettextParser.po.parse(fs.readFileSync(oldPoPath));
  const newPot = gettextParser.po.parse(fs.readFileSync(newPotPath));

  const merged = newPot;

  // Copy translations over when msgid+msgctxt match
  for (const [ctx, ctxEntries] of Object.entries(oldPo.translations)) {
    const mergedCtx = merged.translations[ctx] || {};
    for (const [msgid, oldEntry] of Object.entries(ctxEntries as any)) {
      if (!msgid) continue; // skip header
      const oldEntryTyped = oldEntry as any;
      const newEntry = mergedCtx[msgid] as any;
      if (newEntry) {
        // Preserve existing translation and comments
        newEntry.msgstr = oldEntryTyped.msgstr;
        if (oldEntryTyped.comments) {
          newEntry.comments = { ...oldEntryTyped.comments, ...newEntry.comments };
        }
      } else {
        // msgid removed from template — skip obsolete entries (don't add to merged file)
        console.log(`🗑️  Removing obsolete translation: ${oldEntryTyped.msgctxt || msgid}`);
      }
    }
    merged.translations[ctx] = mergedCtx;
  }

  // Update headers from the old file (preserve language info, etc.)
  merged.headers = { ...merged.headers, ...oldPo.headers };
  merged.headers["po-revision-date"] = new Date().toISOString();

  const outBuf = gettextParser.po.compile(merged, { sort: true });
  fs.writeFileSync(outPath, outBuf);
  console.log(`🔄 Merged ${oldPoPath} + ${newPotPath} → ${outPath}`);
}
