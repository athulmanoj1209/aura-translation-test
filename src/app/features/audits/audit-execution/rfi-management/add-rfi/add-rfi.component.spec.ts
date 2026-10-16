import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddRfi } from './add-rfi.component';

describe('AddRfi', () => {
  let component: AddRfi;
  let fixture: ComponentFixture<AddRfi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddRfi]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddRfi);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
