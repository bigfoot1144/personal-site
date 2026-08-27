import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KnowledgeComponent } from './knowledge.component';

describe('KnowledgeComponent curriculum dock', () => {
  let fixture: ComponentFixture<KnowledgeComponent>;
  let component: KnowledgeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KnowledgeComponent],
      providers: [provideRouter([])]
    }).compileComponents();
    fixture = TestBed.createComponent(KnowledgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('selects Machine Learning by default', () => {
    expect(component.selectedCurriculumId).toBe('machine-learning');
    expect(component.selectedJourney?.curriculumId).toBe('machine-learning');
  });

  it('toggles child-count badges from the top controls', () => {
    const toggle = fixture.nativeElement.querySelector('.child-count-toggle') as HTMLButtonElement;
    expect(fixture.nativeElement.querySelectorAll('.child-badge').length).toBeGreaterThan(0);

    toggle.click();
    fixture.detectChanges();
    expect(component.showChildCounts).toBeFalse();
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(fixture.nativeElement.querySelectorAll('.child-badge').length).toBe(0);
  });

  it('collapses the progress menu from its top-right arrow', () => {
    const collapse = fixture.nativeElement.querySelector('.journey-collapse') as HTMLButtonElement;
    collapse.click();
    fixture.detectChanges();

    expect(component.journeyPanelVisible).toBeFalse();
    expect(fixture.nativeElement.querySelector('.journey-card')).toBeNull();
  });

  it('collapses and reopens the progress menu from the active curriculum tab', () => {
    const activeTab = fixture.nativeElement.querySelector('#curriculum-tab-machine-learning') as HTMLButtonElement;
    activeTab.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.journey-card')).toBeNull();
    expect(activeTab.getAttribute('aria-expanded')).toBe('false');
    expect(activeTab.classList).not.toContain('selected');
    expect(activeTab.classList).toContain('visible');

    activeTab.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.journey-card')).not.toBeNull();
    expect(activeTab.getAttribute('aria-expanded')).toBe('true');
    expect(activeTab.classList).toContain('selected');
  });

  it('makes the next-up star dominant and uses one marker label', () => {
    const progress = component.selectedJourney!;
    const button = fixture.nativeElement.querySelector('.next-up-button') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    const focused = component.baseNodes.find(node => node.placementId === progress.current.id)!;
    expect(component.focusedJourneyPlacementId).toBe(progress.current.id);
    expect(fixture.nativeElement.querySelector('.knowledge-shell').classList).toContain('journey-focus-active');
    expect(fixture.nativeElement.querySelector('.topic-node.jump-focused')).not.toBeNull();
    expect(component.journeyMarkerLabel('current', focused)).toBe('NEXT UP');
  });

  it('changes the progress card without changing graph visibility', () => {
    const activeBefore = [...component.activeCurricula].sort();
    const agentTab = fixture.nativeElement.querySelector('#curriculum-tab-agentic') as HTMLButtonElement;
    agentTab.click();
    fixture.detectChanges();

    expect(component.selectedCurriculumId).toBe('agentic');
    expect([...component.activeCurricula].sort()).toEqual(activeBefore);
    expect(fixture.nativeElement.querySelector('.journey-card').getAttribute('aria-labelledby')).toBe('curriculum-tab-agentic');
  });

  it('toggles visibility without changing the selected curriculum', () => {
    const visibility = fixture.nativeElement.querySelector('.journey-visibility') as HTMLButtonElement;
    visibility.click();
    fixture.detectChanges();

    expect(component.selectedCurriculumId).toBe('machine-learning');
    expect(component.activeCurricula.has('machine-learning')).toBeFalse();
    expect(visibility.getAttribute('aria-pressed')).toBe('false');
  });

  it('supports arrow-key tab navigation', () => {
    const selectedIndex = component.journeyProgress.findIndex(item => item.curriculumId === 'machine-learning');
    const expected = component.journeyProgress[(selectedIndex + 1) % component.journeyProgress.length];
    const selectedTab = fixture.nativeElement.querySelector('#curriculum-tab-machine-learning') as HTMLButtonElement;
    selectedTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    expect(component.selectedCurriculumId).toBe(expected.curriculumId);
    expect(document.activeElement?.id).toBe('curriculum-tab-' + expected.curriculumId);
  });

  it('renders all curricula without a horizontal scrolling HUD', () => {
    expect(fixture.nativeElement.querySelectorAll('.curriculum-dock [role="tab"]').length).toBe(component.journeyProgress.length);
    expect(getComputedStyle(fixture.nativeElement.querySelector('.journey-hud')).overflowX).not.toBe('auto');
  });

  it('deselects and resets every curriculum path', () => {
    const button = fixture.nativeElement.querySelector('.deselect-all') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(component.activeCurricula.size).toBe(0);
    expect(component.visibleConnections.length).toBe(0);
    expect(button.disabled).toBeFalse();
    expect(button.textContent).toContain('Reset all');

    component.select(component.baseNodes.find(node => node.id === 'gpu-code-generation')!);
    expect(component.selected).not.toBeNull();
    button.click();
    fixture.detectChanges();

    expect(component.activeCurricula.size).toBe(component.data.curricula.length);
    expect(component.visibleConnections.length).toBeGreaterThan(0);
    expect(component.selected).toBeNull();
    expect(fixture.nativeElement.querySelector('.reset-button')).toBeNull();
    expect(button.textContent).toContain('Deselect all');
  });

  it('keeps focused galaxies and solar systems visible after deselecting all curricula', () => {
    const galaxy = component.baseNodes.find(node => node.id === 'gpu-code-generation')!;
    component.select(galaxy);
    component.deselectAllCurricula();
    fixture.detectChanges();

    expect(component.galaxyJourneySegments.length).toBeGreaterThan(0);
    expect(component.galaxyStars.every(node => component.nodeVisible(node))).toBeTrue();
    expect(fixture.nativeElement.querySelectorAll('.galaxy-route path').length).toBe(component.galaxyJourneySegments.length);
    expect(fixture.nativeElement.querySelectorAll('.topic-node.hidden-node').length).toBe(0);

    const cuda = component.galaxyStars.find(node => node.id === 'cuda')!;
    component.select(cuda);
    fixture.detectChanges();

    expect(component.selected?.placementId).toBe(cuda.placementId);
    expect(fixture.nativeElement.querySelectorAll('.curriculum-bridge').length).toBe(0);
  });

  it('uses wheel input only to zoom, without entering or leaving a galaxy', () => {
    spyOn<any>(component, 'svgPoint').and.returnValue({ x: 500, y: 350 });
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    const wheel = (deltaY: number) => ({
      preventDefault: jasmine.createSpy('preventDefault'),
      currentTarget: svg,
      clientX: 500,
      clientY: 350,
      deltaY
    } as unknown as WheelEvent);

    for (let step = 0; step < 20; step++) component.onWheel(wheel(-100));
    expect(component.selected).toBeNull();

    const galaxy = component.baseNodes.find(node => node.id === 'gpu-code-generation')!;
    component.select(galaxy);
    for (let step = 0; step < 20; step++) component.onWheel(wheel(100));
    expect(component.selected?.placementId).toBe(galaxy.placementId);
  });

  it('grows labels gently on screen and caps their size while zooming', () => {
    component.scale = 1;
    const initialScreenScale = component.graphLabelScale * component.scale;
    component.scale = 2;
    const grownScreenScale = component.graphLabelScale * component.scale;
    component.scale = 3.2;
    const cappedScreenScale = component.graphLabelScale * component.scale;

    expect(initialScreenScale).toBeCloseTo(1, 5);
    expect(grownScreenScale).toBeGreaterThan(initialScreenScale);
    expect(cappedScreenScale).toBeCloseTo(1.28, 5);
  });

});
