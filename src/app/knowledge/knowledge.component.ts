import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import runtimeJson from './knowledge.runtime.json';
import { Connection, CurriculaData, JournalData, JournalEntry, KnowledgeRuntimeData, PositionedTopic, Topic, TopicPlacement, TopicStatus } from './knowledge.types';
import { ConstellationMorphStar, ConstellationTransitionService } from '../constellation-transition.service';

interface TopicSearchResult {
  placement: TopicPlacement;
  topic: Topic;
  path: string;
}

interface OrbitPlanet {
  id: string;
  kind: 'topic' | 'work' | 'note' | 'project';
  title: string;
  radius: number;
  angle: number;
  size: number;
  duration: number;
  topic?: Topic;
  entry?: JournalEntry;
}

interface JourneyProgress {
  curriculumId: string;
  title: string;
  shortTitle: string;
  color: string;
  start: TopicPlacement;
  current: TopicPlacement;
  goal: TopicPlacement;
  currentTitle: string;
  currentIndex: number;
  completedCount: number;
  total: number;
  percent: number;
  active: boolean;
}

type JourneyMarkerRole = 'start' | 'next' | 'current' | 'goal';

@Component({
  selector: 'app-knowledge',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './knowledge.component.html',
  styleUrl: './knowledge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KnowledgeComponent implements AfterViewInit, OnDestroy {
  constructor(
    private readonly zone: NgZone,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly constellationTransition: ConstellationTransitionService
  ) {}
  @ViewChild('constellation') private graphSvg?: ElementRef<SVGSVGElement>;
  @ViewChild('graphStage') private graphStage?: ElementRef<SVGGElement>;
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  readonly runtime = runtimeJson as unknown as KnowledgeRuntimeData;
  readonly data = this.runtime as CurriculaData;
  readonly journal = this.runtime.journal;
  private readonly derived = this.runtime.derived;
  private readonly topicById = new Map(this.data.topics.map(topic => [topic.id, topic]));
  private readonly placementById = new Map(this.data.placements.map(placement => [placement.id, placement]));
  private readonly curriculumById = new Map(this.data.curricula.map(curriculum => [curriculum.id, curriculum]));
  readonly baseNodes = this.createLayout();
  private journeyProgressCache: JourneyProgress[] | null = null;
  private galaxyStarsCache: { key: string; nodes: PositionedTopic[] } | null = null;
  private searchCache: { key: string; results: TopicSearchResult[] } | null = null;
  private readonly curriculumDockOrder = ['ml-training', 'inference', 'gpu', 'agentic', 'robotics', 'data-science', 'portrait-drawing', 'physics'];
  activeCurricula = new Set(this.data.curricula.map(curriculum => curriculum.id));
  selectedCurriculumId = 'ml-training';
  journeyPanelVisible = true;
  showChildCounts = true;
  selected: PositionedTopic | null = null;
  scale = 1;
  panX = 0;
  panY = 0;
  highlightedEntryId: string | null = null;
  detailsVisible = false;
  searchOpen = false;
  searchQuery = '';
  searchActiveIndex = 0;
  motionPaused = false;
  focusedJourneyPlacementId: string | null = null;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private pointerStartedAt = { x: 0, y: 0 };
  private panMoved = false;
  private cameraFrame: number | null = null;
  private unregisterSnapshotProvider: (() => void) | null = null;
  private ambientParallaxSuspended = false;
  private overviewCameraBeforeDrilldown: { scale: number; panX: number; panY: number } | null = null;
  routeMorphing = true;
  private pointers = new Map<number, { x: number; y: number }>();
  private lastPinchDistance = 0;

  ngAfterViewInit(): void {
    this.unregisterSnapshotProvider = this.constellationTransition.registerSnapshotProvider(
      () => this.constellationSnapshot(this.visibleNodes));
    if (typeof requestAnimationFrame === 'undefined') {
      this.routeMorphing = false;
      return;
    }
    requestAnimationFrame(() => {
      const targets = this.constellationSnapshot(this.baseNodes);
      this.publishCameraState();
      void this.constellationTransition.morphToConstellation(targets).then(() => {
        this.routeMorphing = false;
        this.changeDetector.markForCheck();
      });
    });
  }

  ngOnDestroy(): void {
    this.unregisterSnapshotProvider?.();
    this.cancelCamera();
  }

  private constellationSnapshot(nodes: PositionedTopic[]): ConstellationMorphStar[] {
    const svg = this.graphSvg?.nativeElement;
    if (!svg || typeof getComputedStyle === 'undefined') return [];
    return nodes.flatMap(node => {
      const group = svg.querySelector(`[data-placement-id="${node.placementId}"]`);
      const core = group?.querySelector('.star-core') as SVGGraphicsElement | null;
      if (!core) return [];
      const bounds = core.getBoundingClientRect();
      return [{
        id: node.placementId,
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
        size: Math.max(2, bounds.width),
        color: getComputedStyle(core).fill || this.nodeColor(node)
      }];
    });
  }

  private publishCameraState(): void {
    const svg = this.graphSvg?.nativeElement;
    if (!svg) return;
    const bounds = svg.getBoundingClientRect();
    this.constellationTransition.updateKnowledgeCamera({
      scale: this.scale,
      panX: this.panX,
      panY: this.panY,
      viewportWidth: bounds.width || window.innerWidth,
      viewportHeight: bounds.height || window.innerHeight,
      parallaxActive: !this.selected && !this.ambientParallaxSuspended
    });
  }

  get isGalaxyView(): boolean {
    return !!this.selected && !this.selected.parentPlacementId;
  }


  get graphLabelScale(): number {
    const screenScale = Math.max(.9, Math.min(1.28, 1 + (this.scale - 1) * .24));
    return screenScale / this.scale;
  }
  get isSolarView(): boolean {
    return !!this.selected?.parentPlacementId;
  }

  get galaxyStars(): PositionedTopic[] {
    if (!this.selected || !this.isGalaxyView) return [];
    const key = this.selected.placementId;
    if (this.galaxyStarsCache?.key === key) return this.galaxyStarsCache.nodes;
    const nodes = (this.derived.childrenByPlacement[key] as string[]).map((id: string) => this.nodeForPlacement(this.placementById.get(id)!));
    this.galaxyStarsCache = { key, nodes };
    return nodes;
  }

  get visibleNodes(): PositionedTopic[] {
    if (!this.selected) return this.baseNodes;
    if (this.isGalaxyView) return this.galaxyStars;
    return [this.selected];
  }

  get visibleConnections(): Connection[] {
    const ids = new Set(this.visibleNodes.map(node => node.placementId));
    return this.data.connections.filter(edge =>
      ids.has(edge.source) && ids.has(edge.target) &&
      (!!this.selected || edge.curriculumIds.some(id => this.activeCurricula.has(id)))
    );
  }

  get journeyProgress(): JourneyProgress[] {
    if (this.journeyProgressCache) return this.journeyProgressCache;
    const result = this.data.curricula
      .map(curriculum => {
        const ordered = this.orderedRootPlacements(curriculum.id);
        const stages = ordered.filter(placement => !this.topicForPlacement(placement).tags?.includes('goal'));
        const explicitCurrent = stages.find(placement => this.statusFor(placement.topicId) === 'in-progress');
        const current = explicitCurrent
          ?? stages.find(placement => this.aggregateStatusForPlacement(placement) !== 'completed')
          ?? ordered[ordered.length - 1];
        const goal = ordered.find(placement => this.topicForPlacement(placement).tags?.includes('goal'))
          ?? ordered[ordered.length - 1];
        const completedCount = stages.filter(placement => this.aggregateStatusForPlacement(placement) === 'completed').length;
        return {
          curriculumId: curriculum.id, title: curriculum.title, shortTitle: curriculum.shortTitle, color: curriculum.color,
          start: stages[0] ?? ordered[0], current, goal,
          currentTitle: this.topicForPlacement(current).title,
          currentIndex: Math.max(0, stages.findIndex(placement => placement.id === current.id)),
          completedCount, total: stages.length,
          percent: stages.length ? completedCount / stages.length * 100 : 0,
          active: this.activeCurricula.has(curriculum.id)
        };
      })
      .filter(progress => !!progress.start && !!progress.current && !!progress.goal)
      .sort((first, second) => this.curriculumDockOrder.indexOf(first.curriculumId) - this.curriculumDockOrder.indexOf(second.curriculumId));
    this.journeyProgressCache = result;
    return result;
  }

  get selectedJourney(): JourneyProgress | null {
    return this.journeyProgress.find(progress => progress.curriculumId === this.selectedCurriculumId) ?? this.journeyProgress[0] ?? null;
  }

  get searchResults(): TopicSearchResult[] {
    const query = this.searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    const key = query + '|' + [...this.activeCurricula].sort().join(',');
    if (this.searchCache?.key === key) return this.searchCache.results;
    const results = this.derived.searchRecords
      .filter((record) => this.activeCurricula.has(record.curriculumId) && record.text.includes(query))
      .slice(0, 8)
      .map((record) => ({ placement: this.placementById.get(record.placementId)!, topic: this.topicForPlacement(this.placementById.get(record.placementId)!), path: record.path }));
    this.searchCache = { key, results };
    return results;
  }

  get selectedPlacementPaths(): Array<{ placement: TopicPlacement; path: string }> {
    if (!this.selected) return [];
    return (this.derived.placementsByTopic[this.selected.id] as string[]).flatMap(id => {
      const placement = this.placementById.get(id)!;
      return placement.curriculumIds.map(curriculumId => ({ placement, path: this.placementPath(placement, curriculumId) }));
    });
  }

  get detailTopic(): PositionedTopic | null {
    return this.detailsVisible ? this.selected : null;
  }

  get selectedEntries(): JournalEntry[] {
    if (!this.selected) return [];
    return (this.derived.entriesByTopic[this.selected.id] as number[]).map(index => this.journal.entries[index]);
  }

  get orbitPlanets(): OrbitPlanet[] {
    if (!this.selected || !this.isSolarView) return [];

    const entries = this.selectedEntries.filter(entry => entry.type === 'note' || entry.type === 'project');
    return entries.map((entry, index) => {
      const hash = this.stableNumber(entry.id);
      const ring = hash % 5;
      const ringPosition = Math.floor(index / 5);
      const angleJitter = (hash >>> 8) % 29;
      const density = Math.ceil(entry.body.length / 90) + (entry.type === 'project' ? 2 : 0);
      return {
        id: 'entry-' + entry.id,
        kind: entry.type,
        title: entry.title,
        entry,
        radius: 52 + ring * 28,
        angle: (ringPosition * 137.5 + ring * 31 + angleJitter) % 360,
        size: 2.25 + Math.min(4.5, density * .55 + ((hash >>> 16) % 3) * .45),
        duration: 15 + ring * 5 + (hash >>> 24) % 7
      };
    });
  }

  get orbitRadii(): number[] {
    return [...new Set(this.orbitPlanets.map(planet => planet.radius))];
  }

  get breadcrumbs(): PositionedTopic[] {
    if (!this.selected) return [];
    const trail: PositionedTopic[] = [];
    let current: PositionedTopic | undefined = this.selected;
    while (current) {
      trail.unshift(current);
      const parentPlacement: TopicPlacement | undefined = current.parentPlacementId
        ? this.data.placements.find(placement => placement.id === current!.parentPlacementId)
        : undefined;
      current = parentPlacement
        ? this.baseNodes.find(node => node.placementId === parentPlacement.id)
          ?? this.positioned(this.topicForPlacement(parentPlacement), parentPlacement, current.x, current.y)
        : undefined;
    }
    return trail;
  }

  placementPath(placement: TopicPlacement, curriculumId?: string): string {
    const id = curriculumId ?? placement.curriculumIds[0];
    return this.derived.placementPaths[placement.id][id];
  }

  openSearch(): void {
    this.searchOpen = true;
    this.searchActiveIndex = 0;
    setTimeout(() => this.searchInput?.nativeElement.focus());
  }

  closeSearch(): void {
    this.searchOpen = false;
    this.searchQuery = '';
    this.searchActiveIndex = 0;
  }

  updateSearch(query: string): void {
    this.searchQuery = query;
    this.searchActiveIndex = 0;
  }

  handleSearchKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' && this.searchResults.length) {
      event.preventDefault();
      this.searchActiveIndex = (this.searchActiveIndex + 1) % this.searchResults.length;
    } else if (event.key === 'ArrowUp' && this.searchResults.length) {
      event.preventDefault();
      this.searchActiveIndex = (this.searchActiveIndex - 1 + this.searchResults.length) % this.searchResults.length;
    } else if (event.key === 'Enter' && this.searchResults[this.searchActiveIndex]) {
      event.preventDefault();
      this.selectSearchResult(this.searchResults[this.searchActiveIndex]);
    }
  }

  selectSearchResult(result: TopicSearchResult): void {
    const node = this.nodeForPlacement(result.placement);
    this.closeSearch();
    this.select(node);
  }

  setMotionPaused(paused: boolean): void {
    if (this.motionPaused === paused) return;
    this.motionPaused = paused;
    const svg = this.graphSvg?.nativeElement;
    if (!svg) return;
    if (paused) svg.pauseAnimations();
    else svg.unpauseAnimations();
  }

  activatePlacement(placement: TopicPlacement): void {
    this.select(this.nodeForPlacement(placement));
  }



  select(node: PositionedTopic): void {
    this.focusedJourneyPlacementId = null;
    if (!this.selected) {
      this.overviewCameraBeforeDrilldown = { scale: this.scale, panX: this.panX, panY: this.panY };
      this.ambientParallaxSuspended = true;
    }
    this.selected = node;
    this.publishCameraState();
    this.setMotionPaused(false);
    this.detailsVisible = true;
    this.highlightedEntryId = null;
    this.animateCamera(node, 1.75);
  }

  goUpLevel(): void {
    if (!this.selected) return;
    if (!this.selected.parentPlacementId) {
      this.resetView();
      return;
    }
    const parentPlacement = this.data.placements.find(placement => placement.id === this.selected!.parentPlacementId);
    if (!parentPlacement) {
      this.resetView();
      return;
    }
    this.select(this.nodeForPlacement(parentPlacement));
  }

  navigateBreadcrumb(node: PositionedTopic): void {
    this.select(this.nodeForPlacement(this.placementForNode(node)));
  }

  activatePlanet(planet: OrbitPlanet): void {
    this.highlightedEntryId = planet.entry?.id ?? null;
  }

  selectCurriculum(id: string): void {
    if (!this.curriculumById.has(id)) return;
    const alreadySelected = id === this.selectedCurriculumId;
    const leavingDrilldown = !!this.selected;
    this.selectedCurriculumId = id;
    this.journeyPanelVisible = alreadySelected ? !this.journeyPanelVisible : true;
    if (this.selected) {
      this.selected = null;
      this.detailsVisible = false;
      this.highlightedEntryId = null;
      this.focusedJourneyPlacementId = null;
      this.setMotionPaused(false);
    }
    this.focusCurriculum(id, leavingDrilldown ? () => {
      this.ambientParallaxSuspended = false;
      this.overviewCameraBeforeDrilldown = null;
      this.publishCameraState();
    } : undefined);
  }

  handleCurriculumDockKey(event: KeyboardEvent, index: number): void {
    const last = this.journeyProgress.length - 1;
    let nextIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = index === 0 ? last : index - 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = last;
    else return;
    event.preventDefault();
    const next = this.journeyProgress[nextIndex];
    this.selectCurriculum(next.curriculumId);
    if (typeof document !== 'undefined') document.getElementById('curriculum-tab-' + next.curriculumId)?.focus();
  }

  trackJourney(_index: number, progress: JourneyProgress): string {
    return progress.curriculumId;
  }

  toggleCurriculum(id: string): void {
    const next = new Set(this.activeCurricula);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.activeCurricula = next;
    this.journeyProgressCache = null;
    this.searchCache = null;
  }

  deselectAllCurricula(): void {
    if (this.activeCurricula.size) {
      this.activeCurricula = new Set();
    } else {
      this.activeCurricula = new Set(this.data.curricula.map(curriculum => curriculum.id));
      this.resetView();
    }
    this.journeyProgressCache = null;
    this.searchCache = null;
  }

  curriculumActive(id: string): boolean {
    return this.activeCurricula.has(id);
  }

  nodeVisible(node: PositionedTopic): boolean {
    return !!this.selected || node.placementCurriculumIds.some(id => this.activeCurricula.has(id));
  }

  nodeMuted(node: PositionedTopic): boolean {
    return !this.selected && this.activeCurricula.has(this.selectedCurriculumId) &&
      !node.placementCurriculumIds.includes(this.selectedCurriculumId);
  }

  edgeMuted(edge: Connection): boolean {
    return !this.selected && this.activeCurricula.has(this.selectedCurriculumId) &&
      !edge.curriculumIds.includes(this.selectedCurriculumId);
  }

  isCenterNode(node: PositionedTopic): boolean {
    return !node.parentPlacementId && node.x === 500 && node.y === 350;
  }

  centerNodeActive(node: PositionedTopic): boolean {
    return !this.isCenterNode(node) || node.placementCurriculumIds.includes(this.selectedCurriculumId);
  }

  nodeCurriculumColors(node: PositionedTopic): string[] {
    return node.placementCurriculumIds.map(id => this.curriculumById.get(id)?.color ?? '#8090b8');
  }

  nodeColor(node: PositionedTopic): string {
    const matching = this.data.curricula.filter(c =>
      node.placementCurriculumIds.includes(c.id) && (!!this.selected || this.activeCurricula.has(c.id))
    );
    return matching[0]?.color ?? '#8090b8';
  }

  planetColor(planet: OrbitPlanet): string {
    if (planet.topic) {
      return this.data.curricula.find(curriculum =>
        curriculum.topicIds.includes(planet.topic!.id) && (!!this.selected || this.activeCurricula.has(curriculum.id))
      )?.color ?? '#9fb3d8';
    }
    if (planet.kind === 'project') return '#ffcf70';
    if (planet.kind === 'note') return '#c58cff';
    return '#7df9ff';
  }

  edgeColor(edge: Connection): string {
    return this.data.curricula.find(c =>
      edge.curriculumIds.includes(c.id) && (!!this.selected || this.activeCurricula.has(c.id))
    )?.color ?? '#8090b8';
  }

  edgePath(edge: Connection): string {
    return this.derived.connectionPaths[edge.id];
  }

  edgeStatus(edge: Connection): TopicStatus {
    return this.segmentStatus(this.nodeAt(edge.source), this.nodeAt(edge.target), edge.curriculumIds);
  }

  journeyMarker(node: PositionedTopic): JourneyMarkerRole | null {
    if (this.isGalaxyView) {
      const stars = this.galaxyStars;
      const index = stars.findIndex(star => star.placementId === node.placementId);
      if (index < 0) return null;
      const explicit = stars.find(star => this.statusFor(star.id) === 'in-progress');
      const current = explicit ?? stars.find(star => star.status !== 'completed') ?? stars[stars.length - 1];
      if (node.placementId === current?.placementId) return explicit ? 'current' : 'next';
      if (index === 0) return 'start';
      return null;
    }
    const matching = this.journeyProgress.filter(progress =>
      this.orderedRootPlacements(progress.curriculumId).some(placement => placement.id === node.placementId));
    if (matching.some(progress => progress.current.id === node.placementId)) {
      return this.statusFor(node.id) === 'in-progress' ? 'current' : 'next';
    }
    if (matching.some(progress => progress.start.id === node.placementId)) return 'start';
    if (matching.some(progress => progress.goal.id === node.placementId)) return 'goal';
    return null;
  }

  journeyMarkerLabel(role: JourneyMarkerRole, node: PositionedTopic): string {
    if (role === 'next') {
      const startsHere = this.isGalaxyView
        ? this.galaxyStars[0]?.placementId === node.placementId
        : this.journeyProgress.some(progress => progress.start.id === node.placementId);
      return startsHere ? 'START · NEXT UP' : 'NEXT UP';
    }
    if (role === 'current') return 'NEXT UP';
    if (role === 'goal') return 'DESTINATION';
    return 'START';
  }

  journeyOrdinal(node: PositionedTopic): number | null {
    if (this.isGalaxyView) {
      const index = this.galaxyStars.findIndex(star => star.placementId === node.placementId);
      return index < 0 ? null : index + 1;
    }
    for (const progress of this.journeyProgress) {
      const stages = this.orderedRootPlacements(progress.curriculumId)
        .filter(placement => !this.topicForPlacement(placement).tags?.includes('goal'));
      const index = stages.findIndex(placement => placement.id === node.placementId);
      if (index >= 0) return index + 1;
    }
    return null;
  }

  focusJourneyPlacement(placement: TopicPlacement, curriculumId?: string): void {
    if (curriculumId && !this.activeCurricula.has(curriculumId)) {
      this.activeCurricula = new Set([...this.activeCurricula, curriculumId]);
    }
    this.select(this.nodeForPlacement(placement));
  }

  jumpToNext(progress: JourneyProgress): void {
    if (!this.activeCurricula.has(progress.curriculumId)) {
      this.activeCurricula = new Set([...this.activeCurricula, progress.curriculumId]);
    }
    const node = this.nodeForPlacement(progress.current);
    this.selected = null;
    this.detailsVisible = false;
    this.highlightedEntryId = null;
    this.focusedJourneyPlacementId = node.placementId;
    this.setMotionPaused(false);
    this.animateCamera(node, 1.55);
  }

  nodeAt(id: string): PositionedTopic {
    return this.visibleNodes.find(node => node.placementId === id) ?? this.baseNodes[0];
  }

  childCount(node: PositionedTopic): number {
    return (this.derived.childrenByPlacement[node.placementId] as string[] | undefined)?.length ?? 0;
  }

  trackNode(_index: number, node: PositionedTopic): string {
    return node.placementId;
  }

  trackPlanet(_index: number, planet: OrbitPlanet): string {
    return planet.id;
  }

  galaxyDelay(node: PositionedTopic): number {
    return Math.max(0, this.galaxyStars.findIndex(star => star.placementId === node.placementId)) * 75;
  }

  starSize(node: PositionedTopic): number {
    if (this.isGalaxyView) return 3 + this.stableNumber(node.id + '-size') % 5;
    return node.tags?.includes('goal') ? 6 : 4;
  }

  spawnX(node: PositionedTopic): number {
    if (node.parentPlacementId && this.selected) return this.selected.x - node.x;
    const index = this.baseNodes.findIndex(item => item.placementId === node.placementId);
    return ((index * 137 + 83) % 900) - node.x;
  }

  spawnY(node: PositionedTopic): number {
    if (node.parentPlacementId && this.selected) return this.selected.y - node.y;
    const index = this.baseNodes.findIndex(item => item.placementId === node.placementId);
    return ((index * 211 + 61) % 620) - node.y;
  }

  statusLabel(status: TopicStatus): string {
    return status.replace('-', ' ');
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.cancelCamera();

    const svg = event.currentTarget as SVGSVGElement;
    const anchor = this.svgPoint(svg, event.clientX, event.clientY);
    const previousScale = this.scale;
    const worldX = (anchor.x - this.panX) / previousScale;
    const worldY = (anchor.y - this.panY) / previousScale;
    const rawZoomFactor = Math.exp(-event.deltaY * .001);
    const zoomFactor = Math.max(.94, Math.min(1.06, rawZoomFactor));
    const nextScale = Math.max(.55, Math.min(3.2, previousScale * zoomFactor));

    this.scale = nextScale;
    this.panX = anchor.x - worldX * nextScale;
    this.panY = anchor.y - worldY * nextScale;
    this.applyGraphTransform();
  }

  startPan(event: PointerEvent): void {
    const target = event.target as Element;
    if (target.closest('.topic-node, .child-badge, .planet-node, a, button')) {
      return;
    }

    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    if (this.pointers.size === 2) {
      this.cancelCamera();
      this.dragging = false;
      this.lastPinchDistance = this.pointerDistance();
      return;
    }
    this.cancelCamera();
    this.dragging = true;
    this.panMoved = false;
    this.pointerStartedAt = { x: event.clientX, y: event.clientY };
    this.lastPointer = { x: event.clientX, y: event.clientY };
  }

  movePan(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2) {
      this.panMoved = true;
      const distance = this.pointerDistance();
      if (this.lastPinchDistance) {
        this.scale = Math.max(.55, Math.min(3.2, this.scale * distance / this.lastPinchDistance));
        this.applyGraphTransform();
      }
      this.lastPinchDistance = distance;
      return;
    }
    if (!this.dragging) return;
    if (Math.hypot(event.clientX - this.pointerStartedAt.x, event.clientY - this.pointerStartedAt.y) > 5) {
      this.panMoved = true;
    }
    const svg = event.currentTarget as SVGSVGElement;
    const unitScale = 1000 / Math.max(1, svg.clientWidth);
    this.panX += (event.clientX - this.lastPointer.x) * unitScale;
    this.panY += (event.clientY - this.lastPointer.y) * unitScale;
    this.applyGraphTransform();
    this.lastPointer = { x: event.clientX, y: event.clientY };
  }

  endPan(event: PointerEvent): void {
    const navigateUp = this.pointers.size === 1 && this.pointers.has(event.pointerId)
      && !this.panMoved && !!this.selected;
    this.pointers.delete(event.pointerId);
    this.lastPinchDistance = 0;
    this.dragging = false;
    if (navigateUp) this.goUpLevel();
  }

  cancelPan(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    this.lastPinchDistance = 0;
    this.dragging = false;
    this.panMoved = true;
  }

  private svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): DOMPoint {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    if (matrix) return point.matrixTransform(matrix.inverse());

    const bounds = svg.getBoundingClientRect();
    return new DOMPoint(
      (clientX - bounds.left) * 1000 / Math.max(1, bounds.width),
      (clientY - bounds.top) * 700 / Math.max(1, bounds.height)
    );
  }

  private pointerDistance(): number {
    const [first, second] = [...this.pointers.values()];
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  resetView(): void {
    const target = this.overviewCameraBeforeDrilldown ?? { scale: 1, panX: 0, panY: 0 };
    this.selected = null;
    this.focusedJourneyPlacementId = null;
    this.detailsVisible = false;
    this.highlightedEntryId = null;
    this.animateView(target.scale, target.panX, target.panY, () => {
      this.ambientParallaxSuspended = false;
      this.overviewCameraBeforeDrilldown = null;
      this.publishCameraState();
    });
  }

  private focusCurriculum(curriculumId: string, onComplete?: () => void): void {
    const nodes = this.baseNodes.filter(node => node.placementCurriculumIds.includes(curriculumId));
    if (!nodes.length) return;
    const minX = Math.min(...nodes.map(node => node.x));
    const maxX = Math.max(...nodes.map(node => node.x));
    const minY = Math.min(...nodes.map(node => node.y));
    const maxY = Math.max(...nodes.map(node => node.y));
    const paddedWidth = Math.max(1, maxX - minX + 110);
    const paddedHeight = Math.max(1, maxY - minY + 120);
    const targetScale = Math.max(.65, Math.min(1.45, 780 / paddedWidth, 450 / paddedHeight));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    this.animateView(targetScale, 500 - centerX * targetScale, 320 - centerY * targetScale, onComplete);
  }

  private animateCamera(node: PositionedTopic, targetScale: number): void {
    this.animateView(targetScale, 500 - node.x * targetScale, 350 - node.y * targetScale);
  }

  private animateView(targetScale: number, targetPanX: number, targetPanY: number, onComplete?: () => void): void {
    this.cancelCamera();
    if (typeof requestAnimationFrame === 'undefined') {
      this.scale = targetScale; this.panX = targetPanX; this.panY = targetPanY;
      this.applyGraphTransform();
      onComplete?.();
      return;
    }
    const startScale = this.scale;
    const startX = this.panX;
    const startY = this.panY;
    const started = performance.now();
    this.zone.runOutsideAngular(() => {
      const step = (now: number) => {
        const progress = Math.min(1, (now - started) / 700);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.scale = startScale + (targetScale - startScale) * eased;
        this.panX = startX + (targetPanX - startX) * eased;
        this.panY = startY + (targetPanY - startY) * eased;
        this.applyGraphTransform();
        if (progress < 1) this.cameraFrame = requestAnimationFrame(step);
        else {
          this.cameraFrame = null;
          onComplete?.();
          this.zone.run(() => this.changeDetector.markForCheck());
        }
      };
      this.cameraFrame = requestAnimationFrame(step);
    });
  }

  private applyGraphTransform(): void {
    const stage = this.graphStage?.nativeElement;
    if (!stage) return;
    stage.setAttribute('transform', 'matrix(' + this.scale + ' 0 0 ' + this.scale + ' ' + this.panX + ' ' + this.panY + ')');
    stage.style.setProperty('--label-scale', String(this.graphLabelScale));
    this.publishCameraState();
  }

  private cancelCamera(): void {
    if (this.cameraFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.cameraFrame);
      this.cameraFrame = null;
    }
  }

  @HostListener('window:resize')
  onKnowledgeResize(): void {
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => this.publishCameraState());
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const editing = target?.matches('input, textarea, [contenteditable="true"]');
    if (event.key === '/' && !editing && !this.searchOpen) {
      event.preventDefault();
      this.openSearch();
      return;
    }
    if (event.key === 'Escape') {
      if (this.searchOpen) this.closeSearch();
      else this.goUpLevel();
      return;
    }
    if (event.key === 'Backspace' && !editing && this.selected) {
      event.preventDefault();
      this.goUpLevel();
    }
  }

  private createLayout(): PositionedTopic[] {
    return this.data.placements
      .filter(placement => !placement.parentPlacementId)
      .map(placement => this.nodeForPlacement(placement));
  }

  private positionGalaxyPlacement(placement: TopicPlacement, _parent: PositionedTopic, _index: number): PositionedTopic {
    return this.nodeForPlacement(placement);
  }

  private topicForPlacement(placement: TopicPlacement): Topic {
    const topic = this.topicById.get(placement.topicId);
    if (!topic) throw new Error('Unknown topic for placement ' + placement.id);
    return topic;
  }

  private placementForNode(node: PositionedTopic): TopicPlacement {
    const placement = this.placementById.get(node.placementId);
    if (!placement) throw new Error('Unknown placement ' + node.placementId);
    return placement;
  }

  private nodeForPlacement(placement: TopicPlacement): PositionedTopic {
    const position = this.derived.positions[placement.id] ?? { x: 500, y: 350 };
    return { ...this.positioned(this.topicForPlacement(placement), placement, position.x, position.y), labelLines: this.derived.labelLines[placement.id] ?? [this.topicForPlacement(placement).title] };
  }

  private stableNumber(value: string): number {
    let hash = 2166136261;
    for (const character of value) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    }
    return hash >>> 0;
  }

  private positioned(topic: Topic, placement: TopicPlacement, x: number, y: number): PositionedTopic {
    return {
      ...topic,
      placementId: placement.id,
      parentPlacementId: placement.parentPlacementId,
      placementCurriculumIds: placement.curriculumIds,
      contextLabel: placement.contextLabel,
      x,
      y,
      status: this.derived.aggregateStatusByPlacement[placement.id] as TopicStatus,
      curriculumIds: this.data.curricula.filter(c => c.topicIds.includes(topic.id)).map(c => c.id)
    };
  }

  private statusFor(topicId: string): TopicStatus {
    return this.derived.statusByTopic[topicId] as TopicStatus;
  }

  private aggregateStatusForPlacement(placement: TopicPlacement): TopicStatus {
    return this.derived.aggregateStatusByPlacement[placement.id] as TopicStatus;
  }

  private segmentStatus(source: PositionedTopic, target: PositionedTopic, curriculumIds: string[] = []): TopicStatus {
    if (target.status === 'completed') return 'completed';
    const currentIds = curriculumIds.length
      ? this.journeyProgress.filter(progress => curriculumIds.includes(progress.curriculumId)).map(progress => progress.current.id)
      : [];
    if (source.status === 'in-progress' || target.status === 'in-progress' || currentIds.includes(target.placementId)) return 'in-progress';
    if (!curriculumIds.length && this.isGalaxyView) {
      const stars = this.galaxyStars;
      const explicit = stars.find(star => this.statusFor(star.id) === 'in-progress');
      const current = explicit ?? stars.find(star => star.status !== 'completed');
      if (current?.placementId === target.placementId) return 'in-progress';
    }
    return 'not-started';
  }

  private orderedRootPlacements(curriculumId: string): TopicPlacement[] {
    return (this.derived.orderedRootsByCurriculum[curriculumId] as string[]).map(id => this.placementById.get(id)!);
  }
}
