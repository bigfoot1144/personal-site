import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D, Texture } from 'three';
import { disposeObjectTree } from './storefront.runtime';

// Three's resource containers are CPU-only. No renderer, asset loading or WebGL context is created.
describe('Storefront GPU-resource ownership', () => {
  it('disposes shared geometry, materials, textures and bitmap images exactly once', () => {
    const bitmap = { close: jasmine.createSpy('closeBitmap') };
    const texture = new Texture(bitmap as unknown as ImageBitmap);
    const geometry = new BufferGeometry();
    const material = new MeshBasicMaterial({ map: texture });
    const geometryDispose = spyOn(geometry, 'dispose').and.callThrough();
    const materialDispose = spyOn(material, 'dispose').and.callThrough();
    const textureDispose = spyOn(texture, 'dispose').and.callThrough();
    const root = new Object3D();
    root.add(new Mesh(geometry, material), new Mesh(geometry, [material, material]));
    disposeObjectTree(root);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(root.children.length).toBe(0);
  });

  it('cleans a late multi-scene load without disposing shared resources twice', () => {
    const geometry = new BufferGeometry();
    const material = new MeshBasicMaterial();
    const first = new Object3D();
    const second = new Object3D();
    first.add(new Mesh(geometry, material));
    second.add(new Mesh(geometry, material));
    const geometryDispose = spyOn(geometry, 'dispose');
    const materialDispose = spyOn(material, 'dispose');
    disposeObjectTree([first, second]);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(first.children.length + second.children.length).toBe(0);
  });

  it('safely handles a scene with no mesh resources', () => {
    const root = new Object3D();
    root.add(new Object3D());
    expect(() => disposeObjectTree(root)).not.toThrow();
    expect(root.children.length).toBe(0);
  });
});
