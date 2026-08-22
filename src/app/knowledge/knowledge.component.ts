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
    if (next.has(id) && next.size > 1) next.delete(id);
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
    const nextScale = Math.max(.55, Math.min(2.4, previousScale * (event.deltaY > 0 ? .9 : 1.1)));

    this.scale = nextScale;
    this.panX = anchor.x - worldX * nextScale;
    this.panY = anchor.y - worldY * nextScale;

    if (event.deltaY < 0 && !this.selected) {
      const directTargetId = this.hoveredPlacementId
        ?? (event.target as Element).closest<SVGGElement>('.topic-node')?.dataset['placementId']
        ?? null;
      if (directTargetId) this.zoomTargetId = directTargetId;

      if (nextScale >= 1.15 && this.zoomTargetId) {
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
        this.scale = Math.max(.55, Math.min(2.4, this.scale * distance / this.lastPinchDistance));
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
    const placements = this.data.placements
      .filter(placement => !placement.parentPlacementId)
      .sort((first, second) => first.order - second.order);
    const nodes = placements.map(placement => {
      const topic = this.topicForPlacement(placement);
      return this.positioned(
        topic,
        placement,
        120 + this.stableNumber(placement.id + '-x') % 760,
        100 + this.stableNumber(placement.id + '-y') % 500
      );
    });

    for (let iteration = 0; iteration < 36; iteration++) {
      for (let firstIndex = 0; firstIndex < nodes.length; firstIndex++) {
        for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex++) {
          const first = nodes[firstIndex];
          const second = nodes[secondIndex];
          let dx = second.x - first.x;
          let dy = second.y - first.y;
          let distance = Math.hypot(dx, dy);
          if (distance === 0) {
            const angle = this.stableNumber(first.placementId + second.placementId) / 0xffffffff * Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distance = 1;
          }
          const minimumDistance = 145;
          if (distance >= minimumDistance) continue;
          const shift = (minimumDistance - distance) / 2;
          first.x -= dx / distance * shift;
          first.y -= dy / distance * shift;
          second.x += dx / distance * shift;
          second.y += dy / distance * shift;
        }
      }
      for (const node of nodes) {
        node.x = Math.max(90, Math.min(910, node.x));
        node.y = Math.max(80, Math.min(620, node.y));
      }
    }
    return nodes;
  }

  private positionGalaxyPlacement(placement: TopicPlacement, parent: PositionedTopic, index: number): PositionedTopic {
    const topic = this.topicForPlacement(placement);
    const armCount = 3;
    const arm = index % armCount;
    const step = Math.floor(index / armCount);
    const radius = 34 + step * 22;
    const jitter = (this.stableNumber(placement.id) % 9 - 4) * .012;
    const angle = arm * Math.PI * 2 / armCount + step * .5 + jitter;
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
      status: this.statusFor(topic.id),
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
}
