import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SamplingMethodologyListComponent } from './sampling-methodology-list.component';

describe('SamplingMethodologyListComponent', () => {
  let component: SamplingMethodologyListComponent;
  let fixture: ComponentFixture<SamplingMethodologyListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SamplingMethodologyListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SamplingMethodologyListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
