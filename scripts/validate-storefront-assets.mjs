#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'src/app/storefront/storefront.scene.json'), 'utf8'));
const expected = ['learning', 'blog', 'about', 'projects'];
assert.equal(manifest.version, 1);
assert.deepEqual(manifest.storefronts.map(shop => shop.id), expected);
assert.match(manifest.source, /lantern_lane\.blend/);
function vector(value) {
  assert.equal(value.length, 3);
  assert.ok(value.every(Number.isFinite));
}
function camera(value) {
  vector(value.position); vector(value.target);
  assert.ok(value.fov > 5 && value.fov < 100);
  assert.notDeepEqual(value.position, value.target);
}
function box(value) {
  vector(value.min); vector(value.max);
  assert.ok(value.min.every((v, axis) => v < value.max[axis]));
}
camera(manifest.overview); box(manifest.bounds);
for (const shop of manifest.storefronts) {
  camera(shop.focus); box(shop.hitBox); vector(shop.sign.position);
  assert.ok(shop.sign.width > 0 && shop.sign.height > 0);
}
async function asset(url) {
  assert.match(url, /^\/assets\/storefront\/[a-zA-Z0-9./_-]+$/);
  assert.ok(!url.includes('..'));
  return readFile(resolve(root, 'src', url.slice(1)));
}
for (const [profile, budget] of [['desktop', 12_000_000], ['mobile', 6_000_000]]) {
  const entry = manifest.assets[profile];
  const buffer = await asset(entry.url);
  assert.equal(buffer.length, entry.bytes);
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, 'Actual GLB model required');
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a);
  const json = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString('utf8'));
  assert.ok(json.meshes.length > 0, 'The scene cannot be only a poster');
  const triangles = json.meshes.flatMap(mesh => mesh.primitives).reduce((sum, p) =>
    sum + (json.accessors[p.indices ?? p.attributes.POSITION].count / 3), 0);
  assert.ok(triangles > 10000, 'Expected the authored streetscape, not proxy geometry');
  assert.ok(json.extensionsUsed.includes('EXT_meshopt_compression'));
  assert.ok(json.extensionsUsed.includes('KHR_texture_basisu'));
  assert.ok(json.extensionsUsed.includes('KHR_materials_unlit'));
  assert.ok(json.materials.some(material => material.pbrMetallicRoughness?.baseColorTexture));
  const foliageMaterial = json.materials.findIndex(material => material.name?.startsWith('WEB baked vertex • '));
  assert.ok(foliageMaterial >= 0, 'The authored foliage must retain its baked vertex lighting');
  const foliagePrimitives = json.meshes.flatMap(mesh => mesh.primitives).filter(primitive => primitive.material === foliageMaterial);
  assert.ok(foliagePrimitives.length > 0);
  for (const primitive of foliagePrimitives) {
    assert.notEqual(primitive.attributes.COLOR_0, undefined, 'Missing foliage COLOR_0; use ACTIVE vertex color export');
    assert.equal(json.accessors[primitive.attributes.COLOR_0].count, json.accessors[primitive.attributes.POSITION].count);
  }
  const filenameHash = /\.([a-f0-9]{12})\.glb$/.exec(entry.url)?.[1];
  assert.equal(filenameHash, createHash('sha256').update(buffer).digest('hex').slice(0, 12));
  const poster = await asset(manifest.assets.poster.url);
  const environment = manifest.assets.environment ? await asset(manifest.assets.environment) : Buffer.alloc(0);
  assert.ok(buffer.length + poster.length + environment.length <= budget, `${profile} exceeds scene transfer target`);
  console.log(`${profile}: ${entry.bytes.toLocaleString()} bytes, ${Math.round(triangles).toLocaleString()} triangles`);
}
await asset(manifest.assets.poster.url);
for (const filename of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  assert.ok((await stat(resolve(root, 'src/assets/storefront/basis', filename))).size > 0);
}
console.log('Storefront assets, camera manifest, compression and transfer targets are valid.');
