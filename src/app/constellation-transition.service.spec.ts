import { ConstellationTransitionService, KnowledgeCameraState } from './constellation-transition.service';

const targets = [{ id: 'star', x: 10, y: 20, size: 4, color: '#fff' }];
const camera: KnowledgeCameraState = {
  scale: 1, panX: 0, panY: 0, parallaxX: 0, parallaxY: 0,
  viewportWidth: 1000, viewportHeight: 700, parallaxActive: true
};

function renderer() {
  return {
    morphToConstellation: jasmine.createSpy('morph').and.returnValue(Promise.resolve()),
    scatterToRandom: jasmine.createSpy('scatter'),
    updateKnowledgeCamera: jasmine.createSpy('camera'),
    cancelTransition: jasmine.createSpy('cancel')
  };
}

describe('ConstellationTransitionService', () => {
  let service: ConstellationTransitionService;
  beforeEach(() => { service = new ConstellationTransitionService(); });
  afterEach(() => service.reset());

  it('waits for a late renderer and its morph before handing off the constellation', async () => {
    const stars = renderer();
    let finish!: () => void;
    stars.morphToConstellation.and.returnValue(new Promise<void>(resolve => { finish = resolve; }));
    let complete = false;
    service.updateKnowledgeCamera(camera);
    const pending = service.morphToConstellation(targets).then(() => { complete = true; });
    await Promise.resolve();
    expect(complete).toBeFalse();
    service.registerRenderer(stars);
    expect(stars.updateKnowledgeCamera).toHaveBeenCalledOnceWith(camera);
    expect(stars.morphToConstellation).toHaveBeenCalledOnceWith(targets);
    expect(complete).toBeFalse();
    finish();
    await pending;
    expect(complete).toBeTrue();
  });

  it('clears pending targets and camera when knowledge exits before a renderer mounts', async () => {
    service.updateKnowledgeCamera(camera);
    const pending = service.morphToConstellation(targets);
    service.scatterFromKnowledge();
    await pending;
    const stars = renderer();
    service.registerRenderer(stars);
    expect(stars.morphToConstellation).not.toHaveBeenCalled();
    expect(stars.updateKnowledgeCamera).not.toHaveBeenCalled();
  });

  it('preserves a captured exit snapshot after the knowledge view unregisters', () => {
    const stars = renderer();
    service.registerRenderer(stars);
    const unregister = service.registerSnapshotProvider(() => targets);
    service.captureExitSnapshot();
    unregister();
    service.cancelKnowledgeTransition();
    service.scatterFromKnowledge();
    expect(stars.scatterToRandom).toHaveBeenCalledOnceWith(targets);
    service.scatterFromKnowledge();
    expect(stars.scatterToRandom.calls.mostRecent().args[0]).toEqual([]);
  });

  it('resets the complete content-layout state and settles outstanding transitions', async () => {
    const stars = renderer();
    stars.morphToConstellation.and.returnValue(new Promise(() => undefined));
    const unregister = service.registerRenderer(stars);
    service.registerSnapshotProvider(() => targets);
    service.captureExitSnapshot();
    service.updateKnowledgeCamera(camera);
    const pending = service.morphToConstellation(targets);
    service.reset();
    await pending;
    expect(stars.cancelTransition).toHaveBeenCalled();
    const next = renderer();
    service.registerRenderer(next);
    unregister(); // Late teardown from the old instance cannot unregister this one.
    service.captureExitSnapshot();
    service.scatterFromKnowledge();
    expect(next.scatterToRandom).toHaveBeenCalledOnceWith([]);
    expect(next.updateKnowledgeCamera).not.toHaveBeenCalled();
    expect(next.morphToConstellation).not.toHaveBeenCalled();
  });

  it('ignores completion of a cancelled generation while a newer morph is pending', async () => {
    const stars = renderer();
    const finishes: Array<() => void> = [];
    stars.morphToConstellation.and.callFake(() => new Promise<void>(resolve => finishes.push(resolve)));
    service.registerRenderer(stars);
    const first = service.morphToConstellation(targets);
    let secondComplete = false;
    const second = service.morphToConstellation(targets).then(() => { secondComplete = true; });
    await first;
    finishes[0]();
    await Promise.resolve();
    expect(secondComplete).toBeFalse();
    finishes[1]();
    await second;
    expect(secondComplete).toBeTrue();
  });

  it('settles a failed renderer instead of keeping knowledge hidden', async () => {
    const stars = renderer();
    stars.morphToConstellation.and.returnValue(Promise.reject(new Error('unmounted renderer')));
    service.registerRenderer(stars);
    await service.morphToConstellation(targets);
    expect(stars.morphToConstellation).toHaveBeenCalledOnceWith(targets);
  });
});
