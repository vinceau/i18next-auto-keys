// transformers/i18nStore.ts
import path from "path";
import { stringPool } from "./stringPool";

export type PoRef = {
  file: string; // e.g. "src/views/MainView.messages.ts"
  line: number; // 1-based
  column: number; // 1-based
};

export type Entry = {
  id: string; // hash key (msgctxt)
  source: string; // English ICU text (msgid)
  refs: Set<string>; // "file:line:column" strings (deduped)
  extractedComments: Set<string>; // "#. comment" lines
  parameterMetadata?: ParameterMetadata; // Parameter names and JSDoc for indexed mode
};

export type ParameterMetadata = {
  parameterNames: string[]; // Parameter names in order
  parameterTypes: string[]; // Parameter types in order
  parameterJSDoc: { [paramName: string]: string }; // JSDoc for each parameter
};

class I18nStore {
  private map = new Map<string, Entry>();

  clear() {
    this.map.clear();
  }

  all(): ReadonlyMap<string, Entry> {
    return this.map;
  }

  /** Adds/merges an entry with reference and comments */
  add(params: { id: string; source: string; ref: PoRef; comments?: string[]; parameterMetadata?: ParameterMetadata }) {
    const key = params.id;
    // Intern the source string to avoid duplication
    const internedSource = stringPool.intern(params.source);

    let e = this.map.get(key);
    if (!e) {
      e = { id: key, source: internedSource, refs: new Set(), extractedComments: new Set() };
      this.map.set(key, e);
    } else {
      // keep latest source if it somehow changed
      e.source = internedSource;
    }

    // Update parameter metadata if provided
    if (params.parameterMetadata) {
      e.parameterMetadata = params.parameterMetadata;
    }

    const refKey = `${params.ref.file}:${params.ref.line}:${params.ref.column}`;
    e.refs.add(refKey);
    if (params.comments) {
      for (const c of params.comments) {
        const trimmed = (c || "").trim();
        if (trimmed) e.extractedComments.add(trimmed);
      }
    }
  }
}

export const i18nStore = new I18nStore();

/** Utility to make a repo-relative, POSIX-style path for PO refs */
export function toRelPosix(abs: string): string {
  return path.relative(process.cwd(), abs).split(path.sep).join("/");
}
