import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuditFrequencyListComponent } from './audit-frequency-list.component';

describe('AuditFrequencyListComponent', () => {
  let component: AuditFrequencyListComponent;
  let fixture: ComponentFixture<AuditFrequencyListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditFrequencyListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuditFrequencyListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
