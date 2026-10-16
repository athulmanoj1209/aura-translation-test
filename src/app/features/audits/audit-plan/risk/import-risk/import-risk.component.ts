import { Component, EventEmitter, inject, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule, FileSelectEvent } from 'primeng/fileupload';
import { TooltipModule } from 'primeng/tooltip';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import {
  Risk, RiskType, ControlEffectiveness, RiskStatus,
  calcInherent, calcResidualScore, calcResidualLevel,
} from '../models/risk.model';

/* ── Row shape after parsing ─────────────────────────────────────── */
export interface ImportRow {
  rowIndex:             number;
  title:                string;
  riskType:             string;
  description:          string;
  department:           string;
  impact:               number | null;
  likelihood:           number | null;
  keyControls:          string;
  controlEffectiveness: string;
  owner:                string;
  status:               string;
  linkedScopes:         string;
  errors:               string[];
  valid:                boolean;
}

/* ── Valid option sets for validation ────────────────────────────── */
const VALID_TYPES: RiskType[] = [
  'strategic','operational','financial','compliance','it','aml_cft','reputational','other',
];
const VALID_CE: ControlEffectiveness[] = ['strong','moderate','weak'];
const VALID_STATUSES: RiskStatus[]     = ['open','monitored','closed'];

@Component({
  selector: 'app-import-risk',
  standalone: true,
  imports: [CommonModule, ButtonModule, DialogModule, FileUploadModule, TooltipModule, DrawIconComponent],
  templateUrl: './import-risk.component.html',
  styleUrl: './import-risk.component.scss',
})
export class ImportRiskComponent {
  @Output() imported = new EventEmitter<Partial<Risk>[]>();

  readonly visible     = signal(false);
  readonly step        = signal<'upload' | 'preview'>('upload');
  readonly rows        = signal<ImportRow[]>([]);
  readonly fileName    = signal('');
  readonly parseError  = signal('');
  readonly importing   = signal(false);

  get validRows()   { return this.rows().filter(r => r.valid); }
  get invalidRows() { return this.rows().filter(r => !r.valid); }

  open()  { this.visible.set(true); this.reset(); }
  close() { this.visible.set(false); }

  private reset() {
    this.step.set('upload');
    this.rows.set([]);
    this.fileName.set('');
    this.parseError.set('');
    this.importing.set(false);
  }

  /* ── Template download ─────────────────────────────────────────── */
  downloadTemplate(): void {
    const headers = [
      'Risk Title*', 'Risk Type*', 'Description*', 'Sub-Division*',
      'Impact (1-5)*', 'Likelihood (1-5)*', 'Key Controls',
      'Control Effectiveness (strong/moderate/weak)*', 'Owner*',
      'Status (open/monitored/closed)',
    ];
    const example = [
      'Unreconciled GL entries', 'financial',
      'GL accounts not reconciled on time', 'Finance',
      '4', '4', 'Monthly reconciliation policy',
      'moderate', 'Finance Manager', 'open', 
    ];

    const csvContent = [headers.join(','), example.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'risk_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ── File selection ────────────────────────────────────────────── */
  onFileSelected(event: FileSelectEvent): void {
    const file = (event.files as FileList | File[])[0];
    if (!file) return;
    this.fileName.set(file.name);
    this.parseError.set('');

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      this.parseCSV(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      this.parseExcel(file);
    } else {
      this.parseError.set('Unsupported file type. Please upload a .csv or .xlsx file.');
    }
  }

  /* ── CSV parser ────────────────────────────────────────────────── */
  private parseCSV(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) { this.parseError.set('Could not read file.'); return; }

      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        this.parseError.set('File has no data rows. Download the template and fill in at least one row.');
        return;
      }

      // Skip header row (index 0)
      const dataRows = lines.slice(1);
      const parsed   = dataRows.map((line, i) => this.parseRow(line.split(','), i + 2));
      this.rows.set(parsed);
      this.step.set('preview');
    };
    reader.readAsText(file);
  }

  /* ── Excel parser (uses SheetJS if available, falls back to CSV read) */
  private parseExcel(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        /* Try SheetJS — bundled in many Angular projects via xlsx package */
        const XLSX = (window as any)['XLSX'];
        if (XLSX) {
          const data    = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet   = workbook.Sheets[workbook.SheetNames[0]];
          const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          if (rows.length < 2) {
            this.parseError.set('Spreadsheet has no data rows.');
            return;
          }
          const parsed = rows.slice(1).map((row, i) => this.parseRow(row.map(String), i + 2));
          this.rows.set(parsed);
          this.step.set('preview');
        } else {
          this.parseError.set('SheetJS (xlsx) library not found. Please use a CSV file or install the xlsx package: npm i xlsx');
        }
      } catch (err) {
        this.parseError.set('Failed to parse Excel file. Please use the CSV template instead.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ── Row parser & validator ────────────────────────────────────── */
  private parseRow(cols: string[], rowIndex: number): ImportRow {
    const [
      title = '', riskType = '', description = '', department = '',
      impactStr = '', likelihoodStr = '', keyControls = '',
      controlEffectiveness = '', owner = '', status = '', linkedScopes = '',
    ] = cols.map(c => c.trim().replace(/^"|"$/g, ''));

    const errors: string[] = [];

    if (!title)       errors.push('Risk Title is required');
    if (!description) errors.push('Description is required');
    if (!department)  errors.push('Sub-Division is required');
    if (!owner)       errors.push('Owner is required');

    const impact     = parseInt(impactStr, 10);
    const likelihood = parseInt(likelihoodStr, 10);
    if (!impactStr || isNaN(impact) || impact < 1 || impact > 5)
      errors.push('Impact must be 1–5');
    if (!likelihoodStr || isNaN(likelihood) || likelihood < 1 || likelihood > 5)
      errors.push('Likelihood must be 1–5');

    const normType = riskType.toLowerCase().replace(/[^a-z_/]/g, '').replace('/', '_');
    if (!VALID_TYPES.includes(normType as RiskType))
      errors.push(`Risk Type "${riskType}" is invalid. Use: ${VALID_TYPES.join(', ')}`);

    const normCE = controlEffectiveness.toLowerCase();
    if (!VALID_CE.includes(normCE as ControlEffectiveness))
      errors.push(`Control Effectiveness "${controlEffectiveness}" is invalid. Use: strong, moderate, weak`);

    const normStatus = (status || 'open').toLowerCase();
    if (!VALID_STATUSES.includes(normStatus as RiskStatus))
      errors.push(`Status "${status}" is invalid. Use: open, monitored, closed`);

    return {
      rowIndex, title, riskType, description, department,
      impact: isNaN(impact) ? null : impact,
      likelihood: isNaN(likelihood) ? null : likelihood,
      keyControls, controlEffectiveness, owner, status, linkedScopes,
      errors, valid: errors.length === 0,
    };
  }

  /* ── Confirm import ────────────────────────────────────────────── */
  confirmImport(): void {
    if (!this.validRows.length) return;
    this.importing.set(true);

    const risks: Partial<Risk>[] = this.validRows.map((row, i) => {
      const impact     = row.impact!;
      const likelihood = row.likelihood!;
      const ce         = row.controlEffectiveness.toLowerCase() as ControlEffectiveness;
      const inherent   = calcInherent(impact, likelihood);
      const residual   = calcResidualScore(inherent, ce);

      return {
        id:                   `RSK-${String(Date.now() + i).slice(-4)}`,
        title:                row.title,
        riskType:             row.riskType.toLowerCase() as RiskType,
        description:          row.description,
        subDivision:          row.department,
        impact, likelihood,
        inherentScore:        inherent,
        keyControls:          row.keyControls || undefined,
        controlEffectiveness: ce,
        residualScore:        residual,
        residualLevel:        calcResidualLevel(residual),
        owner:                row.owner,
        status:               (row.status.toLowerCase() || 'open') as RiskStatus,
        linkedScopes:         row.linkedScopes ? row.linkedScopes.split(';').map(s => s.trim()) : [],
        linkedFindings:       [],
        linkedObservations:   [],
        supportingFiles:      [],
        dateIdentified:       new Date(),
        lastUpdated:          new Date(),
      };
    });

    this.imported.emit(risks);
    this.importing.set(false);
    this.close();
  }

  goBack() { this.step.set('upload'); this.rows.set([]); this.fileName.set(''); }

  typeLabel(t: string): string {
    const map: Record<string, string> = {
      strategic:'Strategic', operational:'Operational', financial:'Financial',
      compliance:'Compliance', it:'IT', aml_cft:'AML/CFT', reputational:'Reputational', other:'Other',
    };
    return map[t.toLowerCase()] ?? t;
  }
}