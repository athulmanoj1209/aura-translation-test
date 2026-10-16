import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RiskOwnerListComponent } from './risk-owner-list.component';

describe('RiskOwnerListComponent', () => {
  let component: RiskOwnerListComponent;
  let fixture: ComponentFixture<RiskOwnerListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiskOwnerListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RiskOwnerListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
