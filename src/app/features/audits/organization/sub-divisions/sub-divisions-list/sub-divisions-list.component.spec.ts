import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubDivisionsListComponent } from './sub-divisions-list.component';

describe('SubDivisionsListComponent', () => {
  let component: SubDivisionsListComponent;
  let fixture: ComponentFixture<SubDivisionsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubDivisionsListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubDivisionsListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
