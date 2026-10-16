import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddTaskAudit } from './add-task-audit.component';

describe('AddTaskAudit', () => {
  let component: AddTaskAudit;
  let fixture: ComponentFixture<AddTaskAudit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddTaskAudit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddTaskAudit);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
