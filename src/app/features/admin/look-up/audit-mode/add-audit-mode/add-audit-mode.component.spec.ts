import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddAuditMode } from './add-audit-mode.component';

describe('AddAuditMode', () => {
  let component: AddAuditMode;
  let fixture: ComponentFixture<AddAuditMode>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddAuditMode]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddAuditMode);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
