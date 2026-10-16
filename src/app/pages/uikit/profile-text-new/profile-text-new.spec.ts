import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileTextNew } from './profile-text-new';

describe('ProfileTextNew', () => {
  let component: ProfileTextNew;
  let fixture: ComponentFixture<ProfileTextNew>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileTextNew]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfileTextNew);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
