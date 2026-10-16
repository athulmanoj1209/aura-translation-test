import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RfiManagementListComponent } from './rfi-management-list.component';

describe('RfiManagementListComponent', () => {
  let component: RfiManagementListComponent;
  let fixture: ComponentFixture<RfiManagementListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RfiManagementListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RfiManagementListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
