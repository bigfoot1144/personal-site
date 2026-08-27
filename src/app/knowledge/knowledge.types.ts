export type TopicStatus = 'not-started' | 'in-progress' | 'completed';
export type ConnectionRelation = 'prerequisite' | 'related';
export type JournalEntryType = 'work' | 'note' | 'project';

export interface Topic {
  id: string;
  title: string;
  summary: string;
  tags?: string[];
  duration?: string;
  completionCriteria?: string;
  resources?: Array<{ label: string; url?: string }>;
}

export interface TopicPlacement {
  id: string;
  topicId: string;
  parentPlacementId?: string;
  curriculumIds: string[];
  order: number;
  contextLabel?: string;
}

export interface Curriculum {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  color: string;
  goalTopicId: string;
  topicIds: string[];
}

export interface Connection {
  id: string;
  source: string;
  target: string;
  relation: ConnectionRelation;
  curriculumIds: string[];
}

export interface CurriculaData {
  version: number;
  topics: Topic[];
  placements: TopicPlacement[];
  curricula: Curriculum[];
  connections: Connection[];
}

export interface JournalEntry {
  id: string;
  date: string;
  type: JournalEntryType;
  title: string;
  body: string;
  topicIds: string[];
  url?: string;
  statusUpdates?: Array<{ topicId: string; status: TopicStatus }>;
}

export interface JournalData {
  version: number;
  entries: JournalEntry[];
}

export interface PositionedTopic extends Topic {
  placementId: string;
  parentPlacementId?: string;
  placementCurriculumIds: string[];
  contextLabel?: string;
  x: number;
  y: number;
  status: TopicStatus;
  curriculumIds: string[];
  labelLines?: string[];
}

export interface KnowledgeRuntimeData extends CurriculaData {
  journal: JournalData;
  derived: {
    childrenByPlacement: Record<string, string[]>;
    placementsByTopic: Record<string, string[]>;
    orderedRootsByCurriculum: Record<string, string[]>;
    statusByTopic: Record<string, TopicStatus>;
    aggregateStatusByPlacement: Record<string, TopicStatus>;
    entriesByTopic: Record<string, number[]>;
    positions: Record<string, { x: number; y: number }>;
    placementPaths: Record<string, Record<string, string>>;
    searchRecords: Array<{ placementId: string; curriculumId: string; path: string; text: string }>;
    connectionPaths: Record<string, string>;
    labelLines: Record<string, string[]>;
  };
}
