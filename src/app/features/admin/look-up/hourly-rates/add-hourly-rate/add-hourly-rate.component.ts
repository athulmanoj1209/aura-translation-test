import { Component, Output, EventEmitter, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

export interface HourlyRateEntry {
  rate: number;
  status: 'active' | 'inactive';
}

@Component({
  selector: 'app-add-hourly-rate',
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule, InputNumberModule, TooltipModule, DividerModule, TagModule, ToggleSwitchModule, DrawIconComponent],
  templateUrl: './add-hourly-rate.component.html',
  styleUrl: './add-hourly-rate.component.scss',
})
export class AddHourlyRate implements OnChanges {
  @Input() mode: 'add' | 'edit' = 'add';
  @Input() editItem: HourlyRateEntry | null = null;
  @Output() submitted = new EventEmitter<HourlyRateEntry[]>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);

  entryForm: FormGroup = this.fb.group({
    rate: [null, [Validators.required, Validators.min(0.01)]],
    statusActive: [true],
  });

  addedEntries: HourlyRateEntry[] = [];

  get rateControl() { return this.entryForm.get('rate')!; }
  get statusControl() { return this.entryForm.get('statusActive')!; }
  get rateInvalid(): boolean { return this.rateControl.invalid && this.rateControl.touched; }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.mode === 'edit' && this.editItem) {
      this.entryForm.patchValue({
        rate: this.editItem.rate,
        statusActive: this.editItem.status === 'active',
      });
      this.addedEntries = [];
    } else if (changes['mode']?.currentValue === 'add') {
      this.entryForm.reset({ statusActive: true });
      this.addedEntries = [];
    }
  }

  addEntry(): void {
    if (this.entryForm.invalid) { this.entryForm.markAllAsTouched(); return; }
    this.addedEntries.push({
      rate: Number(this.rateControl.value),
      status: this.statusControl.value ? 'active' : 'inactive',
    });
    this.entryForm.reset({ statusActive: true });
  }

  removeEntry(index: number): void { this.addedEntries.splice(index, 1); }

  submit(): void {
    if (this.mode === 'edit') {
      if (this.entryForm.invalid) { this.entryForm.markAllAsTouched(); return; }
      this.submitted.emit([{
        rate: Number(this.rateControl.value),
        status: this.statusControl.value ? 'active' : 'inactive',
      }]);
      this.reset();
    } else {
      if (this.addedEntries.length === 0) {
        if (this.entryForm.invalid) { this.entryForm.markAllAsTouched(); return; }
        this.submitted.emit([{
          rate: Number(this.rateControl.value),
          status: this.statusControl.value ? 'active' : 'inactive',
        }]);
      } else {
        this.submitted.emit([...this.addedEntries]);
      }
      this.reset();
    }
  }

  cancel(): void { this.reset(); this.cancelled.emit(); }

  private reset(): void {
    this.entryForm.reset({ statusActive: true });
    this.addedEntries = [];
  }
}
