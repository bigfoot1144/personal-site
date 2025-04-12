import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SparkleCursorComponent } from './sparkle-cursor.component';

describe('SparkleCursorComponent', () => {
  let component: SparkleCursorComponent;
  let fixture: ComponentFixture<SparkleCursorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SparkleCursorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SparkleCursorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
