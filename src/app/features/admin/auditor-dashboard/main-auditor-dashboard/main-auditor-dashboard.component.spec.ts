import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MainAuditorDashboard } from './main-auditor-dashboard.component';

describe('MainAuditorDashboard', () => {
  let component: MainAuditorDashboard;
  let fixture: ComponentFixture<MainAuditorDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainAuditorDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MainAuditorDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
