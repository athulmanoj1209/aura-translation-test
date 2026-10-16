import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientOrganizationalChart } from './client-organizational-chart';

describe('ClientOrganizationalChart', () => {
  let component: ClientOrganizationalChart;
  let fixture: ComponentFixture<ClientOrganizationalChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientOrganizationalChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientOrganizationalChart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
