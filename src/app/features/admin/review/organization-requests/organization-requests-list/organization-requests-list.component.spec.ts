import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrganizationRequestsListComponent } from './organization-requests-list.component';

describe('OrganizationRequestsListComponent', () => {
  let component: OrganizationRequestsListComponent;
  let fixture: ComponentFixture<OrganizationRequestsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganizationRequestsListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrganizationRequestsListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
