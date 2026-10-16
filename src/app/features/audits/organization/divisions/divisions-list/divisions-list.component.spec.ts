import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DivisionsListComponent } from './divisions-list.component';

describe('DivisionsListComponent', () => {
  let component: DivisionsListComponent;
  let fixture: ComponentFixture<DivisionsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DivisionsListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DivisionsListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
