import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewRfi } from './view-rfi.component';

describe('ViewRfi', () => {
  let component: ViewRfi;
  let fixture: ComponentFixture<ViewRfi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewRfi]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewRfi);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
