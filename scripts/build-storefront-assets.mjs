#!/usr/bin/env node
/** Publish the baked, real Blender scene. Does not launch or modify Blender. */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { dirname, resolve, join as pathJoin } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify, parseArgs } from 'node:util';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { dedup, flatten, join, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  input: { type: 'string' }, 'ktx-bin': { type: 'string' }, 'poster-only': { type: 'boolean' }
} });
const work = pathJoin(root, 'blender/renders/web-export');
const output = pathJoin(root, 'src/assets/storefront');
const temporary = pathJoin(root, '.tmp/storefront');
const input = resolve(root, values.input ?? pathJoin(work, 'lantern-lane.baked.glb'));
const ktxBin = resolve(root, values['ktx-bin'] ?? process.env.KTX_BIN ?? '.tmp/storefront/ktx/bin');
const source = JSON.parse(await readFile(pathJoin(root, 'scripts/storefront-cameras.json'), 'utf8'));
const exec = promisify(execFile);
const hash = data => createHash('sha256').update(data).digest('hex');
function assertTexture(texture, materialName) {
  if (!texture) throw new Error(`Missing baked texture on ${materialName}`);
}
await Promise.all([mkdir(output, { recursive: true }), mkdir(temporary, { recursive: true })]);

async function publish(label, extension, data) {
  const filename = `${label}.${hash(data).slice(0, 12)}.${extension}`;
  await writeFile(pathJoin(output, filename), data);
  return { url: `/assets/storefront/${filename}`, bytes: data.length };
}

const posterInput = pathJoin(root, 'blender/renders/review/lower_surface_weathering/final_wide.png');
const posterData = await sharp(posterInput).webp({ quality: 86 }).toBuffer();
const poster = { ...(await publish('poster', 'webp', posterData)), width: 1600, height: 1200 };
if (values['poster-only']) {
  console.log(JSON.stringify(poster, null, 2));
  process.exit(0);
}

await access(input);
await exec(pathJoin(ktxBin, 'toktx'), ['--version']);
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder
});
const profiles = {
  desktop: { ratio: 0.9, error: 0.0001, textureSize: 4096, quality: 255, budget: 12_000_000 },
  mobile: { ratio: 0.3, error: 0.001, textureSize: 1536, quality: 220, budget: 6_000_000 }
};
const assets = { poster };
const metrics = {};
for (const [profile, settings] of Object.entries(profiles)) {
  console.log(`Optimizing ${profile} from ${input}`);
  const doc = await io.read(input);
  const unlit = doc.createExtension(KHRMaterialsUnlit);
  for (const material of doc.getRoot().listMaterials()) {
    if (material.getName() === 'WEB glass') {
      material.setAlphaMode('BLEND').setDoubleSided(true);
    }
    if (material.getName().startsWith('WEB reflective • ')) {
      // The road combines display-toned baked illumination with live reflections.
      material.setExtras({ bakedDisplayTone: true });
    }
    if (material.getName().startsWith('WEB baked vertex • ')) {
      // Exported COLOR_0 already contains display-toned, linearized baked lighting.
      material.setBaseColorTexture(null).setBaseColorFactor([1, 1, 1, 1])
        .setEmissiveTexture(null).setEmissiveFactor([0, 0, 0])
        .setMetallicFactor(0).setRoughnessFactor(1)
        .setExtension('KHR_materials_unlit', unlit.createUnlit());
    }
    if (material.getName().startsWith('WEB baked • ')) {
      const texture = material.getBaseColorTexture() ?? material.getEmissiveTexture();
      assertTexture(texture, material.getName());
      material.setBaseColorTexture(texture).setBaseColorFactor([1, 1, 1, 1])
        .setEmissiveTexture(null).setEmissiveFactor([0, 0, 0])
        .setMetallicFactor(0).setRoughnessFactor(1)
        .setExtension('KHR_materials_unlit', unlit.createUnlit());
    }
  }
  // Baked illumination already contains normals/shadows. Do not ship millions
  // of redundant normals/tangents for the unlit architecture and foliage.
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMaterial()?.getExtension('KHR_materials_unlit')) {
        primitive.setAttribute('NORMAL', null).setAttribute('TANGENT', null);
      }
      if (primitive.getMaterial()?.getName().startsWith('WEB baked vertex • ')) {
        if (!primitive.getAttribute('COLOR_0')) throw new Error('Vertex-lit foliage is missing COLOR_0');
        for (const semantic of primitive.listSemantics()) {
          if (semantic.startsWith('TEXCOORD_')) primitive.setAttribute(semantic, null);
        }
      }
    }
  }
  // Runtime picking/cameras live in the typed manifest, not thousands of exported node names.
  for (const node of doc.getRoot().listNodes()) node.setExtras({});
  await doc.transform(
    dedup(), weld(), flatten(), join({ keepNamed: false, keepExtras: false }),
    simplify({ simplifier: MeshoptSimplifier, ratio: settings.ratio, error: settings.error, lockBorder: profile === 'desktop' }),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'png', resize: [settings.textureSize, settings.textureSize] })
  );
  const geometryPath = pathJoin(temporary, `${profile}.geometry.glb`);
  const compressedPath = pathJoin(temporary, `${profile}.ktx.glb`);
  await io.write(geometryPath, doc);
  const { stdout } = await exec(process.execPath, [
    pathJoin(root, 'node_modules/@gltf-transform/cli/bin/cli.js'), 'etc1s', geometryPath, compressedPath,
    '--quality', String(settings.quality), '--compression', '2', '--jobs', '2'
  ], { env: { ...process.env, PATH: `${ktxBin}:${process.env.PATH}` }, maxBuffer: 16 * 1024 * 1024 });
  console.log(stdout);
  // The CLI decodes geometry extensions on read; apply Meshopt LAST, otherwise
  // its texture-only pass silently writes uncompressed multi-megabyte geometry.
  const finalDoc = await io.read(compressedPath);
  await finalDoc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high',
    quantizePosition: 16, quantizeTexcoord: 14, quantizeNormal: 10, quantizeColor: 12 }));
  const finalPath = pathJoin(temporary, `${profile}.final.glb`);
  await io.write(finalPath, finalDoc);
  const bytes = await readFile(finalPath);
  const published = await publish(`lantern-lane.${profile}`, 'glb', bytes);
  assets[profile] = published;
  let triangles = 0;
  let primitives = 0;
  let vertices = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() === 4) triangles += (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3;
      vertices += primitive.getAttribute('POSITION').getCount();
      primitives++;
    }
  }
  metrics[profile] = { ...published, triangles, vertices, primitives, materials: doc.getRoot().listMaterials().length,
    textures: doc.getRoot().listTextures().length, transferBudget: settings.budget,
    withinTransferBudget: bytes.length + posterData.length <= settings.budget };
}

const environmentPath = pathJoin(work, 'environment.hdr');
try {
  const environment = await readFile(environmentPath);
  assets.environment = (await publish('environment', 'hdr', environment)).url;
  for (const profile of Object.keys(profiles)) {
    metrics[profile].environmentBytes = environment.length;
    metrics[profile].withinTransferBudget = metrics[profile].bytes + posterData.length + environment.length <= profiles[profile].budget;
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

await mkdir(pathJoin(output, 'basis'), { recursive: true });
for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm', 'README.md']) {
  await copyFile(pathJoin(root, 'node_modules/three/examples/jsm/libs/basis', file), pathJoin(output, 'basis', file));
}
const sourceHash = hash(await readFile(pathJoin(root, 'blender/scene/lantern_lane.blend')));
const manifest = { ...source, assets, sourceSha256: sourceHash };
const report = { source: source.source, sourceSha256: sourceHash, sourceGlbSha256: hash(await readFile(input)),
  tools: { node: process.version, gltfTransform: '4.5.1', ktx: '4.4.2', three: '0.180.0' },
  poster, profiles: metrics };
await writeFile(pathJoin(temporary, 'asset-report.preflight.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (Object.values(metrics).some(profile => !profile.withinTransferBudget)) {
  throw new Error('Scene transfer target exceeded; manifest unchanged. Review .tmp/storefront/asset-report.preflight.json.');
}
await writeFile(pathJoin(root, 'src/app/storefront/storefront.scene.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(pathJoin(output, 'asset-report.json'), `${JSON.stringify(report, null, 2)}\n`);
