import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BillingTextNew } from './billing-text-new';

describe('BillingTextNew', () => {
  let component: BillingTextNew;
  let fixture: ComponentFixture<BillingTextNew>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BillingTextNew]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BillingTextNew);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
