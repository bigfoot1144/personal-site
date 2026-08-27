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
  it('moves faint stars with overview parallax and freezes them in detail views', () => {
    component.knowledgeMode = true;
    const stars = fixture.nativeElement.querySelectorAll('.ambient-star') as NodeListOf<HTMLElement>;
    const star = stars[0];
    (component as any).ambientOrigins[0] = { x: .5, y: .5 };
    (component as any).ambientOrigins[1] = { x: .5, y: .5 };
    (component as any).ambientOrigins[2] = { x: .5, y: .5 };
    component.updateKnowledgeCamera({
      scale: 2,
      panX: 120,
      panY: -60,
      viewportWidth: 1000,
      viewportHeight: 700,
      parallaxActive: true
    });
    expect(star.style.left).toContain('px');
    expect(star.style.opacity).toBe('0.38');
    expect(stars[1].style.opacity).toBe('0.52');
    expect(stars[2].style.opacity).toBe('0.72');
    expect(parseFloat(stars[0].style.left)).toBeLessThan(parseFloat(stars[1].style.left));
    expect(parseFloat(stars[1].style.left)).toBeLessThan(parseFloat(stars[2].style.left));

    const frozenLeft = star.style.left;
    const frozenTop = star.style.top;
    component.updateKnowledgeCamera({
      scale: 3,
      panX: -400,
      panY: 300,
      viewportWidth: 1000,
      viewportHeight: 700,
      parallaxActive: false
    });
    expect(star.style.left).toBe(frozenLeft);
    expect(star.style.top).toBe(frozenTop);
  });

  it('hands mapped ambient stars to the constellation without duplicate cores', async () => {
    component.knowledgeMode = true;
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
    await component.morphToConstellation([
      { id: 'root', x: 240, y: 180, size: 5, color: 'rgb(125, 249, 255)' }
    ]);

    const stars = fixture.nativeElement.querySelectorAll('.ambient-star') as NodeListOf<HTMLElement>;
    expect(stars[0].style.left).toBe('237.5px');
    expect(stars[0].style.top).toBe('177.5px');
    expect(stars[0].style.opacity).toBe('0');
    expect(stars[1].style.opacity).toBe('0.52');
    expect(fixture.nativeElement.querySelectorAll('.shooting-star').length).toBe(0);
  });

});
