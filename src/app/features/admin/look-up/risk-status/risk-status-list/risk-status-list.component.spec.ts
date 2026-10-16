import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RiskStatusListComponent } from './risk-status-list.component';

describe('RiskStatusListComponent', () => {
  let component: RiskStatusListComponent;
  let fixture: ComponentFixture<RiskStatusListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiskStatusListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RiskStatusListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
