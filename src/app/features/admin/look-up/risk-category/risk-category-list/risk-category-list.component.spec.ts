import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RiskCategoryListComponent } from './risk-category-list.component';

describe('RiskCategoryListComponent', () => {
  let component: RiskCategoryListComponent;
  let fixture: ComponentFixture<RiskCategoryListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiskCategoryListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RiskCategoryListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
