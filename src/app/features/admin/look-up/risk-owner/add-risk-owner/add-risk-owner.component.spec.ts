import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddRiskOwner } from './add-risk-owner.component';

describe('AddRiskOwner', () => {
  let component: AddRiskOwner;
  let fixture: ComponentFixture<AddRiskOwner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddRiskOwner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddRiskOwner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
