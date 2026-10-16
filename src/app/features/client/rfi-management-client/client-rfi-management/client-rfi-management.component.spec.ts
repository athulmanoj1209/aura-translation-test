import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientRfiManagement } from './client-rfi-management.component';

describe('ClientRfiManagement', () => {
  let component: ClientRfiManagement;
  let fixture: ComponentFixture<ClientRfiManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientRfiManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientRfiManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
