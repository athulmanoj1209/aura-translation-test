import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EachPlan } from './each-plan';

describe('EachPlan', () => {
  let component: EachPlan;
  let fixture: ComponentFixture<EachPlan>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EachPlan]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EachPlan);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
