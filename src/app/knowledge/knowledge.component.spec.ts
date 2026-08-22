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
});
