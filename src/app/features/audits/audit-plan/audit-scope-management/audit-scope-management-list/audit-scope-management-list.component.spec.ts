import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuditScopeManagementListComponent } from './audit-scope-management-list.component';

describe('AuditScopeManagementListComponent', () => {
  let component: AuditScopeManagementListComponent;
  let fixture: ComponentFixture<AuditScopeManagementListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditScopeManagementListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuditScopeManagementListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
