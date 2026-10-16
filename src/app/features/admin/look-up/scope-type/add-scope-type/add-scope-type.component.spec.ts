import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddScopeType } from './add-scope-type.component';

describe('AddScopeType', () => {
  let component: AddScopeType;
  let fixture: ComponentFixture<AddScopeType>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddScopeType]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddScopeType);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
