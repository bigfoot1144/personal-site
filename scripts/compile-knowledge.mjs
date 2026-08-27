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
  const sharedGalaxiesSource = await readJson(new URL('shared-galaxies.json', sourceRoot));
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

  const sharedGalaxyIds = new Set();
  const rootForTopic = (topicId, curriculumId) => placements.find(placement =>
    !placement.parentPlacementId && placement.topicId === topicId && placement.curriculumIds.includes(curriculumId));
  for (const galaxy of sharedGalaxiesSource.galaxies ?? []) {
    if (sharedGalaxyIds.has(galaxy.id)) fail(`shared galaxies contains duplicate id ${galaxy.id}`);
    sharedGalaxyIds.add(galaxy.id);
    if (!topicIds.has(galaxy.topicId)) fail(`shared galaxy ${galaxy.id} references unknown topic ${galaxy.topicId}`);
    if (galaxy.curriculumIds.length < 2) fail(`shared galaxy ${galaxy.id} requires at least two curricula`);
    for (const curriculumId of galaxy.curriculumIds) {
      const curriculum = curricula.find(item => item.id === curriculumId);
      if (!curriculum) fail(`shared galaxy ${galaxy.id} references unknown curriculum ${curriculumId}`);
      if (!curriculum.topicIds.includes(galaxy.topicId)) curriculum.topicIds.push(galaxy.topicId);
    }

    const rootOccurrences = placements.filter(placement => placement.topicId === galaxy.topicId);
    let rootPlacement = rootOccurrences.find(placement => !placement.parentPlacementId);
    const removedRootIds = new Set(rootOccurrences.filter(placement => placement !== rootPlacement).map(placement => placement.id));
    for (let index = placements.length - 1; index >= 0; index--) if (removedRootIds.has(placements[index].id)) placements.splice(index, 1);
    if (!rootPlacement) {
      rootPlacement = { id: galaxy.placementId, topicId: galaxy.topicId, order: 0, curriculumIds: [...galaxy.curriculumIds] };
      placements.push(rootPlacement);
    } else {
      if (rootPlacement.id !== galaxy.placementId) fail(`shared galaxy ${galaxy.id} expected placement ${galaxy.placementId}`);
      rootPlacement.curriculumIds = [...galaxy.curriculumIds];
    }

    galaxy.topicIds.forEach((topicId, order) => {
      if (!topicIds.has(topicId)) fail(`shared galaxy ${galaxy.id} references unknown child topic ${topicId}`);
      const candidates = placements.filter(placement => placement.topicId === topicId &&
        placement.curriculumIds.some(id => galaxy.curriculumIds.includes(id)));
      const memberships = [...new Set(candidates.flatMap(placement => placement.curriculumIds).filter(id => galaxy.curriculumIds.includes(id)))];
      if (memberships.length < 2) fail(`shared galaxy child ${topicId} is not shared within ${galaxy.id}`);
      const preferred = candidates.find(placement => placement.parentPlacementId === rootPlacement.id);
      const sharedChild = preferred ?? { id: `place-${galaxy.id}-${topicId}`, topicId, order };
      const removedIds = new Set(candidates.filter(placement => placement !== sharedChild).map(placement => placement.id));
      for (let index = placements.length - 1; index >= 0; index--) if (removedIds.has(placements[index].id)) placements.splice(index, 1);
      sharedChild.parentPlacementId = rootPlacement.id;
      sharedChild.curriculumIds = memberships;
      sharedChild.order = order;
      if (!placements.includes(sharedChild)) placements.push(sharedChild);
    });
  }

  for (const galaxy of sharedGalaxiesSource.galaxies ?? []) {
    const sharedRoot = placements.find(placement => placement.id === galaxy.placementId);
    for (const path of galaxy.paths ?? []) {
      const after = path.after ? rootForTopic(path.after, path.curriculumId) : undefined;
      const before = path.before.map(topicId => rootForTopic(topicId, path.curriculumId));
      if (path.after && !after) fail(`shared galaxy path ${galaxy.id} has unknown after stage ${path.after}`);
      if (before.some(item => !item)) fail(`shared galaxy path ${galaxy.id} has an unknown before stage`);
      if (after) {
        for (let index = connections.length - 1; index >= 0; index--) {
          if (connections[index].curriculumIds.includes(path.curriculumId) && connections[index].source === after.id && before.some(item => item.id === connections[index].target)) connections.splice(index, 1);
        }
        connections.push({ id: `shared-${galaxy.id}-${path.curriculumId}-in`, source: after.id, target: sharedRoot.id, relation: 'prerequisite', curriculumIds: [path.curriculumId] });
      }
      before.forEach((target, index) => connections.push({ id: `shared-${galaxy.id}-${path.curriculumId}-out-${index}`, source: sharedRoot.id, target: target.id, relation: 'prerequisite', curriculumIds: [path.curriculumId] }));
    }
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
    let cycleAt;
    const visit = id => {
      if (visiting.has(id)) { cycleAt = id; return true; }
      if (visited.has(id)) return false;
      visiting.add(id);
      if ((adjacency.get(id) ?? []).some(visit)) return true;
      visiting.delete(id);
      visited.add(id);
      return false;
    };
    if ([...nodes].some(visit)) fail(`${label} contains a cycle at ${cycleAt}`);
  };
  detectCycle(placementIds, placements.filter(p => p.parentPlacementId).map(p => [p.parentPlacementId, p.id]), 'placement hierarchy');
  for (const curriculum of curricula) {
    const memberPlacements = new Set(placements.filter(placement => placement.curriculumIds.includes(curriculum.id)).map(placement => placement.id));
    const prerequisiteEdges = connections.filter(connection => connection.relation === 'prerequisite' && connection.curriculumIds.includes(curriculum.id)).map(connection => [connection.source, connection.target]);
    detectCycle(memberPlacements, prerequisiteEdges, `prerequisites for ${curriculum.id}`);
  }

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
  const stableNumber = value => {
    let hash = 2166136261;
    for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return hash >>> 0;
  };
  const wrapLabel = title => {
    const words = title.trim().split(/\s+/);
    if (title.length <= 18 || words.length === 1) return [title];
    let best = 1;
    let difference = Infinity;
    for (let index = 1; index < words.length; index++) {
      const candidate = Math.abs(words.slice(0, index).join(' ').length - words.slice(index).join(' ').length);
      if (candidate < difference) { best = index; difference = candidate; }
    }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  };

  const rootPlacements = placements.filter(placement => !placement.parentPlacementId);
  const curriculumAngles = Object.fromEntries(curricula.map((curriculum, index) =>
    [curriculum.id, -.55 + index * Math.PI * 2 / curricula.length]));
  const curriculumCenters = Object.fromEntries(curricula.map(curriculum => {
    const angle = curriculumAngles[curriculum.id];
    return [curriculum.id, { x: 500 + Math.cos(angle) * 315, y: 350 + Math.sin(angle) * 220 }];
  }));
  const trackEndpoint = (curriculumId, direction) => {
    const angle = curriculumAngles[curriculumId];
    const center = curriculumCenters[curriculumId];
    return { x: center.x + Math.cos(angle + Math.PI / 2) * 170 * direction, y: center.y + Math.sin(angle + Math.PI / 2) * 170 * direction };
  };
  for (const placement of rootPlacements.filter(placement => placement.curriculumIds.length > 1)) {
    const configured = sharedGalaxiesSource.galaxies.find(galaxy => galaxy.placementId === placement.id)?.position;
    if (!configured || !Number.isFinite(configured.x) || !Number.isFinite(configured.y)) fail(`shared galaxy ${placement.id} requires a finite position`);
    positions[placement.id] = { x: configured.x, y: configured.y };
  }
  curricula.forEach((curriculum, curriculumIndex) => {
    const path = orderedRootsByCurriculum[curriculum.id];
    const sharedIndexes = path.map((id, index) => placementById[id].curriculumIds.length > 1 ? index : -1).filter(index => index >= 0);
    const markers = [-1, ...sharedIndexes, path.length];
    for (let marker = 0; marker < markers.length - 1; marker++) {
      const first = markers[marker];
      const last = markers[marker + 1];
      const source = first < 0 ? trackEndpoint(curriculum.id, -1) : positions[path[first]];
      const target = last >= path.length ? trackEndpoint(curriculum.id, 1) : positions[path[last]];
      for (let index = first + 1; index < last; index++) {
        const progress = (index - first) / (last - first);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const bow = Math.sin(Math.PI * progress) * 35 * (curriculumIndex % 2 ? 1 : -1);
        positions[path[index]] = {
          x: source.x + dx * progress - dy / distance * bow,
          y: source.y + dy * progress + dx / distance * bow
        };
      }
    }
  });

  for (const curriculum of curricula) {
    const edges = connections.filter(connection => connection.relation === 'prerequisite' && connection.curriculumIds.includes(curriculum.id));
    const outgoing = new Map();
    for (const edge of edges) (outgoing.get(edge.source) ?? outgoing.set(edge.source, []).get(edge.source)).push(edge.target);
    for (const [sourceId, branches] of outgoing) {
      if (branches.length !== 2 || branches.some(id => placementById[id].curriculumIds.length > 1)) continue;
      const firstTargets = outgoing.get(branches[0]) ?? [];
      const secondTargets = outgoing.get(branches[1]) ?? [];
      if (firstTargets.length !== 1 || secondTargets.length !== 1 || firstTargets[0] !== secondTargets[0]) continue;
      const source = positions[sourceId];
      const target = positions[firstTargets[0]];
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const midpoint = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
      positions[branches[0]] = { x: midpoint.x - dy / distance * 48, y: midpoint.y + dx / distance * 48 };
      positions[branches[1]] = { x: midpoint.x + dy / distance * 48, y: midpoint.y - dx / distance * 48 };
    }
  }

  for (const placement of placements.filter(placement => placement.parentPlacementId)) {
    const parent = positions[placement.parentPlacementId];
    const siblings = childrenByPlacement[placement.parentPlacementId];
    const index = siblings.indexOf(placement.id);
    const radius = 30 + index * 9.5;
    const angle = -Math.PI / 2 + index * .72 + (stableNumber(placement.id) % 9 - 4) * .018;
    positions[placement.id] = { x: parent.x + Math.cos(angle) * radius, y: parent.y + Math.sin(angle) * radius };
  }
  const labelLines = Object.fromEntries(placements.map(placement => [placement.id, wrapLabel(topicById[placement.topicId].title)]));

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
  const connectionPaths = Object.fromEntries(connections.map(connection => [connection.id,
    `M ${positions[connection.source].x} ${positions[connection.source].y} L ${positions[connection.target].x} ${positions[connection.target].y}`]));

  return {
    version: 1, topics, placements, curricula, connections, journal,
    derived: { childrenByPlacement, placementsByTopic, orderedRootsByCurriculum, statusByTopic, aggregateStatusByPlacement, entriesByTopic, positions, placementPaths, searchRecords, connectionPaths, labelLines }
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
