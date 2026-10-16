import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddApplicableFramework } from './add-applicable-framework.component';

describe('AddApplicableFramework', () => {
  let component: AddApplicableFramework;
  let fixture: ComponentFixture<AddApplicableFramework>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddApplicableFramework]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddApplicableFramework);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
