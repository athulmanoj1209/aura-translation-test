import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RiskRatingListComponent } from './risk-rating-list.component';

describe('RiskRatingListComponent', () => {
  let component: RiskRatingListComponent;
  let fixture: ComponentFixture<RiskRatingListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiskRatingListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RiskRatingListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
