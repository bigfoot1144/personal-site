import {
  boundsCorners, cameraBasis, dot, fitPose, interpolatePose, overviewFrame,
  panAfterResize, panForShop, plainActivation, pointerNdc, PointerGesture, subtract
} from './storefront.math';
import { TEST_MANIFEST } from './storefront.testing';
import { STOREFRONT_DESTINATIONS } from './storefront.types';

describe('Storefront camera and destination helpers', () => {
  it('has the same four destinations for real links and canvas activation', () => {
    expect(Object.keys(STOREFRONT_DESTINATIONS)).toEqual(['learning', 'blog', 'about', 'projects']);
    expect(Object.values(STOREFRONT_DESTINATIONS).map(value => value.href)).toEqual([
      '/knowledge', '/blog', '/about', 'https://github.com/bigfoot1144'
    ]);
    expect(STOREFRONT_DESTINATIONS.projects.external).toBeTrue();
    expect(STOREFRONT_DESTINATIONS.about.external).toBeFalse();
  });

  it('keeps the source 4:3 pose when curated bounds already fit', () => {
    const frame = overviewFrame(TEST_MANIFEST, 1200, 900);
    expect(frame.portrait).toBeFalse();
    expect(frame.pose).toEqual(TEST_MANIFEST.overview);
    expect(frame.minPan).toBe(0);
    expect(frame.maxPan).toBe(0);
  });

  it('uses only supplied visible bounds to fit a narrow landscape', () => {
    const aspect = 1.02;
    const pose = fitPose(TEST_MANIFEST.overview, TEST_MANIFEST.bounds, aspect);
    const basis = cameraBasis(pose);
    const tangent = Math.tan(pose.fov * Math.PI / 360);
    for (const point of boundsCorners(TEST_MANIFEST.bounds)) {
      const delta = subtract(point, pose.position);
      const depth = dot(delta, basis.forward);
      expect(Math.abs(dot(delta, basis.right))).toBeLessThanOrEqual(depth * tangent * aspect + .00001);
      expect(Math.abs(dot(delta, basis.up))).toBeLessThanOrEqual(depth * tangent + .00001);
    }
  });

  it('starts portrait at Learning and bounds all horizontal movement', () => {
    const first = overviewFrame(TEST_MANIFEST, 390, 844);
    expect(first.portrait).toBeTrue();
    expect(first.pan).toBeLessThan(0);
    expect(first.pan).toBeGreaterThanOrEqual(first.minPan);
    expect(first.pan).toBeLessThanOrEqual(first.maxPan);
    expect(first.pose.position[1]).toBe(TEST_MANIFEST.overview.position[1]);
    const left = overviewFrame(TEST_MANIFEST, 390, 844, -1e6);
    const right = overviewFrame(TEST_MANIFEST, 390, 844, 1e6);
    expect(left.pan).toBe(left.minPan);
    expect(right.pan).toBe(right.maxPan);
    expect(panForShop(TEST_MANIFEST, 'learning')).toBe(-6);
    expect(panForShop(TEST_MANIFEST, 'projects')).toBe(6);
  });

  it('preserves the source camera even when the bounds contain empty out-of-frame corners', () => {
    const manifest = { ...TEST_MANIFEST, bounds: { min: [-99, -99, -99] as const, max: [99, 99, 99] as const } };
    expect(overviewFrame(manifest, 1200, 900).pose).toEqual(manifest.overview);
    expect(overviewFrame(manifest, 1920, 1080).pose).toEqual(manifest.overview);
    const narrow = overviewFrame(manifest, 1000, 900).pose;
    expect(narrow.position).toEqual(manifest.overview.position);
    expect(narrow.fov).toBeGreaterThan(manifest.overview.fov);
  });

  it('never pans desktop and safely accepts a zero-sized first layout', () => {
    expect(overviewFrame(TEST_MANIFEST, 1920, 1080, 999).pan).toBe(0);
    expect(Number.isFinite(overviewFrame(TEST_MANIFEST, 0, 0).unitsPerPixel)).toBeTrue();
  });

  it('keeps the keyboard-focused shop visible when rotating into portrait', () => {
    const projectsPan = panAfterResize(TEST_MANIFEST, false, true, 0, 'projects');
    const frame = overviewFrame(TEST_MANIFEST, 390, 844, projectsPan);
    expect(projectsPan).toBe(6);
    expect(frame.pan).toBeGreaterThan(0);
    expect(panAfterResize(TEST_MANIFEST, false, true, 0, null)).toBeUndefined();
    expect(panAfterResize(TEST_MANIFEST, true, true, 2, null)).toBe(2);
    expect(panAfterResize(TEST_MANIFEST, true, false, 2, 'projects')).toBeUndefined();
  });

  it('interpolates a smooth, clamped camera with exact endpoints', () => {
    const from = TEST_MANIFEST.overview;
    const to = TEST_MANIFEST.storefronts[0].focus;
    expect(interpolatePose(from, to, -1)).toEqual(from);
    expect(interpolatePose(from, to, 2)).toEqual(to);
    expect(interpolatePose(from, to, .5).position[2]).toBe((from.position[2] + to.position[2]) / 2);
    const firstStep = Math.abs(interpolatePose(from, to, .01).position[2] - from.position[2]);
    const middleStep = Math.abs(interpolatePose(from, to, .51).position[2] - interpolatePose(from, to, .5).position[2]);
    expect(firstStep).toBeLessThan(middleStep);
  });

  it('normalizes pointers relative to the actual canvas rectangle', () => {
    const rect = { left: 40, top: 20, width: 400, height: 200 };
    expect(pointerNdc(240, 120, rect)).toEqual({ x: 0, y: 0 });
    expect(pointerNdc(40, 20, rect)).toEqual({ x: -1, y: 1 });
    expect(pointerNdc(440, 220, rect)).toEqual({ x: 1, y: -1 });
  });

  it('does not intercept native modifier or middle-button activation', () => {
    const event = { button: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
    expect(plainActivation(event)).toBeTrue();
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) expect(plainActivation({ ...event, [modifier]: true })).toBeFalse();
    expect(plainActivation({ ...event, button: 1 })).toBeFalse();
  });
});

describe('Storefront pointer gesture', () => {
  let gesture: PointerGesture;
  beforeEach(() => gesture = new PointerGesture());

  it('allows taps and exactly eight pixels, but suppresses excursions over eight', () => {
    gesture.down(1, 10, 10);
    expect(gesture.move(1, 18, 10)).toBe(0);
    expect(gesture.suppressClick(1)).toBeFalse();
    expect(gesture.move(1, 19, 10)).toBe(1);
    gesture.move(1, 10, 10);
    gesture.up(1);
    expect(gesture.suppressClick(1)).toBeTrue();
    expect(gesture.suppressClick(0)).toBeFalse();
  });

  it('counts diagonal and vertical drags, not just horizontal motion', () => {
    gesture.down(1, 0, 0);
    gesture.move(1, 6, 6);
    expect(gesture.suppressClick(1)).toBeTrue();
    gesture.up(1);
    gesture.down(2, 0, 0);
    gesture.move(2, 0, 9);
    expect(gesture.suppressClick(1)).toBeTrue();
  });

  it('disables pan and accidental clicks for an entire multitouch gesture', () => {
    gesture.down(1, 0, 0);
    gesture.down(2, 10, 10);
    expect(gesture.move(1, 50, 0)).toBe(0);
    gesture.up(2);
    expect(gesture.move(1, 60, 0)).toBe(0);
    gesture.up(1);
    expect(gesture.suppressClick(1)).toBeTrue();
    gesture.down(3, 0, 0);
    gesture.up(3);
    expect(gesture.suppressClick(1)).toBeFalse();
  });

  it('continues a real touch swipe after implicit child capture transfers to the surface', () => {
    gesture.down(7, 300, 400);
    expect(gesture.move(7, 280, 400)).toBe(-20);
    gesture.lostCapture(false, true); // Bubbled loss from the previously captured anchor.
    expect(gesture.active).toBeTrue();
    expect(gesture.move(7, 240, 400)).toBe(-40);
    expect(gesture.move(7, 180, 400)).toBe(-60);
    gesture.up(7);
    expect(gesture.suppressClick(1)).toBeTrue();
  });

  it('cancels when the surface actually loses an active captured pointer', () => {
    gesture.down(7, 300, 400);
    gesture.move(7, 280, 400);
    gesture.lostCapture(true, true);
    expect(gesture.active).toBeTrue();
    gesture.lostCapture(true, false);
    expect(gesture.active).toBeFalse();
    expect(gesture.move(7, 240, 400)).toBe(0);
    expect(gesture.suppressClick(1)).toBeTrue();
  });

  it('cancels safely when the browser claims pinch zoom or cancels a pointer', () => {
    gesture.down(1, 0, 0);
    gesture.cancel(1);
    expect(gesture.active).toBeFalse();
    expect(gesture.move(1, 50, 0)).toBe(0);
    expect(gesture.suppressClick(1)).toBeTrue();
  });
});
