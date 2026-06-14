import { forceCollide } from 'd3-force';
import ForceGraph from 'force-graph';
import React, { useEffect, useRef } from 'react';
import { PhysicsConfig } from '../App';
import { BookmarkNode, GraphNode, RenderGraphLink, RenderGraphNode } from '../types';
import { bookmarkService } from '../utils/bookmarkService';
import { drawLink, drawNode } from './graphCanvasRenderer';

interface BookmarkGraphProps {
    searchQuery: string;
    physicsConfig: PhysicsConfig;
}

const transformData = (tree: BookmarkNode[]): GraphData => {
    const nodes: GraphNode[] = [];
    const links: { source: string; target: string }[] = [];

    const traverse = (items: BookmarkNode[], parentId: string | null = null, depth: number = 0) => {
        items.forEach(item => {
            const isFolder = !item.url;
            const isRoot = parentId === null || depth === 0;

            let val = 4;
            if (isRoot) {
                val = 150;
            } else if (isFolder) {
                val = Math.max(6, Math.floor(75 * Math.exp(-0.8 * depth)));
            }
            
            const childIds = item.children ? item.children.map((c) => c.id) : [];

            let title = item.title;
            if (!title && item.url) {
                try { 
                    title = new URL(item.url).hostname; 
                } catch { 
                    title = 'Invalid Link'; 
                }
            }
            if (!title) title = 'Folder';

            nodes.push({
                id: item.id,
                title: title,
                group: isFolder ? 'folder' : 'bookmark',
                url: item.url,
                val: val,
                isRoot: isRoot,
                depth: depth,
                childIds: childIds,
                parentId: parentId
            });

            if (parentId) {
                links.push({ source: parentId, target: item.id });
            }

            if (item.children) {
                traverse(item.children, item.id, depth + 1);
            }
        });
    };

    traverse(tree);
    return { nodes, links };
};

export const BookmarkGraph: React.FC<BookmarkGraphProps> = ({ searchQuery, physicsConfig }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphInstanceRef = useRef<ForceGraph<RenderGraphNode, RenderGraphLink> | null>(null);
    const rootNodeRef = useRef<RenderGraphNode | null>(null);
    const hoveredNodeRef = useRef<RenderGraphNode | null>(null);
    
    // 메모리 참조 오염을 방지하기 위한 캐시 및 영속 저장 useRef 선언부
    const imgCache = useRef<{ [key: string]: HTMLImageElement }>({});
    const allDataRef = useRef<{ nodes: GraphNode[]; links: { source: string; target: string }[] }>({ nodes: [], links: [] });
    const expandedNodesRef = useRef<Set<string>>(new Set());
    const nodeByIdRef = useRef<Map<string, GraphNode>>(new Map());
    const nodeCoordinatesCache = useRef<Map<string, { x: number; y: number }>>(new Map());

    /**
     * 폴더 토글 상태(BFS 트리 구조)를 계산하여 현재 화면에 출현해야 하는 가시적 노드/엣지만 필터링 주입
     */
    const updateVisibleGraph = () => {
        const Graph = graphInstanceRef.current;
        if (!Graph || allDataRef.current.nodes.length === 0) return;

        const visibleNodeIds = new Set<string>();
        const visibleNodeObjects: GraphNode[] = [];
        const expanded = expandedNodesRef.current;
        const nodeById = nodeByIdRef.current;

        const roots = allDataRef.current.nodes.filter((n) => n.isRoot);
        const queue = [...roots];
        queue.forEach(n => visibleNodeIds.add(n.id));

        // Queue 기반 BFS 트리 탐색을 통하여 확장 상태인 디렉토리의 하위 요소 스레드 파악
        while (queue.length > 0) {
            const node = queue.shift();
            if (!node) continue;
            visibleNodeObjects.push(node);

            if (expanded.has(node.id) && node.childIds) {
                node.childIds.forEach((childId) => {
                    const child = nodeById.get(childId);
                    if (child && !visibleNodeIds.has(child.id)) {
                        visibleNodeIds.add(child.id);
                        queue.push(child);
                    }
                });
            }
        }

        // [증분 배치 최적화] 새로 확장 출력되는 자식 노드의 원천 좌표를 부모의 실시간 좌표 곁으로 고정
        const renderedNodes = visibleNodeObjects.map((node) => {
            const castedNode = node as RenderGraphNode;
            const cachedCoords = nodeCoordinatesCache.current.get(node.id);
            
            if (cachedCoords) {
                castedNode.x = cachedCoords.x;
                castedNode.y = cachedCoords.y;
            } else if (node.parentId) {
                const parentCoords = nodeCoordinatesCache.current.get(node.parentId);
                if (parentCoords) {
                    // D3 물리 반발력 연산 오버헤드를 막기 위해 부모 곁에 인접 배치 (Explosion 효과 차단)
                    castedNode.x = parentCoords.x + (Math.random() - 0.5) * 4;
                    castedNode.y = parentCoords.y + (Math.random() - 0.5) * 4;
                }
            }
            return castedNode;
        });

        // 엣지 정보 평탄화 딥카피 정형화 파이프라인
        const visibleLinks = allDataRef.current.links
            .filter((link) => {
                const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
                const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
                return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
            })
            .map(link => {
                const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
                const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
                return { source: sourceId, target: targetId };
            });

        Graph.graphData({ 
            nodes: renderedNodes, 
            links: visibleLinks as unknown as RenderGraphLink[] 
        });
    };

    // 1. ForceGraph 초기 인스턴스 빌드 수명주기 훅 (최초 마운트 시 단 1회 구동)
    useEffect(() => {
        if (!containerRef.current) return;

        const graphInitializer = ForceGraph();
        const Graph = graphInitializer(containerRef.current) as unknown as ForceGraph<RenderGraphNode, RenderGraphLink>;

        Graph.backgroundColor('#000000')
            .nodeId('id')
            .nodeLabel('title')
            .nodeVal('val')
            .linkColor(() => '#333333')
            .nodeColor((node: RenderGraphNode) => node.group === 'folder' ? '#ffffff' : '#888888')
            .d3AlphaDecay(0.04)
            .d3VelocityDecay(0.3)
            .onNodeClick((node: RenderGraphNode) => {
                if (node.group === 'folder') {
                    if (expandedNodesRef.current.has(node.id)) {
                        expandedNodesRef.current.delete(node.id);
                    } else {
                        expandedNodesRef.current.add(node.id);
                    }
                    
                    updateVisibleGraph();
                    Graph.d3ReheatSimulation(); // 물리 재가열 인터페이스
                } else if (node.url) {
                    window.open(node.url, '_blank', 'noopener,noreferrer');
                }
            });

        graphInstanceRef.current = Graph;

        // 분리 캡슐화된 외장 드로잉 모듈 바인딩 (노드 영역)
        Graph.nodeCanvasObject((node: RenderGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const currentSearchQuery = (Graph as any)._currentSearchQuery || '';
            
            // 실시간 렌더링 프레임 좌표의 로컬 캐시 스토리지 백업
            if (node.x !== undefined && node.y !== undefined) {
                nodeCoordinatesCache.current.set(node.id, { x: node.x, y: node.y });
            }

            drawNode(node, ctx, globalScale, currentSearchQuery, hoveredNodeRef.current, imgCache.current);
        });

        // 분리 캡슐화된 외장 드로잉 모듈 바인딩 (엣지 영역)
        Graph.linkCanvasObject((link: RenderGraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
            drawLink(link, ctx, globalScale);
        });

        Graph.onNodeHover((node: RenderGraphNode | null) => {
            hoveredNodeRef.current = node;
            if (containerRef.current) containerRef.current.style.cursor = node ? 'pointer' : 'default';
        });

        // 비동기 파이프라인 정적 파일 로드 스케줄러
        const loadData = async () => {
            const tree = await bookmarkService.getTree();
            const { nodes, links } = transformData(tree);
            
            allDataRef.current = { nodes, links };
            nodeByIdRef.current = new Map(nodes.map((node) => [node.id, node]));

            rootNodeRef.current = nodes.find((n) => n.isRoot) as RenderGraphNode || null;
            if (rootNodeRef.current) {
                expandedNodesRef.current.add(rootNodeRef.current.id);
            }

            updateVisibleGraph();

            // 기초 하드 콜라이드 충돌 반경 강제 앵커링
            Graph.d3Force('collide', forceCollide<RenderGraphNode>((node: RenderGraphNode) => Math.sqrt(Math.max(0, node.val || 1)) * 2 + 5));
        };

        loadData();

        const handleResize = () => {
            if (containerRef.current) {
                Graph.width(containerRef.current.clientWidth);
                Graph.height(containerRef.current.clientHeight);
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (graphInstanceRef.current) {
                try { (graphInstanceRef.current as any)._destructor?.(); } catch {}
            }
            graphInstanceRef.current = null;
        };
    }, []);

    // 2. 피지컬 조작 UI 대시보드 상태 변경 감지 실시간 연동 동기화 훅
    useEffect(() => {
        const Graph = graphInstanceRef.current;
        if (!Graph) return;

        const chargeForce = Graph.d3Force('charge');
        if (chargeForce) (chargeForce as any).strength(physicsConfig.chargeStrength);

        const linkForce = Graph.d3Force('link');
        if (linkForce) {
            (linkForce as any)
                .distance(physicsConfig.linkDistance)
                .strength(physicsConfig.linkStrength);
        }

        Graph.d3ReheatSimulation();
    }, [physicsConfig]);

    // 3. 상위 인풋 패널 서치 변경 동시성 훅 감지 및 카메라 트래킹 수명주기 훅
    useEffect(() => {
        if (!graphInstanceRef.current) return;
        
        (graphInstanceRef.current as any)._currentSearchQuery = searchQuery;
        graphInstanceRef.current.d3ReheatSimulation();

        if (searchQuery) {
            const match = allDataRef.current.nodes.find(n => n.title.toLowerCase().includes(searchQuery.toLowerCase())) as RenderGraphNode;
            if (match && match.x !== undefined && match.y !== undefined) {
                graphInstanceRef.current.centerAt(match.x, match.y, 600);
                graphInstanceRef.current.zoom(2.5, 600);
            }
        }
    }, [searchQuery]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default BookmarkGraph;