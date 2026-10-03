import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BioComponent } from './bio.component';

describe('BioComponent', () => {
  let component: BioComponent;
  let fixture: ComponentFixture<BioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BioComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links back to the new home and retains knowledge and blog navigation', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('.links a')) as HTMLAnchorElement[];
    expect(links.find(link => link.textContent === 'Home')?.getAttribute('href')).toBe('/');
    expect(links.find(link => link.textContent === 'Knowledge')?.getAttribute('href')).toBe('/knowledge');
    expect(links.find(link => link.textContent === 'Blog')?.getAttribute('href')).toBe('/blog');
    expect(fixture.nativeElement.textContent).toContain("I'm Cole, welcome to my page.");
  });
});
