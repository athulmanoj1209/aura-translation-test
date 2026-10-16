import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { AddRiskOwner, OwnerEntry } from '../add-risk-owner/add-risk-owner.component';
import { ConfirmActionDialogComponent } from '@/app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
export interface RiskOwnerItem {
  id: number;
  name: string;
  description: string;
  createdOn: string;
  status: 'active' | 'inactive';
}

@Component({
  selector: 'app-risk-owner-list',
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, TableModule, TooltipModule, DialogModule, TagModule, AddRiskOwner, ConfirmActionDialogComponent, PaginationBarComponent, DrawIconComponent],
  templateUrl: './risk-owner-list.component.html',
  styleUrl: './risk-owner-list.component.scss',
})
export class RiskOwnerListComponent {
  showAddDialog = false;
  dialogMode: 'add' | 'edit' = 'add';
  editingItem: OwnerEntry | null = null;
  editingId: number | null = null;

  showViewDialog = false;
  viewingItem: RiskOwnerItem | null = null;

  showConfirmDialog = false;
  confirmTarget: { id: number; name: string } | null = null;

  searchQuery = '';
  pageSize = 10;
  currentPage = 0;

  sortField: 'name' | 'createdOn' | null = null;
  sortDir: 'asc' | 'desc' = 'asc';

  riskOwners: RiskOwnerItem[] = [
    { id: 1,  name: 'Chief Executive Officer (CEO)',    description: 'Holds ultimate accountability for enterprise-wide risk governance and strategic risk decisions.',                               createdOn: '2026-01-06', status: 'active' },
    { id: 2,  name: 'Chief Risk Officer (CRO)',         description: 'Responsible for overseeing the organisation\'s overall risk management framework and policies.',                               createdOn: '2026-01-08', status: 'active' },
    { id: 3,  name: 'Chief Financial Officer (CFO)',    description: 'Owns financial and liquidity risk, including budget controls and financial reporting integrity.',                               createdOn: '2026-01-10', status: 'active' },
    { id: 4,  name: 'Chief Operating Officer (COO)',    description: 'Accountable for operational risks arising from business processes, systems, and daily operations.',                            createdOn: '2026-01-13', status: 'active' },
    { id: 5,  name: 'Chief Compliance Officer (CCO)',   description: 'Oversees compliance risk and ensures adherence to regulatory requirements and internal policies.',                             createdOn: '2026-01-16', status: 'active' },
    { id: 6,  name: 'Head of Internal Audit',           description: 'Leads the internal audit function and owns audit-related risk assessments and findings.',                                      createdOn: '2026-01-20', status: 'active' },
    { id: 7,  name: 'Department Head',                  description: 'Accountable for risks within their specific business unit or functional department.',                                          createdOn: '2026-01-24', status: 'active' },
    { id: 8,  name: 'Branch Manager',                   description: 'Responsible for identifying and managing risks at the branch or regional office level.',                                       createdOn: '2026-01-28', status: 'active' },
    { id: 9,  name: 'IT / Systems Manager',             description: 'Owns technology and cybersecurity risks related to infrastructure, data, and systems availability.',                           createdOn: '2026-02-03', status: 'active' },
    { id: 10, name: 'Human Resources Manager',          description: 'Accountable for people-related risks including talent, conduct, and labour compliance.',                                       createdOn: '2026-02-07', status: 'active' },
    { id: 11, name: 'Legal Counsel',                    description: 'Responsible for legal and contractual risks, litigation exposure, and regulatory legal obligations.',                          createdOn: '2026-02-12', status: 'active' },
    { id: 12, name: 'Board of Directors',               description: 'Holds fiduciary oversight of the organisation\'s risk appetite, governance framework, and strategic risk tolerance.',          createdOn: '2026-02-18', status: 'active' },
  ];

  truncate(text: string, max: number): string {
    return text && text.length > max ? text.substring(0, max) + '…' : (text || '');
  }

  isBlocked(id: number): boolean {
    return this.riskOwners.find(o => o.id === id)?.status === 'inactive';
  }

  get filteredOwners(): RiskOwnerItem[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.riskOwners;
    return this.riskOwners.filter(o => o.name.toLowerCase().includes(q));
  }

  get sortedOwners(): RiskOwnerItem[] {
    const list = [...this.filteredOwners];
    const field = this.sortField;
    if (!field) return list;
    return list.sort((a, b) => {
      const cmp = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
      return this.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  get pagedOwners(): RiskOwnerItem[] {
    const start = this.currentPage * this.pageSize;
    return this.sortedOwners.slice(start, start + this.pageSize);
  }

  toggleSort(field: 'name' | 'createdOn'): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
  }

  onSearch(): void {
    this.currentPage = 0;
  }

  onPageChange(page: number): void {
    this.currentPage = page;
  }

  onRowsChange(rows: number): void {
    this.pageSize = rows;
    this.currentPage = 0;
  }

  openAddDialog(): void {
    this.dialogMode = 'add';
    this.editingItem = null;
    this.editingId = null;
    this.showAddDialog = true;
  }

  viewOwner(item: RiskOwnerItem): void { this.viewingItem = item; this.showViewDialog = true; }

  editOwner(item: RiskOwnerItem): void {
    this.editingItem = { name: item.name, description: item.description, status: item.status };
    this.editingId = item.id;
    this.dialogMode = 'edit';
    this.showAddDialog = true;
  }

  openConfirm(item: RiskOwnerItem): void { this.confirmTarget = { id: item.id, name: item.name }; this.showConfirmDialog = true; }
  closeConfirm(): void { this.showConfirmDialog = false; this.confirmTarget = null; }

  confirmToggle(): void {
    if (!this.confirmTarget) return;
    const id = this.confirmTarget.id;
    this.riskOwners = this.riskOwners.map(o => o.id === id ? { ...o, status: o.status === 'active' ? 'inactive' : 'active' } : o);
    this.closeConfirm();
  }

  onOwnersSubmitted(entries: OwnerEntry[]): void {
    if (this.dialogMode === 'edit' && this.editingId !== null) {
      const updated = entries[0];
      this.riskOwners = this.riskOwners.map(o =>
        o.id === this.editingId ? { ...o, name: updated.name, description: updated.description, status: updated.status } : o
      );
      this.editingId = null;
    } else {
      const today = new Date().toISOString().split('T')[0];
      const maxId = this.riskOwners.reduce((max, o) => Math.max(max, o.id), 0);
      const toAdd: RiskOwnerItem[] = entries.map((e, i) => ({
        id: maxId + i + 1, name: e.name, description: e.description, createdOn: today, status: e.status,
      }));
      this.riskOwners = [...toAdd, ...this.riskOwners];
    }
    this.showAddDialog = false;
    this.dialogMode = 'add';
    this.editingItem = null;
  }

  onDialogCancelled(): void {
    this.showAddDialog = false;
    this.dialogMode = 'add';
    this.editingItem = null;
    this.editingId = null;
  }
}
