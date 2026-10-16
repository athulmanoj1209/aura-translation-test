import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplicableFrameworkListComponent } from './applicable-framework-list.component';

describe('ApplicableFrameworkListComponent', () => {
  let component: ApplicableFrameworkListComponent;
  let fixture: ComponentFixture<ApplicableFrameworkListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplicableFrameworkListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplicableFrameworkListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
