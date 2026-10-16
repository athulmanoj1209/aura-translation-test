import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LibraryRequestsListComponent } from './library-requests-list.component';

describe('LibraryRequestsListComponent', () => {
  let component: LibraryRequestsListComponent;
  let fixture: ComponentFixture<LibraryRequestsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LibraryRequestsListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LibraryRequestsListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
