import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuditModeListComponent } from './audit-mode-list.component';

describe('AuditModeListComponent', () => {
  let component: AuditModeListComponent;
  let fixture: ComponentFixture<AuditModeListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditModeListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuditModeListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
