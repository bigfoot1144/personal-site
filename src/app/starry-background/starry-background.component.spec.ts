import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StarryBackgroundComponent } from './starry-background.component';

describe('StarryBackgroundComponent', () => {
  let component: StarryBackgroundComponent;
  let fixture: ComponentFixture<StarryBackgroundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StarryBackgroundComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StarryBackgroundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
