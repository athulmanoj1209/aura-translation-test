import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScopeAuditPlanComponent } from './scope-audit-plan.component';

describe('ScopeAuditPlanComponent', () => {
  let component: ScopeAuditPlanComponent;
  let fixture: ComponentFixture<ScopeAuditPlanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScopeAuditPlanComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScopeAuditPlanComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
