import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddAuditFrequency } from './add-audit-frequency.component';

describe('AddAuditFrequency', () => {
  let component: AddAuditFrequency;
  let fixture: ComponentFixture<AddAuditFrequency>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddAuditFrequency]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddAuditFrequency);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
