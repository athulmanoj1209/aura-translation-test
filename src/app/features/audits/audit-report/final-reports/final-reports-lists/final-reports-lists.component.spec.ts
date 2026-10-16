import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinalReports } from './final-reports-lists.component';

describe('FinalReports', () => {
  let component: FinalReports;
  let fixture: ComponentFixture<FinalReports>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinalReports]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FinalReports);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
