import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import curriculaJson from '../../assets/knowledge/curricula.json';
import journalJson from '../../assets/knowledge/journal.json';
import { Connection, CurriculaData, JournalData, JournalEntry, PositionedTopic, Topic, TopicPlacement, TopicStatus } from './knowledge.types';

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

interface JourneySegment {
  id: string;
  source: PositionedTopic;
  target: PositionedTopic;
  status: TopicStatus;
}

type JourneyMarkerRole = 'start' | 'next' | 'current' | 'goal';

@Component({
  selector: 'app-knowledge',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './knowledge.component.html',
  styleUrl: './knowledge.component.scss'
})
export class KnowledgeComponent {
  @ViewChild('constellation') private graphSvg?: ElementRef<SVGSVGElement>;
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  readonly data = curriculaJson as unknown as CurriculaData;
  readonly journal = journalJson as unknown as JournalData;
  readonly baseNodes = this.createLayout();
  activeCurricula = new Set(this.data.curricula.map(curriculum => curriculum.id));
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
  hoveredPlacementId: string | null = null;
  focusedJourneyPlacementId: string | null = null;
  private zoomTargetId: string | null = null;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private pointerStartedAt = { x: 0, y: 0 };
  private panMoved = false;
  private cameraFrame: number | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private lastPinchDistance = 0;

  get isGalaxyView(): boolean {
    return !!this.selected && !this.selected.parentPlacementId;
  }

  get isSolarView(): boolean {
    return !!this.selected?.parentPlacementId;
  }

  get galaxyStars(): PositionedTopic[] {
    if (!this.selected || !this.isGalaxyView) return [];
    return this.data.placements
      .filter(placement => placement.parentPlacementId === this.selected!.placementId)
      .sort((first, second) => first.order - second.order)
      .map((placement, index) => this.positionGalaxyPlacement(placement, this.selected!, index));
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
      edge.curriculumIds.some(id => this.activeCurricula.has(id))
    );
  }

  get journeyProgress(): JourneyProgress[] {
    return this.data.curricula
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
          curriculumId: curriculum.id, title: curriculum.title, color: curriculum.color,
          start: stages[0] ?? ordered[0], current, goal,
          currentTitle: this.topicForPlacement(current).title,
          currentIndex: Math.max(0, stages.findIndex(placement => placement.id === current.id)),
          completedCount, total: stages.length,
          percent: stages.length ? completedCount / stages.length * 100 : 0,
          active: this.activeCurricula.has(curriculum.id)
        };
      })
      .filter(progress => !!progress.start && !!progress.current && !!progress.goal);
  }

  get galaxyJourneySegments(): JourneySegment[] {
    const stars = this.galaxyStars;
    return stars.slice(1).map((target, index) => ({
      id: stars[index].placementId + '-' + target.placementId,
      source: stars[index], target,
      status: this.segmentStatus(stars[index], target)
    }));
  }

  get searchResults(): TopicSearchResult[] {
    const query = this.searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    return this.data.placements
      .flatMap(placement => placement.curriculumIds
        .filter(curriculumId => this.activeCurricula.has(curriculumId))
        .map(curriculumId => ({
          placement,
          topic: this.topicForPlacement(placement),
          path: this.placementPath(placement, curriculumId)
        })))
      .filter(result => (result.topic.title + ' ' + result.topic.summary + ' ' + result.path).toLocaleLowerCase().includes(query))
      .slice(0, 8);
  }

  get alternatePlacements(): TopicPlacement[] {
    if (!this.selected) return [];
    return this.data.placements.filter(placement =>
      placement.topicId === this.selected!.id && placement.id !== this.selected!.placementId
    );
  }

  get selectedPlacementPaths(): Array<{ placement: TopicPlacement; path: string }> {
    if (!this.selected) return [];
    return this.data.placements
      .filter(placement => placement.topicId === this.selected!.id)
      .flatMap(placement => placement.curriculumIds.map(curriculumId => ({
        placement,
        path: this.placementPath(placement, curriculumId)
      })));
  }

  get detailTopic(): PositionedTopic | null {
    return this.detailsVisible ? this.selected : null;
  }

  get selectedEntries(): JournalEntry[] {
    if (!this.selected) return [];
    return this.journal.entries
      .filter(entry => entry.topicIds.includes(this.selected!.id))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  get orbitPlanets(): OrbitPlanet[] {
    if (!this.selected || !this.isSolarView) return [];

    const entries = this.selectedEntries.filter(entry => entry.type === 'note' || entry.type === 'project');
    return entries.map((entry, index) => {
      const ring = Math.floor(index / 6);
      const ringStart = ring * 6;
      const ringCount = Math.min(6, entries.length - ringStart);
      const position = index - ringStart;
      const density = Math.ceil(entry.body.length / 90) + (entry.type === 'project' ? 2 : 0);
      return {
        id: 'entry-' + entry.id,
        kind: entry.type,
        title: entry.title,
        entry,
        radius: 58 + ring * 44,
        angle: position * (360 / Math.max(1, ringCount)) + ring * 22,
        size: 3.5 + Math.min(5, density),
        duration: 17 + ring * 6 + this.stableNumber(entry.id) % 8
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
    const titles: string[] = [];
    let current: TopicPlacement | undefined = placement;
    while (current) {
      titles.unshift(this.topicForPlacement(current).title);
      current = current.parentPlacementId
        ? this.data.placements.find(candidate => candidate.id === current!.parentPlacementId)
        : undefined;
    }
    const ids = curriculumId ? [curriculumId] : placement.curriculumIds;
    const curricula = ids
      .map(id => this.data.curricula.find(curriculum => curriculum.id === id)?.title)
      .filter((title): title is string => !!title)
      .join(' + ');
    return (curricula ? curricula + ' › ' : '') + titles.join(' › ');
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

  bridgeX(index: number): number {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, this.alternatePlacements.length);
    return Math.cos(angle) * 105;
  }

  bridgeY(index: number): number {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, this.alternatePlacements.length);
    return Math.sin(angle) * 105;
  }

  placementColor(placement: TopicPlacement): string {
    return this.data.curricula.find(curriculum => placement.curriculumIds.includes(curriculum.id))?.color ?? '#7df9ff';
  }

  placementLabel(placement: TopicPlacement): string {
    return placement.contextLabel
      ?? placement.curriculumIds.map(id => this.data.curricula.find(curriculum => curriculum.id === id)?.title).filter(Boolean).join(' + ');
  }

  select(node: PositionedTopic): void {
    this.focusedJourneyPlacementId = null;
    this.selected = node;
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

  toggleCurriculum(id: string): void {
    const next = new Set(this.activeCurricula);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.activeCurricula = next;
  }

  curriculumActive(id: string): boolean {
    return this.activeCurricula.has(id);
  }

  nodeVisible(node: PositionedTopic): boolean {
    return node.placementCurriculumIds.some(id => this.activeCurricula.has(id));
  }

  nodeColor(node: PositionedTopic): string {
    const active = this.data.curricula.filter(c => node.placementCurriculumIds.includes(c.id) && this.activeCurricula.has(c.id));
    return active[0]?.color ?? '#8090b8';
  }

  planetColor(planet: OrbitPlanet): string {
    if (planet.topic) {
      return this.data.curricula.find(curriculum =>
        curriculum.topicIds.includes(planet.topic!.id) && this.activeCurricula.has(curriculum.id)
      )?.color ?? '#9fb3d8';
    }
    if (planet.kind === 'project') return '#ffcf70';
    if (planet.kind === 'note') return '#c58cff';
    return '#7df9ff';
  }

  edgeColor(edge: Connection): string {
    return this.data.curricula.find(c => edge.curriculumIds.includes(c.id) && this.activeCurricula.has(c.id))?.color ?? '#8090b8';
  }

  edgePath(edge: Connection): string {
    const source = this.nodeAt(edge.source);
    const target = this.nodeAt(edge.target);
    return 'M ' + source.x + ' ' + source.y + ' L ' + target.x + ' ' + target.y;
  }

  segmentPath(segment: JourneySegment): string {
    return 'M ' + segment.source.x + ' ' + segment.source.y + ' L ' + segment.target.x + ' ' + segment.target.y;
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
    if (role === 'current') return 'YOU ARE HERE';
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
    this.zoomTargetId = null;
    this.focusedJourneyPlacementId = node.placementId;
    this.setMotionPaused(false);
    this.animateCamera(node, 1.55);
  }

  nodeAt(id: string): PositionedTopic {
    return this.visibleNodes.find(node => node.placementId === id) ?? this.baseNodes[0];
  }

  childCount(node: PositionedTopic): number {
    return this.data.placements.filter(placement => placement.parentPlacementId === node.placementId).length;
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

    if (event.deltaY < 0 && !this.selected) {
      const directTargetId = this.hoveredPlacementId
        ?? (event.target as Element).closest<SVGGElement>('.topic-node')?.dataset['placementId']
        ?? null;
      if (directTargetId) this.zoomTargetId = directTargetId;

      if (nextScale >= 2.15 && this.zoomTargetId) {
        const targetNode = this.baseNodes.find(node =>
          node.placementId === this.zoomTargetId && this.nodeVisible(node)
        );
        if (targetNode) {
          this.selected = targetNode;
          this.detailsVisible = true;
          this.highlightedEntryId = null;
          this.zoomTargetId = null;
        }
      }
    } else if (event.deltaY > 0) {
      this.zoomTargetId = null;
      this.hoveredPlacementId = null;
      this.detailsVisible = false;
      if (this.selected && nextScale <= .7) {
        this.selected = null;
        this.highlightedEntryId = null;
        this.setMotionPaused(false);
      }
    }
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
    this.selected = null;
    this.focusedJourneyPlacementId = null;
    this.detailsVisible = false;
    this.highlightedEntryId = null;
    this.animateView(1, 0, 0);
  }

  private animateCamera(node: PositionedTopic, targetScale: number): void {
    this.animateView(targetScale, 500 - node.x * targetScale, 350 - node.y * targetScale);
  }

  private animateView(targetScale: number, targetPanX: number, targetPanY: number): void {
    this.cancelCamera();
    if (typeof requestAnimationFrame === 'undefined') {
      this.scale = targetScale;
      this.panX = targetPanX;
      this.panY = targetPanY;
      return;
    }
    const startScale = this.scale;
    const startX = this.panX;
    const startY = this.panY;
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / 700);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.scale = startScale + (targetScale - startScale) * eased;
      this.panX = startX + (targetPanX - startX) * eased;
      this.panY = startY + (targetPanY - startY) * eased;
      if (progress < 1) this.cameraFrame = requestAnimationFrame(step);
      else this.cameraFrame = null;
    };
    this.cameraFrame = requestAnimationFrame(step);
  }

  private cancelCamera(): void {
    if (this.cameraFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.cameraFrame);
      this.cameraFrame = null;
    }
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
    const positions = new Map<string, Array<{ x: number; y: number }>>();
    const laneCount = Math.max(1, this.data.curricula.length);
    this.data.curricula.forEach((curriculum, curriculumIndex) => {
      const path = this.orderedRootPlacements(curriculum.id);
      const laneDirection = -.45 + curriculumIndex * Math.PI * 2 / laneCount;
      const lanePhase = this.stableNumber(curriculum.id + '-ray') / 0xffffffff * Math.PI * 2;
      path.forEach((placement, index) => {
        const radiusJitter = index ? (this.stableNumber(placement.id + '-radial') % 9) - 4 : 0;
        const radius = index === 0 ? 0 : 34 + index * 28 + radiusJitter;
        const bend = index ? Math.sin(index * .72 + lanePhase) * .105 : 0;
        const angle = laneDirection + bend;
        const lateralJitter = index
          ? ((this.stableNumber(placement.id + curriculum.id + '-lateral') % 81) - 40)
          : 0;
        const points = positions.get(placement.id) ?? [];
        points.push({
          x: 500 + Math.cos(angle) * radius + Math.cos(laneDirection + Math.PI / 2) * lateralJitter,
          y: 350 + Math.sin(angle) * radius + Math.sin(laneDirection + Math.PI / 2) * lateralJitter
        });
        positions.set(placement.id, points);
      });
    });
    return this.data.placements.filter(placement => !placement.parentPlacementId).map(placement => {
      const points = positions.get(placement.id) ?? [{ x: 500, y: 350 }];
      const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
      const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
      return this.positioned(this.topicForPlacement(placement), placement,
        Math.max(80, Math.min(920, x)), Math.max(85, Math.min(615, y)));
    });
  }

  private positionGalaxyPlacement(placement: TopicPlacement, parent: PositionedTopic, index: number): PositionedTopic {
    const topic = this.topicForPlacement(placement);
    const radius = 30 + index * 9.5;
    const jitter = (this.stableNumber(placement.id) % 9 - 4) * .018;
    const angle = -Math.PI / 2 + index * .72 + jitter;
    return this.positioned(
      topic,
      placement,
      parent.x + Math.cos(angle) * radius,
      parent.y + Math.sin(angle) * radius
    );
  }

  private topicForPlacement(placement: TopicPlacement): Topic {
    const topic = this.data.topics.find(candidate => candidate.id === placement.topicId);
    if (!topic) throw new Error('Unknown topic for placement ' + placement.id);
    return topic;
  }

  private placementForNode(node: PositionedTopic): TopicPlacement {
    const placement = this.data.placements.find(candidate => candidate.id === node.placementId);
    if (!placement) throw new Error('Unknown placement ' + node.placementId);
    return placement;
  }

  private nodeForPlacement(placement: TopicPlacement): PositionedTopic {
    const base = this.baseNodes.find(node => node.placementId === placement.id);
    if (base) return base;
    const parent = placement.parentPlacementId
      ? this.data.placements.find(candidate => candidate.id === placement.parentPlacementId)
      : undefined;
    const parentNode = parent ? this.nodeForPlacement(parent) : undefined;
    const siblings = this.data.placements
      .filter(candidate => candidate.parentPlacementId === placement.parentPlacementId)
      .sort((first, second) => first.order - second.order);
    const index = siblings.findIndex(candidate => candidate.id === placement.id);
    return parentNode
      ? this.positionGalaxyPlacement(placement, parentNode, Math.max(0, index))
      : this.positioned(this.topicForPlacement(placement), placement, 500, 350);
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
      status: this.aggregateStatusForPlacement(placement),
      curriculumIds: this.data.curricula.filter(c => c.topicIds.includes(topic.id)).map(c => c.id)
    };
  }

  private statusFor(topicId: string): TopicStatus {
    let status: TopicStatus = 'not-started';
    const entries = [...this.journal.entries].sort((a, b) => a.date.localeCompare(b.date));
    for (const entry of entries) {
      const update = entry.statusUpdates?.find(item => item.topicId === topicId);
      if (update) status = update.status;
    }
    return status;
  }

  private aggregateStatusForPlacement(placement: TopicPlacement): TopicStatus {
    const direct = this.statusFor(placement.topicId);
    if (direct === 'completed') return 'completed';
    if (direct === 'in-progress') return 'in-progress';
    const children = this.data.placements.filter(candidate => candidate.parentPlacementId === placement.id);
    if (children.length) {
      const childStatuses = children.map(child => this.aggregateStatusForPlacement(child));
      if (childStatuses.every(status => status === 'completed')) return 'completed';
      if (childStatuses.some(status => status !== 'not-started')) return 'in-progress';
    }
    if (this.journal.entries.some(entry => entry.topicIds.includes(placement.topicId))) return 'in-progress';
    return 'not-started';
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
    const placements = this.data.placements.filter(placement => !placement.parentPlacementId && placement.curriculumIds.includes(curriculumId));
    const ids = new Set(placements.map(placement => placement.id));
    const edges = this.data.connections.filter(edge => edge.relation === 'prerequisite' && edge.curriculumIds.includes(curriculumId)
      && ids.has(edge.source) && ids.has(edge.target));
    const incoming = new Map(placements.map(placement => [placement.id, 0]));
    edges.forEach(edge => incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1));
    const queue = placements.filter(placement => incoming.get(placement.id) === 0).sort((a, b) => a.order - b.order);
    const ordered: TopicPlacement[] = [];
    while (queue.length) {
      const placement = queue.shift()!;
      ordered.push(placement);
      for (const edge of edges.filter(candidate => candidate.source === placement.id)) {
        incoming.set(edge.target, (incoming.get(edge.target) ?? 1) - 1);
        if (incoming.get(edge.target) === 0) {
          const target = placements.find(candidate => candidate.id === edge.target);
          if (target) queue.push(target);
          queue.sort((a, b) => a.order - b.order);
        }
      }
    }
    return ordered.concat(placements.filter(placement => !ordered.some(item => item.id === placement.id)).sort((a, b) => a.order - b.order));
  }
}
