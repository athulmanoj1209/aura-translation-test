import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportTemplatesListComponent } from './report-templates-list.component';

describe('ReportTemplatesListComponent', () => {
  let component: ReportTemplatesListComponent;
  let fixture: ComponentFixture<ReportTemplatesListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportTemplatesListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportTemplatesListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
