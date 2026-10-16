import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { AddHourlyRate, HourlyRateEntry } from '../add-hourly-rate/add-hourly-rate.component';
import { ConfirmActionDialogComponent } from '@/app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

export interface HourlyRateItem {
  id: number;
  rate: number;
  createdOn: string;
  status: 'active' | 'inactive';
}

@Component({
  selector: 'app-hourly-rates-list',
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, TableModule, TooltipModule, DialogModule, TagModule, AddHourlyRate, ConfirmActionDialogComponent, PaginationBarComponent, DrawIconComponent],
  templateUrl: './hourly-rates-list.component.html',
  styleUrl: './hourly-rates-list.component.scss',
})
export class HourlyRatesListComponent {
  showAddDialog = false;
  dialogMode: 'add' | 'edit' = 'add';
  editingItem: HourlyRateEntry | null = null;
  editingId: number | null = null;

  showViewDialog = false;
  viewingItem: HourlyRateItem | null = null;

  showConfirmDialog = false;
  confirmTarget: { id: number; name: string } | null = null;

  searchQuery = '';
  pageSize = 10;
  currentPage = 0;

  sortField: 'rate' | 'createdOn' | null = null;
  sortDir: 'asc' | 'desc' = 'asc';

  hourlyRates: HourlyRateItem[] = [
    { id: 1,  rate: 110, createdOn: '2026-01-08', status: 'active' },
    { id: 2,  rate: 140, createdOn: '2026-01-10', status: 'active' },
    { id: 3,  rate: 175, createdOn: '2026-01-14', status: 'active' },
    { id: 4,  rate: 180, createdOn: '2026-01-18', status: 'active' },
    { id: 5,  rate: 195, createdOn: '2026-01-22', status: 'active' },
    { id: 6,  rate: 210, createdOn: '2026-02-03', status: 'active' },
    { id: 7,  rate: 220, createdOn: '2026-02-07', status: 'active' },
    { id: 8,  rate: 245, createdOn: '2026-02-12', status: 'active' },
    { id: 9,  rate: 265, createdOn: '2026-02-18', status: 'active' },
    { id: 10, rate: 290, createdOn: '2026-02-25', status: 'active' },
    { id: 11, rate: 350, createdOn: '2026-03-03', status: 'active' },
    { id: 12, rate: 400, createdOn: '2026-03-10', status: 'active' },
  ];

  isBlocked(id: number): boolean {
    return this.hourlyRates.find(r => r.id === id)?.status === 'inactive';
  }

  get filteredRates(): HourlyRateItem[] {
    const q = this.searchQuery.trim();
    const base = !q ? this.hourlyRates : this.hourlyRates.filter(r => String(r.rate).includes(q));
    if (!this.sortField) return base;
    const field = this.sortField;
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => a[field] < b[field] ? -1 * dir : a[field] > b[field] ? 1 * dir : 0);
  }

  get pagedRates(): HourlyRateItem[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredRates.slice(start, start + this.pageSize);
  }

  toggleSort(field: 'rate' | 'createdOn'): void {
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

  viewRate(item: HourlyRateItem): void { this.viewingItem = item; this.showViewDialog = true; }

  editRate(item: HourlyRateItem): void {
    this.editingItem = { rate: item.rate, status: item.status };
    this.editingId = item.id;
    this.dialogMode = 'edit';
    this.showAddDialog = true;
  }

  openConfirm(item: HourlyRateItem): void { this.confirmTarget = { id: item.id, name: `$ ${item.rate} / hr` }; this.showConfirmDialog = true; }
  closeConfirm(): void { this.showConfirmDialog = false; this.confirmTarget = null; }

  confirmToggle(): void {
    if (!this.confirmTarget) return;
    const id = this.confirmTarget.id;
    this.hourlyRates = this.hourlyRates.map(r => r.id === id ? { ...r, status: r.status === 'active' ? 'inactive' : 'active' } : r);
    this.closeConfirm();
  }

  onRatesSubmitted(entries: HourlyRateEntry[]): void {
    if (this.dialogMode === 'edit' && this.editingId !== null) {
      const updated = entries[0];
      this.hourlyRates = this.hourlyRates.map(r =>
        r.id === this.editingId ? { ...r, rate: updated.rate, status: updated.status } : r
      );
      this.editingId = null;
    } else {
      const today = new Date().toISOString().split('T')[0];
      const maxId = this.hourlyRates.reduce((max, r) => Math.max(max, r.id), 0);
      const toAdd: HourlyRateItem[] = entries.map((e, i) => ({
        id: maxId + i + 1, rate: e.rate, createdOn: today, status: e.status,
      }));
      this.hourlyRates = [...toAdd, ...this.hourlyRates];
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
