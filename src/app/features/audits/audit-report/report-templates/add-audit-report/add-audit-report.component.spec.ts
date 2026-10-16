import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddAuditReport } from './add-audit-report.component';

describe('AddAuditReport', () => {
  let component: AddAuditReport;
  let fixture: ComponentFixture<AddAuditReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddAuditReport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddAuditReport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
