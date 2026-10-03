import { NgZone } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SparkleCursorComponent } from './sparkle-cursor.component';

describe('SparkleCursorComponent', () => {
  let component: SparkleCursorComponent;
  let fixture: ComponentFixture<SparkleCursorComponent>;
  let intervalZones: boolean[];

  beforeEach(async () => {
    intervalZones = [];
    const setInterval = window.setInterval;
    spyOn(window, 'setInterval').and.callFake(((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      intervalZones.push(NgZone.isInAngularZone());
      return setInterval(handler, timeout, ...args);
    }) as typeof window.setInterval);
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

  it('runs the recurring sparkle loop outside Angular', () => {
    expect(intervalZones).toContain(false);
    expect(intervalZones).not.toContain(true);
  });

  it('removes the body-mounted cursor and sparkles when leaving content pages', () => {
    component.onMouseMove(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));
    (component as any).updateSparkles();
    const cursor = (component as any).customCursor as HTMLElement;
    const sparkles = [...(component as any).sparkles] as HTMLElement[];
    expect(cursor.parentNode).toBe(document.body);
    expect(sparkles.length).toBeGreaterThan(0);
    fixture.destroy();
    expect(cursor.isConnected).toBeFalse();
    expect(sparkles.every(sparkle => !sparkle.isConnected)).toBeTrue();
    expect((component as any).sparkleInterval).toBeNull();
    (component as any).updateSparkles();
    expect((component as any).sparkles.length).toBe(0);
  });

  it('tolerates a cursor already removed by its host document', () => {
    ((component as any).customCursor as HTMLElement).remove();
    expect(() => fixture.destroy()).not.toThrow();
  });
});
