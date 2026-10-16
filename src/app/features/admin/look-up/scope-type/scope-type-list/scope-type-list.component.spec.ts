import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScopeTypeListComponent } from './scope-type-list.component';

describe('ScopeTypeListComponent', () => {
  let component: ScopeTypeListComponent;
  let fixture: ComponentFixture<ScopeTypeListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScopeTypeListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScopeTypeListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
