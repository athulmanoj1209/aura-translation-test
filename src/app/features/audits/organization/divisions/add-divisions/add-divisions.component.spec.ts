import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddDivisions } from './add-divisions.component';

describe('AddDivisions', () => {
  let component: AddDivisions;
  let fixture: ComponentFixture<AddDivisions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddDivisions]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddDivisions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
