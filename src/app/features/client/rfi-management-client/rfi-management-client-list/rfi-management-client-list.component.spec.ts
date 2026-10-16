import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RfiManagementClientListComponent } from './rfi-management-client-list.component';

describe('RfiManagementClientListComponent', () => {
  let component: RfiManagementClientListComponent;
  let fixture: ComponentFixture<RfiManagementClientListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RfiManagementClientListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RfiManagementClientListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
