import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DepartmentTypeListComponent } from './department-type-list.component';

describe('DepartmentTypeListComponent', () => {
  let component: DepartmentTypeListComponent;
  let fixture: ComponentFixture<DepartmentTypeListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepartmentTypeListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DepartmentTypeListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
