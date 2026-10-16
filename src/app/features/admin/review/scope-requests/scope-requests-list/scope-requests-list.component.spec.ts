import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScopeRequestsListComponent } from './scope-requests-list.component';

describe('ScopeRequestsListComponent', () => {
  let component: ScopeRequestsListComponent;
  let fixture: ComponentFixture<ScopeRequestsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScopeRequestsListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScopeRequestsListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
