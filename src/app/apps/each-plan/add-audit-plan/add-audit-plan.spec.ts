import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddAuditPlan } from './add-audit-plan';

describe('AddAuditPlan', () => {
  let component: AddAuditPlan;
  let fixture: ComponentFixture<AddAuditPlan>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddAuditPlan]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddAuditPlan);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
