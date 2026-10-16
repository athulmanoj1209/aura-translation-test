import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HourlyRatesListComponent } from './hourly-rates-list.component';

describe('HourlyRatesListComponent', () => {
  let component: HourlyRatesListComponent;
  let fixture: ComponentFixture<HourlyRatesListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HourlyRatesListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HourlyRatesListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
