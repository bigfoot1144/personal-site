import { readFile } from 'node:fs/promises';

const curricula = JSON.parse(await readFile(new URL('../src/assets/knowledge/curricula.json', import.meta.url), 'utf8'));
const journal = JSON.parse(await readFile(new URL('../src/assets/knowledge/journal.json', import.meta.url), 'utf8'));
const errors = [];
const array = (value, label) => {
  if (!Array.isArray(value)) errors.push(label + ' must be an array');
  return Array.isArray(value) ? value : [];
};
const idsFor = (items, label) => {
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) errors.push(label + ' contains an item without an id');
    else if (ids.has(item.id)) errors.push(label + ' contains duplicate id: ' + item.id);
    else ids.add(item.id);
  }
  return ids;
};

if (curricula.version !== 1) errors.push('curricula.json version must be 1');
if (journal.version !== 1) errors.push('journal.json version must be 1');
const topics = array(curricula.topics, 'topics');
const placements = array(curricula.placements, 'placements');
const curriculumList = array(curricula.curricula, 'curricula');
const connections = array(curricula.connections, 'connections');
const entries = array(journal.entries, 'journal entries');
const topicIds = idsFor(topics, 'topics');
const placementIds = idsFor(placements, 'placements');
const curriculumIds = idsFor(curriculumList, 'curricula');
idsFor(connections, 'connections');
idsFor(entries, 'journal entries');

for (const topic of topics) {
  if (typeof topic.title !== 'string' || typeof topic.summary !== 'string') errors.push('topic ' + topic.id + ' needs title and summary');
  if (topic.duration !== undefined && typeof topic.duration !== 'string') errors.push('topic ' + topic.id + ' has invalid duration');
  if (topic.completionCriteria !== undefined && typeof topic.completionCriteria !== 'string') errors.push('topic ' + topic.id + ' has invalid completion criteria');
  for (const resource of topic.resources ?? []) {
    if (!resource || typeof resource.label !== 'string' || !resource.label.trim()) errors.push('topic ' + topic.id + ' has a resource without a label');
    if (resource.url !== undefined && typeof resource.url !== 'string') errors.push('topic ' + topic.id + ' has an invalid resource URL');
  }
}
const placementContexts = new Set();
for (const placement of placements) {
  if (!topicIds.has(placement.topicId)) errors.push('placement ' + placement.id + ' has unknown topic ' + placement.topicId);
  if (placement.parentPlacementId && !placementIds.has(placement.parentPlacementId)) errors.push('placement ' + placement.id + ' has unknown parent ' + placement.parentPlacementId);
  if (!Number.isInteger(placement.order) || placement.order < 0) errors.push('placement ' + placement.id + ' has invalid order');
  for (const id of array(placement.curriculumIds, 'curriculumIds for ' + placement.id)) {
    if (!curriculumIds.has(id)) errors.push('placement ' + placement.id + ' references unknown curriculum ' + id);
    const curriculum = curriculumList.find(item => item.id === id);
    if (curriculum && !curriculum.topicIds.includes(placement.topicId)) errors.push('placement ' + placement.id + ' topic is not included in curriculum ' + id);
    const contextKey = placement.topicId + '|' + (placement.parentPlacementId ?? 'root') + '|' + id;
    if (placementContexts.has(contextKey)) errors.push('duplicate placement context for topic ' + placement.topicId + ' in curriculum ' + id);
    placementContexts.add(contextKey);
  }
}
for (const curriculum of curriculumList) {
  if (!topicIds.has(curriculum.goalTopicId)) errors.push('curriculum ' + curriculum.id + ' has unknown goal');
  for (const id of array(curriculum.topicIds, 'topicIds for ' + curriculum.id)) {
    if (!topicIds.has(id)) errors.push('curriculum ' + curriculum.id + ' references unknown topic ' + id);
  }
}
for (const edge of connections) {
  if (!placementIds.has(edge.source) || !placementIds.has(edge.target)) errors.push('connection ' + edge.id + ' has unknown endpoint');
  if (!['prerequisite', 'related'].includes(edge.relation)) errors.push('connection ' + edge.id + ' has invalid relation');
  for (const id of array(edge.curriculumIds, 'curriculumIds for ' + edge.id)) {
    if (!curriculumIds.has(id)) errors.push('connection ' + edge.id + ' references unknown curriculum ' + id);
    const sourcePlacement = placements.find(placement => placement.id === edge.source);
    const targetPlacement = placements.find(placement => placement.id === edge.target);
    if (sourcePlacement && targetPlacement && (!sourcePlacement.curriculumIds.includes(id) || !targetPlacement.curriculumIds.includes(id))) {
      errors.push('connection ' + edge.id + ' endpoints are not both placed in curriculum ' + id);
    }
  }
}
for (const entry of entries) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? '')) errors.push('journal entry ' + entry.id + ' has invalid date');
  if (!['work', 'note', 'project'].includes(entry.type)) errors.push('journal entry ' + entry.id + ' has invalid type');
  for (const id of array(entry.topicIds, 'topicIds for ' + entry.id)) {
    if (!topicIds.has(id)) errors.push('journal entry ' + entry.id + ' references unknown topic ' + id);
  }
  for (const update of entry.statusUpdates ?? []) {
    if (!topicIds.has(update.topicId)) errors.push('status update in ' + entry.id + ' references unknown topic');
    if (!['not-started', 'in-progress', 'completed'].includes(update.status)) errors.push('status update in ' + entry.id + ' is invalid');
  }
}

const detectCycle = (nodes, edges, label) => {
  const adjacency = new Map([...nodes].map(id => [id, []]));
  for (const [from, to] of edges) adjacency.get(from)?.push(to);
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
  if ([...nodes].some(visit)) errors.push(label + ' contains a cycle');
};

detectCycle(placementIds, placements.filter(placement => placement.parentPlacementId).map(placement => [placement.parentPlacementId, placement.id]), 'placement hierarchy');
detectCycle(placementIds, connections.filter(edge => edge.relation === 'prerequisite').map(edge => [edge.source, edge.target]), 'prerequisites');

if (errors.length) {
  console.error('Knowledge data validation failed:\n- ' + errors.join('\n- '));
  process.exitCode = 1;
} else {
  console.log('Knowledge data is valid: ' + topics.length + ' topics, ' + placements.length + ' placements, ' + curriculumList.length + ' curricula, ' + entries.length + ' journal entries.');
}
