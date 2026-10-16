import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddRiskCategory } from './add-risk-category.component';

describe('AddRiskCategory', () => {
  let component: AddRiskCategory;
  let fixture: ComponentFixture<AddRiskCategory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddRiskCategory]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddRiskCategory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
