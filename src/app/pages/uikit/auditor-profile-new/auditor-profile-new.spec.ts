import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuditorProfileNew } from './auditor-profile-new';

describe('AuditorProfileNew', () => {
  let component: AuditorProfileNew;
  let fixture: ComponentFixture<AuditorProfileNew>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditorProfileNew]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuditorProfileNew);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
