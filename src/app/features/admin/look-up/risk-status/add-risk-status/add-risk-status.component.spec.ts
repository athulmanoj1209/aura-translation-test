import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddRiskStatus } from './add-risk-status.component';

describe('AddRiskStatus', () => {
  let component: AddRiskStatus;
  let fixture: ComponentFixture<AddRiskStatus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddRiskStatus]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddRiskStatus);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
