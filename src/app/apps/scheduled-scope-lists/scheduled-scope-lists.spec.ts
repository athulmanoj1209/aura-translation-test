import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScheduledScopeLists } from './scheduled-scope-lists';

describe('ScheduledScopeLists', () => {
  let component: ScheduledScopeLists;
  let fixture: ComponentFixture<ScheduledScopeLists>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScheduledScopeLists]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScheduledScopeLists);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
