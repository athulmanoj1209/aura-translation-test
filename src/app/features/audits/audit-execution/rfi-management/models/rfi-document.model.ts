// ── Per-file upload entry (Add RFI) ───────────────────────────────────────────
export interface UploadedFileEntry {
  file: File;
  description: string;
}

// ── Static backend document entry (View RFI) ──────────────────────────────────
export interface StaticDoc {
  name: string;
  url: string;
  description: string;
}
