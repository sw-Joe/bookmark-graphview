import { forceCollide } from 'd3-force';
import ForceGraph from 'force-graph';
import React, { useEffect, useRef } from 'react';
import { PhysicsConfig } from '../App';
import { BookmarkNode, GraphData, GraphNode, RenderGraphLink, RenderGraphNode } from '../types';
import { bookmarkService } from '../utils/bookmarkService';

interface BookmarkGraphProps {
    searchQuery: string;
    physicsConfig: PhysicsConfig;
}

const truncateText = (text: string, maxLength: number = 14): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

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
    const imgCache = useRef<{ [key: string]: HTMLImageElement }>({});
    
    const allDataRef = useRef<{ nodes: GraphNode[]; links: { source: string; target: string }[] }>({ nodes: [], links: [] });
    const expandedNodesRef = useRef<Set<string>>(new Set());
    const nodeByIdRef = useRef<Map<string, GraphNode>>(new Map());
    const nodeCoordinatesCache = useRef<Map<string, { x: number; y: number }>>(new Map());

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

        const renderedNodes = visibleNodeObjects.map((node) => {
            const castedNode = node as RenderGraphNode;
            const cachedCoords = nodeCoordinatesCache.current.get(node.id);
            
            if (cachedCoords) {
                castedNode.x = cachedCoords.x;
                castedNode.y = cachedCoords.y;
            } else if (node.parentId) {
                const parentCoords = nodeCoordinatesCache.current.get(node.parentId);
                if (parentCoords) {
                    castedNode.x = parentCoords.x + (Math.random() - 0.5) * 4;
                    castedNode.y = parentCoords.y + (Math.random() - 0.5) * 4;
                }
            }
            return castedNode;
        });

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
                    Graph.d3ReheatSimulation();
                } else if (node.url) {
                    window.open(node.url, '_blank', 'noopener,noreferrer');
                }
            });

        graphInstanceRef.current = Graph;

        Graph.nodeCanvasObject((node: RenderGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const currentSearchQuery = (Graph as any)._currentSearchQuery || '';
            const label = truncateText(node.title, node.isRoot ? 24 : 14);
            let baseFontSize = 10;
            if (node.isRoot) baseFontSize = 48;
            else if (node.group === 'folder') baseFontSize = 24;

            const fontSize = Math.max(4, baseFontSize / globalScale); 
            ctx.font = `${node.isRoot ? 'bold ' : ''}${fontSize}px Sans-Serif`;
            
            const isHovered = node === hoveredNodeRef.current;
            const isRoot = node.isRoot;
            const r = Math.sqrt(Math.max(0, node.val || 1)) * 2;

            if (node.x !== undefined && node.y !== undefined) {
                nodeCoordinatesCache.current.set(node.id, { x: node.x, y: node.y });
            }

            const isMatched = currentSearchQuery && node.title.toLowerCase().includes(currentSearchQuery.toLowerCase());

            if (isHovered || isRoot || isMatched) {
                ctx.beginPath();
                ctx.arc(node.x ?? 0, node.y ?? 0, r + (isRoot ? 6 / globalScale : 2 / globalScale), 0, 2 * Math.PI, false); 
                ctx.fillStyle = isRoot ? 'rgba(255, 215, 0, 0.2)' : (isMatched ? 'rgba(255, 69, 0, 0.4)' : 'rgba(255, 255, 255, 0.3)');
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI, false);
            ctx.fillStyle = isRoot ? '#FFD700' : (isMatched ? '#FF4500' : (node.group === 'folder' ? '#ffffff' : '#444444'));
            ctx.fill();

            if (node.group === 'bookmark' && node.url) {
                let img = imgCache.current[node.url];
                if (!img) {
                    img = new Image();
                    let hostname = 'Unknown';
                    try { hostname = new URL(node.url).hostname; } catch {}
                    img.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
                    imgCache.current[node.url] = img;
                }
                if (img.complete && img.naturalWidth > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(node.x ?? 0, node.y ?? 0, r - 0.5, 0, 2 * Math.PI, false);
                    ctx.clip();
                    try { ctx.drawImage(img, (node.x ?? 0) - r, (node.y ?? 0) - r, r * 2, r * 2); } catch {}
                    ctx.restore();
                }
            }

            let showLabel = false;
            if (isRoot || isHovered || isMatched) showLabel = true;
            else if (node.group === 'folder' && globalScale > 0.4) showLabel = true;
            else if (globalScale > 1.5) showLabel = true;

            if (showLabel) {
                const textWidth = ctx.measureText(label).width;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = isHovered ? '#ffffff' : (isMatched ? '#FF4500' : (isRoot ? '#FFD700' : 'rgba(255, 255, 255, 0.8)'));
                ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + r + (4 / globalScale), textWidth);
            }
        });

        // 타이밍 가드 (link.source 포인터 결합 지연 버그 방지)
        Graph.linkCanvasObject((link: RenderGraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
            if (globalScale < 0.6) return;
            
            const start = link.source;
            const end = link.target;
            
            if (!start || !end || typeof start !== 'object' || typeof end !== 'object') return;
            if (typeof start.x !== 'number' || typeof start.y !== 'number' || 
                typeof end.x !== 'number' || typeof end.y !== 'number') {
                return;
            }

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.lineWidth = 1 / globalScale;
            ctx.strokeStyle = '#333333';
            ctx.stroke();
        });

        Graph.onNodeHover((node: RenderGraphNode | null) => {
            hoveredNodeRef.current = node;
            if (containerRef.current) containerRef.current.style.cursor = node ? 'pointer' : 'default';
        });

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

    useEffect(() => {
        const Graph = graphInstanceRef.current;
        if (!Graph) return;

        const chargeForce = Graph.d3Force('charge');
        if (chargeForce) {
            (chargeForce as any).strength(physicsConfig.chargeStrength);
        }

        const linkForce = Graph.d3Force('link');
        if (linkForce) {
            (linkForce as any)
                .distance(physicsConfig.linkDistance)
                .strength(physicsConfig.linkStrength);
        }

        Graph.d3ReheatSimulation();
    }, [physicsConfig]);

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