import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddSamplingMethodology } from './add-sampling-methodology.component';

describe('AddSamplingMethodology', () => {
  let component: AddSamplingMethodology;
  let fixture: ComponentFixture<AddSamplingMethodology>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddSamplingMethodology]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddSamplingMethodology);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
