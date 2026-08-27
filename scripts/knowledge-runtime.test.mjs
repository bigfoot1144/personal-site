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

test('all canonical progress starts blank and shared topics retain every placement', async () => {
  const runtime = JSON.parse(await readFile(runtimeUrl, 'utf8'));
  assert.ok(runtime.derived.placementsByTopic.quantization.length > 1);
  assert.equal(runtime.journal.entries.length, 0);
  assert.ok(Object.values(runtime.derived.statusByTopic).every(status => status === 'not-started'));
  assert.ok(Object.values(runtime.derived.aggregateStatusByPlacement).every(status => status === 'not-started'));
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


test('the final eight curricula share canonical knowledge through explicit shared placements', async () => {
  const runtime = JSON.parse(await readFile(runtimeUrl, 'utf8'));
  assert.deepEqual(runtime.curricula.map(curriculum => curriculum.id).sort(),
    ['agentic', 'data-science', 'gpu', 'inference', 'ml-training', 'physics', 'portrait-drawing', 'robotics']);
  assert.equal(runtime.derived.placementsByTopic['linear-algebra'].length, 1);
  assert.equal(runtime.derived.placementsByTopic.probability.length, 1);
  assert.equal(runtime.derived.placementsByTopic['evaluation-infrastructure'].length, 1);
  assert.ok(runtime.placements.some(placement => placement.curriculumIds.length > 1));
  for (const lines of Object.values(runtime.derived.labelLines)) assert.ok(lines.length >= 1 && lines.length <= 2);
});


test('shared galaxies appear once and participate in every configured curriculum path', async () => {
  const runtime = JSON.parse(await readFile(runtimeUrl, 'utf8'));
  const transformer = runtime.placements.filter(placement => placement.topicId === 'transformer-foundations');
  assert.equal(transformer.length, 1);
  assert.deepEqual(transformer[0].curriculumIds, ['gpu', 'inference', 'ml-training']);
  assert.equal(runtime.derived.childrenByPlacement[transformer[0].id].length, 9);
  for (const curriculumId of transformer[0].curriculumIds) {
    assert.ok(runtime.derived.orderedRootsByCurriculum[curriculumId].includes(transformer[0].id));
  }
  assert.equal(runtime.placements.filter(placement => placement.topicId === 'linear-algebra').length, 1);
  assert.deepEqual(runtime.placements.find(placement => placement.topicId === 'linear-algebra').curriculumIds,
    ['data-science', 'gpu', 'ml-training', 'physics', 'robotics']);
});

test('Robotics and Data Science use only the intended stage branches', async () => {
  const runtime = JSON.parse(await readFile(runtimeUrl, 'utf8'));
  const edgesFor = curriculumId => runtime.connections.filter(edge => edge.curriculumIds.includes(curriculumId)).map(edge => [edge.source, edge.target]);
  const robotics = edgesFor('robotics');
  assert.ok(robotics.some(edge => edge[0] === 'place-robotics-robot-simulation' && edge[1] === 'place-shared-data-evaluation-systems'));
  assert.ok(robotics.some(edge => edge[0] === 'place-shared-data-evaluation-systems' && edge[1] === 'place-robotics-robot-imitation-learning'));
  assert.ok(robotics.some(edge => edge[0] === 'place-shared-data-evaluation-systems' && edge[1] === 'place-robotics-robot-reinforcement-learning'));
  assert.ok(!robotics.some(edge => edge[0] === 'place-robotics-robot-kinematics' && edge[1] === 'place-robotics-robot-perception-calibration'));
  const dataScience = edgesFor('data-science');
  assert.ok(dataScience.some(edge => edge[0] === 'place-data-science-predictive-modeling' && edge[1] === 'place-data-science-experimental-design'));
  assert.ok(dataScience.some(edge => edge[0] === 'place-data-science-predictive-modeling' && edge[1] === 'place-data-science-causal-inference'));
  assert.ok(!dataScience.some(edge => edge[0] === 'place-data-science-experimental-design' && edge[1] === 'place-data-science-causal-inference'));
});


test('overview layout is deterministic, bounded, direct, and planar within each curriculum', async () => {
  const runtime = JSON.parse(await readFile(runtimeUrl, 'utf8'));
  const roots = runtime.placements.filter(placement => !placement.parentPlacementId);
  for (const root of roots) {
    const point = runtime.derived.positions[root.id];
    assert.ok(point.x >= 55 && point.x <= 945 && point.y >= 55 && point.y <= 645);
  }
  const orientation = (first, second, third) =>
    (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x);
  const intersects = (first, second, third, fourth) =>
    orientation(first, second, third) * orientation(first, second, fourth) < 0 &&
    orientation(third, fourth, first) * orientation(third, fourth, second) < 0;
  for (const curriculum of runtime.curricula) {
    const curriculumRoots = roots.filter(placement => placement.curriculumIds.includes(curriculum.id));
    for (let first = 0; first < curriculumRoots.length; first++) {
      for (let second = first + 1; second < curriculumRoots.length; second++) {
        const firstRoot = curriculumRoots[first];
        const secondRoot = curriculumRoots[second];
        const firstPoint = runtime.derived.positions[firstRoot.id];
        const secondPoint = runtime.derived.positions[secondRoot.id];
        assert.ok(Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y) >= 20,
          `${curriculum.id} places ${firstRoot.id} too close to ${secondRoot.id}`);
      }
    }
    const edges = runtime.connections.filter(connection =>
      connection.relation === 'prerequisite' && connection.curriculumIds.includes(curriculum.id));
    for (let first = 0; first < edges.length; first++) {
      for (let second = first + 1; second < edges.length; second++) {
        const firstEdge = edges[first];
        const secondEdge = edges[second];
        if ([firstEdge.source, firstEdge.target].some(id => id === secondEdge.source || id === secondEdge.target)) continue;
        assert.equal(intersects(
          runtime.derived.positions[firstEdge.source], runtime.derived.positions[firstEdge.target],
          runtime.derived.positions[secondEdge.source], runtime.derived.positions[secondEdge.target]), false,
        `${curriculum.id} contains crossing edges ${firstEdge.id} and ${secondEdge.id}`);
      }
    }
  }
  assert.equal(Object.keys(runtime.derived.connectionPaths).length, runtime.connections.length);
  for (const connection of runtime.connections) {
    const source = runtime.derived.positions[connection.source];
    const target = runtime.derived.positions[connection.target];
    assert.equal(runtime.derived.connectionPaths[connection.id], `M ${source.x} ${source.y} L ${target.x} ${target.y}`);
  }
});
