import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionareSection } from './questionare-section.component';

describe('QuestionareSection', () => {
  let component: QuestionareSection;
  let fixture: ComponentFixture<QuestionareSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionareSection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuestionareSection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
