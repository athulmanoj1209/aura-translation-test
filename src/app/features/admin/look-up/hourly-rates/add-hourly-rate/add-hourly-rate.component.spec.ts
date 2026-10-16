import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddHourlyRate } from './add-hourly-rate.component';

describe('AddHourlyRate', () => {
  let component: AddHourlyRate;
  let fixture: ComponentFixture<AddHourlyRate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddHourlyRate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddHourlyRate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
