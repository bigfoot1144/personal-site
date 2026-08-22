import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const root = new URL('../', import.meta.url);
const sourceRoot = new URL('../knowledge/', import.meta.url);
const curriculaRoot = new URL('../knowledge/curricula/', import.meta.url);
const outputUrl = new URL('../src/app/knowledge/knowledge.runtime.json', import.meta.url);
const checkOnly = process.argv.includes('--check');
const benchmark = process.argv.includes('--benchmark');

const readJson = async url => JSON.parse(await readFile(url, 'utf8'));
const fail = message => { throw new Error(message); };
const uniqueIds = (items, label) => {
  const ids = new Set();
  for (const item of items) {
    if (!item?.id) fail(`${label} contains an item without an id`);
    if (ids.has(item.id)) fail(`${label} contains duplicate id ${item.id}`);
    ids.add(item.id);
  }
  return ids;
};

export async function compileKnowledge() {
  const topicsSource = await readJson(new URL('topics.json', sourceRoot));
  const journal = await readJson(new URL('journal.json', sourceRoot));
  const curriculumFiles = (await readdir(curriculaRoot)).filter(name => name.endsWith('.json')).sort();
  const modules = await Promise.all(curriculumFiles.map(name => readJson(new URL(name, curriculaRoot))));
  const topics = topicsSource.topics;
  const topicIds = uniqueIds(topics, 'topics');
  const curricula = [];
  const placements = [];
  const connections = [];

  for (const module of modules) {
    const curriculum = module.curriculum;
    if (!curriculum?.id) fail('curriculum module lacks curriculum.id');
    if (typeof curriculum.shortTitle !== 'string' || !curriculum.shortTitle.trim() || curriculum.shortTitle.length > 12) fail('curriculum ' + curriculum.id + ' requires a shortTitle of at most 12 characters');
    const modulePlacements = module.placements.map(placement => ({ ...placement, curriculumIds: [curriculum.id] }));
    const memberIds = [...new Set(modulePlacements.map(placement => placement.topicId))];
    if (!memberIds.includes(curriculum.goalTopicId)) memberIds.push(curriculum.goalTopicId);
    curricula.push({ ...curriculum, topicIds: memberIds });
    placements.push(...modulePlacements);
    connections.push(...module.connections.map(connection => ({ ...connection, curriculumIds: [curriculum.id] })));
  }

  const placementIds = uniqueIds(placements, 'placements');
  const curriculumIds = uniqueIds(curricula, 'curricula');
  uniqueIds(connections, 'connections');
  uniqueIds(journal.entries, 'journal entries');
  for (const topic of topics) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.id)) fail(`topic has non-kebab-case id ${topic.id}`);
    if (!topic.title || !topic.summary) fail(`topic ${topic.id} requires title and summary`);
  }
  const placementById = Object.fromEntries(placements.map(placement => [placement.id, placement]));
  const topicById = Object.fromEntries(topics.map(topic => [topic.id, topic]));
  const curriculumById = Object.fromEntries(curricula.map(curriculum => [curriculum.id, curriculum]));
  for (const placement of placements) {
    if (!topicIds.has(placement.topicId)) fail(`placement ${placement.id} references unknown topic ${placement.topicId}`);
    if (placement.parentPlacementId && !placementIds.has(placement.parentPlacementId)) fail(`placement ${placement.id} has unknown parent`);
    if (!Number.isInteger(placement.order) || placement.order < 0) fail(`placement ${placement.id} has invalid order`);
  }
  for (const curriculum of curricula) {
    if (!topicIds.has(curriculum.goalTopicId)) fail(`curriculum ${curriculum.id} has unknown goal`);
    if (!curriculum.topicIds.includes(curriculum.goalTopicId)) fail(`curriculum ${curriculum.id} omits its goal`);
    if (!topicById[curriculum.goalTopicId].tags?.includes('goal')) fail(`curriculum ${curriculum.id} goal lacks goal tag`);
  }
  for (const connection of connections) {
    if (!placementIds.has(connection.source) || !placementIds.has(connection.target)) fail(`connection ${connection.id} has unknown endpoint`);
    if (!['prerequisite', 'related'].includes(connection.relation)) fail(`connection ${connection.id} has invalid relation`);
    const curriculumId = connection.curriculumIds[0];
    if (!placementById[connection.source].curriculumIds.includes(curriculumId) || !placementById[connection.target].curriculumIds.includes(curriculumId)) {
      fail(`connection ${connection.id} crosses curriculum placement contexts`);
    }
  }
  for (const entry of journal.entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) fail(`journal entry ${entry.id} has invalid date`);
    if (!['work', 'note', 'project'].includes(entry.type)) fail(`journal entry ${entry.id} has invalid type`);
    for (const id of entry.topicIds) if (!topicIds.has(id)) fail(`journal entry ${entry.id} references unknown topic ${id}`);
    for (const update of entry.statusUpdates ?? []) {
      if (!entry.topicIds.includes(update.topicId)) fail(`status update ${update.topicId} is not linked by entry ${entry.id}`);
      if (!['not-started', 'in-progress', 'completed'].includes(update.status)) fail(`entry ${entry.id} has invalid status`);
    }
  }

  const detectCycle = (nodes, edges, label) => {
    const adjacency = new Map([...nodes].map(id => [id, []]));
    for (const [source, target] of edges) adjacency.get(source)?.push(target);
    const visiting = new Set();
    const visited = new Set();
    const visit = id => {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      if ((adjacency.get(id) ?? []).some(visit)) return true;
      visiting.delete(id);
      visited.add(id);
      return false;
    };
    if ([...nodes].some(visit)) fail(`${label} contains a cycle`);
  };
  detectCycle(placementIds, placements.filter(p => p.parentPlacementId).map(p => [p.parentPlacementId, p.id]), 'placement hierarchy');
  detectCycle(placementIds, connections.filter(c => c.relation === 'prerequisite').map(c => [c.source, c.target]), 'prerequisites');

  const childrenByPlacement = Object.fromEntries(placements.map(placement => [placement.id, []]));
  const placementsByTopic = Object.fromEntries(topics.map(topic => [topic.id, []]));
  for (const placement of placements) {
    if (placement.parentPlacementId) childrenByPlacement[placement.parentPlacementId].push(placement.id);
    placementsByTopic[placement.topicId].push(placement.id);
  }
  for (const ids of Object.values(childrenByPlacement)) ids.sort((a, b) => placementById[a].order - placementById[b].order);

  const orderedRootsByCurriculum = {};
  for (const curriculum of curricula) {
    const roots = placements.filter(p => !p.parentPlacementId && p.curriculumIds.includes(curriculum.id));
    const rootSet = new Set(roots.map(rootPlacement => rootPlacement.id));
    const edges = connections.filter(c => c.relation === 'prerequisite' && c.curriculumIds.includes(curriculum.id) && rootSet.has(c.source) && rootSet.has(c.target));
    const incoming = new Map(roots.map(rootPlacement => [rootPlacement.id, 0]));
    for (const edge of edges) incoming.set(edge.target, incoming.get(edge.target) + 1);
    const queue = roots.filter(rootPlacement => incoming.get(rootPlacement.id) === 0).sort((a, b) => a.order - b.order);
    const ordered = [];
    while (queue.length) {
      const placement = queue.shift();
      ordered.push(placement.id);
      for (const edge of edges.filter(item => item.source === placement.id)) {
        incoming.set(edge.target, incoming.get(edge.target) - 1);
        if (incoming.get(edge.target) === 0) {
          queue.push(placementById[edge.target]);
          queue.sort((a, b) => a.order - b.order);
        }
      }
    }
    orderedRootsByCurriculum[curriculum.id] = ordered.concat(roots.filter(p => !ordered.includes(p.id)).sort((a, b) => a.order - b.order).map(p => p.id));
  }

  const statusByTopic = Object.fromEntries(topics.map(topic => [topic.id, 'not-started']));
  for (const entry of [...journal.entries].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const update of entry.statusUpdates ?? []) statusByTopic[update.topicId] = update.status;
  }
  const entriesByTopic = Object.fromEntries(topics.map(topic => [topic.id, []]));
  journal.entries.forEach((entry, index) => entry.topicIds.forEach(id => entriesByTopic[id].push(index)));
  for (const indexes of Object.values(entriesByTopic)) indexes.sort((a, b) => journal.entries[b].date.localeCompare(journal.entries[a].date));

  const aggregateStatusByPlacement = {};
  const aggregate = id => {
    if (aggregateStatusByPlacement[id]) return aggregateStatusByPlacement[id];
    const direct = statusByTopic[placementById[id].topicId];
    if (direct === 'completed' || direct === 'in-progress') return aggregateStatusByPlacement[id] = direct;
    const childStatuses = childrenByPlacement[id].map(aggregate);
    if (childStatuses.length && childStatuses.every(status => status === 'completed')) return aggregateStatusByPlacement[id] = 'completed';
    if (childStatuses.some(status => status !== 'not-started') || entriesByTopic[placementById[id].topicId].length) return aggregateStatusByPlacement[id] = 'in-progress';
    return aggregateStatusByPlacement[id] = 'not-started';
  };
  placements.forEach(placement => aggregate(placement.id));

  const positions = {};
  const positionCandidates = new Map();
  const laneCount = curricula.length;
  const stableNumber = value => {
    let hash = 2166136261;
    for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return hash >>> 0;
  };
  curricula.forEach((curriculum, curriculumIndex) => {
    const path = orderedRootsByCurriculum[curriculum.id];
    const laneDirection = -.45 + curriculumIndex * Math.PI * 2 / laneCount;
    const lanePhase = stableNumber(curriculum.id + '-ray') / 0xffffffff * Math.PI * 2;
    path.forEach((placementId, index) => {
      const radiusJitter = index ? stableNumber(placementId + '-radial') % 9 - 4 : 0;
      const radius = index === 0 ? 0 : 34 + index * 28 + radiusJitter;
      const angle = laneDirection + (index ? Math.sin(index * .72 + lanePhase) * .105 : 0);
      const lateral = index ? stableNumber(placementId + curriculum.id + '-lateral') % 81 - 40 : 0;
      const candidates = positionCandidates.get(placementId) ?? [];
      candidates.push({ x: 500 + Math.cos(angle) * radius + Math.cos(laneDirection + Math.PI / 2) * lateral, y: 350 + Math.sin(angle) * radius + Math.sin(laneDirection + Math.PI / 2) * lateral });
      positionCandidates.set(placementId, candidates);
    });
  });
  for (const placement of placements.filter(p => !p.parentPlacementId)) {
    const candidates = positionCandidates.get(placement.id) ?? [{ x: 500, y: 350 }];
    positions[placement.id] = {
      x: Math.max(80, Math.min(920, candidates.reduce((sum, point) => sum + point.x, 0) / candidates.length)),
      y: Math.max(85, Math.min(615, candidates.reduce((sum, point) => sum + point.y, 0) / candidates.length))
    };
  }
  for (const placement of placements.filter(p => p.parentPlacementId)) {
    const parent = positions[placement.parentPlacementId];
    const siblings = childrenByPlacement[placement.parentPlacementId];
    const index = siblings.indexOf(placement.id);
    const radius = 30 + index * 9.5;
    const angle = -Math.PI / 2 + index * .72 + (stableNumber(placement.id) % 9 - 4) * .018;
    positions[placement.id] = { x: parent.x + Math.cos(angle) * radius, y: parent.y + Math.sin(angle) * radius };
  }

  const placementPaths = {};
  for (const placement of placements) {
    const titles = [];
    let current = placement;
    while (current) {
      titles.unshift(topicById[current.topicId].title);
      current = current.parentPlacementId ? placementById[current.parentPlacementId] : undefined;
    }
    placementPaths[placement.id] = Object.fromEntries(placement.curriculumIds.map(id => [id, `${curriculumById[id].title} › ${titles.join(' › ')}`]));
  }
  const searchRecords = placements.flatMap(placement => placement.curriculumIds.map(curriculumId => ({
    placementId: placement.id,
    curriculumId,
    path: placementPaths[placement.id][curriculumId],
    text: `${topicById[placement.topicId].title} ${topicById[placement.topicId].summary} ${placementPaths[placement.id][curriculumId]}`.toLocaleLowerCase()
  })));
  const connectionPaths = Object.fromEntries(connections.map(connection => [connection.id, `M ${positions[connection.source].x} ${positions[connection.source].y} L ${positions[connection.target].x} ${positions[connection.target].y}`]));

  return {
    version: 1, topics, placements, curricula, connections, journal,
    derived: { childrenByPlacement, placementsByTopic, orderedRootsByCurriculum, statusByTopic, aggregateStatusByPlacement, entriesByTopic, positions, placementPaths, searchRecords, connectionPaths }
  };
}

const started = performance.now();
const runtime = await compileKnowledge();
const serialized = JSON.stringify(runtime);
if (checkOnly) {
  const current = await readFile(outputUrl, 'utf8').catch(() => '');
  if (current.trim() !== serialized) fail('knowledge.runtime.json is missing or stale; run npm run knowledge:compile');
} else {
  await mkdir(new URL('../src/app/knowledge/', import.meta.url), { recursive: true });
  await writeFile(outputUrl, serialized + '\n');
}
if (benchmark) {
  console.log(`Knowledge compile: ${(performance.now() - started).toFixed(1)} ms; runtime ${serialized.length} bytes (${gzipSync(serialized).length} gzip).`);
} else {
  console.log(`Knowledge runtime is valid: ${runtime.topics.length} topics, ${runtime.placements.length} placements, ${runtime.curricula.length} curricula.`);
}
