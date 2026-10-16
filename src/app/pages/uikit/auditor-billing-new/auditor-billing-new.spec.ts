import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuditorBillingNew } from './auditor-billing-new';

describe('AuditorBillingNew', () => {
  let component: AuditorBillingNew;
  let fixture: ComponentFixture<AuditorBillingNew>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditorBillingNew]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuditorBillingNew);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
