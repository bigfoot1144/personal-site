import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

const runtimeUrl = new URL('../src/app/knowledge/knowledge.runtime.json', import.meta.url);

test('compiled knowledge artifact is current and structurally indexed', async () => {
  execFileSync(process.execPath, ['scripts/compile-knowledge.mjs', '--check'], { cwd: new URL('../', import.meta.url) });
  const runtime = JSON.parse(await readFile(runtimeUrl, 'utf8'));
  assert.equal(runtime.version, 1);
  assert.equal(Object.keys(runtime.derived.positions).length, runtime.placements.length);
  assert.equal(Object.keys(runtime.derived.aggregateStatusByPlacement).length, runtime.placements.length);
  assert.equal(Object.keys(runtime.derived.entriesByTopic).length, runtime.topics.length);
});

test('canonical progress propagates to every placement', async () => {
  const runtime = JSON.parse(await readFile(runtimeUrl, 'utf8'));
  const quantizationPlacements = runtime.derived.placementsByTopic.quantization;
  assert.ok(quantizationPlacements.length > 1);
  assert.equal(runtime.derived.statusByTopic.quantization, 'in-progress');
  for (const placementId of quantizationPlacements) {
    assert.equal(runtime.derived.aggregateStatusByPlacement[placementId], 'in-progress');
  }
});

test('runtime JSON parses and indexes within the initialization budget', async () => {
  const source = await readFile(runtimeUrl, 'utf8');
  const samples = [];
  for (let iteration = 0; iteration < 5; iteration++) {
    const started = performance.now();
    const runtime = JSON.parse(source);
    const topicById = new Map(runtime.topics.map(topic => [topic.id, topic]));
    const placementById = new Map(runtime.placements.map(placement => [placement.id, placement]));
    assert.ok(topicById.size && placementById.size);
    samples.push(performance.now() - started);
  }
  assert.ok(Math.min(...samples) < 100, `fastest initialization was ${Math.min(...samples).toFixed(1)} ms`);
});


test('Mathematics is the sole center and feeds the math-dependent curricula', async () => {
  const runtime = JSON.parse(await readFile(runtimeUrl, 'utf8'));
  const mathematicsId = 'place-machine-learning-ml-mathematical-foundations';
  const connected = ['machine-learning', 'physics', 'statistics', 'robotics', 'hpc', 'gpu', 'inference'];
  const centers = runtime.placements.filter(placement =>
    runtime.derived.positions[placement.id].x === 500 && runtime.derived.positions[placement.id].y === 350);

  assert.deepEqual(centers.map(placement => placement.id), [mathematicsId]);
  assert.deepEqual(centers[0].curriculumIds, connected);
  for (const curriculumId of connected) {
    assert.equal(runtime.derived.orderedRootsByCurriculum[curriculumId][0], mathematicsId);
  }
  assert.notEqual(runtime.derived.orderedRootsByCurriculum.agentic[0], mathematicsId);
  assert.notEqual(runtime.derived.orderedRootsByCurriculum.compilers[0], mathematicsId);
  assert.ok(runtime.derived.childrenByPlacement[mathematicsId].includes('place-machine-learning-ml-mathematical-foundations-numerical-methods'));
  assert.ok(runtime.derived.childrenByPlacement[mathematicsId].includes('place-machine-learning-ml-mathematical-foundations-manifolds'));
  for (const lines of Object.values(runtime.derived.labelLines)) assert.ok(lines.length >= 1 && lines.length <= 2);
});
