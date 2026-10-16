import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddRiskRating } from './add-risk-rating.component';

describe('AddRiskRating', () => {
  let component: AddRiskRating;
  let fixture: ComponentFixture<AddRiskRating>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddRiskRating]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddRiskRating);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
