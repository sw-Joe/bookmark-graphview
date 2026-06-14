import { forceCollide } from 'd3-force';
import ForceGraph from 'force-graph';
import React, { useEffect, useRef } from 'react';
import { BookmarkNode, GraphData, GraphNode, RenderGraphLink, RenderGraphNode } from '../types';
import { bookmarkService } from '../utils/bookmarkService';

// 데이터 변환 로직
const transformData = (tree: BookmarkNode[]): GraphData => {
    const nodes: GraphNode[] = [];
    const links: { source: string; target: string }[] = [];

    const traverse = (items: BookmarkNode[], parentId: string | null = null, depth: number = 0) => {
        items.forEach(item => {
            const isFolder = !item.url;
            const isRoot = parentId === null || depth === 0;

            // node sizing
            let val = 4;

            if (isRoot) {
                val = 150; // 루트 노드 크기 최대치 설정
            } else if (isFolder) {
                // 지수 감쇄 함수를 활용하여 루트 직후 폴더(depth 1)는 약 33, 다음 단계는 15 수준으로 세련되게 낙하
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
            if (!title) {
                title = 'Folder';
            }

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

export const BookmarkGraph: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphInstanceRef = useRef<ForceGraph<RenderGraphNode, RenderGraphLink> | null>(null);
    const rootNodeRef = useRef<RenderGraphNode | null>(null);
    const hoveredNodeRef = useRef<RenderGraphNode | null>(null);
    const imgCache = useRef<{ [key: string]: HTMLImageElement }>({});
    const allDataRef = useRef<{ nodes: GraphNode[]; links: { source: string; target: string }[] }>({ nodes: [], links: [] });
    const expandedNodesRef = useRef<Set<string>>(new Set());
    const nodeByIdRef = useRef<Map<string, GraphNode>>(new Map());

    useEffect(() => {
        if (!containerRef.current) return;

        // 런타임 innerHTML 에러를 방지하는 표준 ForceGraph 인스턴스 생성 루틴
        // 라이브러리의 실체 함수를 안전하게 호출하여 DOM 노드를 주입
        const graphInitializer = ForceGraph();
        const Graph = graphInitializer(containerRef.current) as unknown as ForceGraph<RenderGraphNode, RenderGraphLink>;

        // 기존 설정 속성 파이프라인 바인딩
        Graph.backgroundColor('#222222')
            .nodeId('id')
            .nodeLabel('title')
            .nodeVal('val')
            .linkColor(() => '#444444')
            .nodeColor((node: RenderGraphNode) => node.group === 'folder' ? '#ffffff' : '#888888')
            .d3AlphaDecay(0.04)
            .d3VelocityDecay(0.3)
            .onNodeClick((node: RenderGraphNode) => {
            // 1. 폴더 노드:  상태 토글 및 리프레시
            if (node.group === 'folder') {
                if (expandedNodesRef.current.has(node.id)) {
                    expandedNodesRef.current.delete(node.id);
                } else {
                    expandedNodesRef.current.add(node.id);
                }
                updateVisibleGraph();
                
                Graph.d3AlphaTarget(0.3).restart();
                setTimeout(() => Graph.d3AlphaTarget(0), 300);
                return;
            } 
            
            // 2. 북마크 노드: 외부 새 창 연결 처리 (웹 서비스 UX 관점 보정)
            if (node.url) {
                window.open(node.url, '_blank', 'noopener,noreferrer');
            }
        });

        graphInstanceRef.current = Graph;

        // Custom Node Rendering Canvas Object
        Graph.nodeCanvasObject((node: RenderGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.title;
            let baseFontSize = 10;
            if (node.isRoot) baseFontSize = 48;
            else if (node.group === 'folder') baseFontSize = 24;

            const fontSize = Math.max(4, baseFontSize / globalScale); 
            ctx.font = `${node.isRoot ? 'bold ' : ''}${fontSize}px Sans-Serif`;
            
            const isHovered = node === hoveredNodeRef.current;
            const isRoot = node.isRoot;
            const r = Math.sqrt(Math.max(0, node.val || 1)) * 2;

            if (isHovered || isRoot) {
                ctx.beginPath();
                ctx.arc(node.x ?? 0, node.y ?? 0, r + (isRoot ? 6 / globalScale : 2 / globalScale), 0, 2 * Math.PI, false);
                ctx.fillStyle = isRoot ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.4)';
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI, false);
            
            if (isRoot) {
                ctx.fillStyle = '#FFD700';
            } else {
                ctx.fillStyle = node.group === 'folder' ? '#ffffff' : '#444444';
            }
            ctx.fill();

            if (node.group === 'bookmark' && node.url) {
                let img = imgCache.current[node.url];
                if (!img) {
                    img = new Image();
                    let hostname = 'Unknown Link';
                    try {
                        hostname = new URL(node.url).hostname;
                    } catch {
                        hostname = 'Invalid Link';
                    }
                    img.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
                    imgCache.current[node.url] = img;
                }

                if (img.complete && img.naturalWidth > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(node.x ?? 0, node.y ?? 0, r - 0.5, 0, 2 * Math.PI, false);
                    ctx.clip();
                    try {
                        ctx.drawImage(img, (node.x ?? 0) - r, (node.y ?? 0) - r, r * 2, r * 2);
                    } catch {
                        // Canvas Context Fallback Guard
                    }
                    ctx.restore();
                }
            }

            let isRootVisible = true;
            if (rootNodeRef.current) {
                const { x, y } = rootNodeRef.current;
                const screenCoords = Graph.graph2ScreenCoords(x ?? 0, y ?? 0);
                const width = Graph.width();
                const height = Graph.height();
                const margin = r * globalScale;
                if (
                    screenCoords.x < -margin || 
                    screenCoords.x > width + margin || 
                    screenCoords.y < -margin || 
                    screenCoords.y > height + margin
                ) {
                    isRootVisible = false;
                }
            }

            let showLabel = false;
            if (isRoot || isHovered) {
                showLabel = true;
            } else if (node.group === 'folder') {
                if (globalScale > 0.4) showLabel = true; 
            } else if (node.depth > 2) {
                if (!isRootVisible || globalScale > 3.0) {
                    showLabel = true;
                }
            } else {
                if (globalScale > 1.5) showLabel = true;
            }

            if (showLabel) {
                const textWidth = ctx.measureText(label).width;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = isHovered ? '#ffffff' : (isRoot ? '#FFD700' : 'rgba(255, 255, 255, 0.8)');
                ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + r + (4 / globalScale), textWidth);
            }
        });

        // Link Drawing Logic
        Graph.linkCanvasObject((link: RenderGraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
            if (globalScale < 0.6) return;

            const start = link.source;
            const end = link.target;
            if (typeof start !== 'object' || typeof end !== 'object') return;

            ctx.beginPath();
            ctx.moveTo(start.x ?? 0, start.y ?? 0);
            ctx.lineTo(end.x ?? 0, end.y ?? 0);
            ctx.lineWidth = 1 / globalScale;
            ctx.strokeStyle = '#333333';
            ctx.stroke();
        });

        Graph.onNodeHover((node: RenderGraphNode | null) => {
            hoveredNodeRef.current = node;
            if (containerRef.current) {
                containerRef.current.style.cursor = node ? 'pointer' : 'default';
            }
        });

        // 가시적 그래프 데이터 동기화 서브루틴 분리 및 가독성 개선
        const updateVisibleGraph = () => {
            const { nodes, links } = allDataRef.current;
            const expanded = expandedNodesRef.current;
            const nodeById = nodeByIdRef.current;
            
            const visibleNodes = new Set<string>();
            const visibleNodeObjects: GraphNode[] = [];
            
            const roots = nodes.filter((n) => n.isRoot);
            const queue = [...roots];
            queue.forEach(n => visibleNodes.add(n.id));
            
            while(queue.length > 0) {
                const node = queue.shift();
                if (!node) continue;
                visibleNodeObjects.push(node);
                
                if (expanded.has(node.id) && node.childIds) {
                    node.childIds.forEach((childId: string) => {
                        const child = nodeById.get(childId);
                        if (child && !visibleNodes.has(child.id)) {
                            visibleNodes.add(child.id);
                            queue.push(child);
                        }
                    });
                }
            }
            
            const visibleLinks = links.filter((link) => {
                const sourceId = typeof link.source === 'object' ? (link.source as RenderGraphNode).id : link.source;
                const targetId = typeof link.target === 'object' ? (link.target as RenderGraphNode).id : link.target;
                return visibleNodes.has(sourceId) && visibleNodes.has(targetId);
            });

            Graph.graphData({ nodes: visibleNodeObjects as RenderGraphNode[], links: visibleLinks as unknown as RenderGraphLink[] });
        };

        // Asynchronous Data loading routine
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

            // D3 물리 엔진 설정 복구
            Graph.d3Force('collide', forceCollide<RenderGraphNode>((node: RenderGraphNode) => {
                const r = Math.sqrt(Math.max(0, node.val || 1)) * 2;
                return r + 5;
            }));

            const chargeForce = Graph.d3Force('charge');
            if (chargeForce) {
                chargeForce.strength(-150);
            }
            
            const linkForce = Graph.d3Force('link');
            if (linkForce) {
                linkForce.distance(() => 40).strength(0.3);
            }
            
            if (chargeForce) {
                chargeForce.strength(-1000); 
                setTimeout(() => {
                    chargeForce.strength(-500); 
                }, 1000);
            }
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
            // 인스턴스 전역 수명주기 해제 안전장치
            if (graphInstanceRef.current) {
                try {
                    (graphInstanceRef.current as any)._destructor?.();
                } catch {
                    // Fallback
                }
            }
            graphInstanceRef.current = null;
        };

    }, []);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default BookmarkGraph;