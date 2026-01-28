import { forceCollide } from 'd3-force';
import ForceGraph from 'force-graph';
import React, { useEffect, useRef } from 'react';
import { GraphData } from '../types';
import { bookmarkService } from '../utils/bookmarkService';

export const BookmarkGraph: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphInstanceRef = useRef<any>(null);
    const rootNodeRef = useRef<any>(null);
    const hoveredNodeRef = useRef<any>(null);
    const imgCache = useRef<{ [key: string]: HTMLImageElement }>({});
    const allDataRef = useRef<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
    const expandedNodesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize Graph
        // @ts-ignore
        const Graph = ForceGraph()(containerRef.current)
            .backgroundColor('#000000')
            .nodeId('id')
            .nodeLabel('title')
            .nodeVal('val')
            .linkColor(() => '#333333')
            .nodeColor((node: any) => node.group === 'folder' ? '#ffffff' : '#888888')
            .d3AlphaDecay(0.04) // Stabilize faster
            .d3VelocityDecay(0.3) // Higher friction
            .onNodeClick((node: any) => {
                if (node.group === 'folder') {
                    // Toggle expansion
                    if (expandedNodesRef.current.has(node.id)) {
                        expandedNodesRef.current.delete(node.id);
                        // Optional: Collapse all descendants? For now just close this one.
                    } else {
                        expandedNodesRef.current.add(node.id);
                    }
                    updateVisibleGraph();
                    
                    // Re-heat simulation slightly to arrange new nodes
                    Graph.d3AlphaTarget(0.3).restart();
                    setTimeout(() => Graph.d3AlphaTarget(0), 300);
                } else if (node.url) {
                    window.location.href = node.url;
                } else {
                    Graph.centerAt(node.x, node.y, 1000);
                    Graph.zoom(4, 2000);
                }
            });

        graphInstanceRef.current = Graph;

        // Custom Node Rendering
        Graph.nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.title;
            // Dynamic font size based on hierarchy
            let baseFontSize = 10;
            if (node.isRoot) baseFontSize = 48; // Much larger
            else if (node.group === 'folder') baseFontSize = 24;

            // Scale font size to keep readable but relative to zoom
            const fontSize = Math.max(4, baseFontSize / globalScale); 
            ctx.font = `${node.isRoot ? 'bold ' : ''}${fontSize}px Sans-Serif`;
            
            // Interaction State check
            const isHovered = node === hoveredNodeRef.current;
            const isRoot = node.isRoot;
            
            // Node Radius
            const r = Math.sqrt(Math.max(0, node.val || 1)) * 2;

            // Draw Glow (Hover or Root)
            if (isHovered || isRoot) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, r + (isRoot ? 20 / globalScale : 4 / globalScale), 0, 2 * Math.PI, false); 
                ctx.fillStyle = isRoot ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.4)'; // Gold for root
                ctx.fill();
            }

            // Draw Node Circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
            
            if (isRoot) {
                 ctx.fillStyle = '#FFD700'; // Gold
            } else {
                 ctx.fillStyle = node.group === 'folder' ? '#ffffff' : '#444444';
            }
            ctx.fill();

            // Draw Favicon for bookmarks
            if (node.group === 'bookmark' && node.url) {
                let img = imgCache.current[node.url];
                if (!img) {
                    img = new Image();
                    img.src = `https://www.google.com/s2/favicons?domain=${new URL(node.url).hostname}&sz=64`;
                    imgCache.current[node.url] = img;
                }

                if (img.complete && img.naturalWidth > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, r - 0.5, 0, 2 * Math.PI, false);
                    ctx.clip();
                    try {
                        ctx.drawImage(img, node.x - r, node.y - r, r * 2, r * 2);
                    } catch (e) {
                         // Fallback
                    }
                    ctx.restore();
                }
            }

            // Check if Root is Visible in Viewport
            let isRootVisible = true;
            if (rootNodeRef.current) {
                const { x, y } = rootNodeRef.current;
                // ForceGraph gives us graph2ScreenCoords
                const screenCoords = Graph.graph2ScreenCoords(x, y);
                const width = Graph.width();
                const height = Graph.height();
                
                // Add some buffer (e.g. consider visible if within screen + small margin)
                const margin = r * globalScale; // Use root radius size as margin
                if (
                    screenCoords.x < -margin || 
                    screenCoords.x > width + margin || 
                    screenCoords.y < -margin || 
                    screenCoords.y > height + margin
                ) {
                    isRootVisible = false;
                }
            }

            // Draw Label - Visibility Logic
            let showLabel = false;
            
            if (isRoot || isHovered) {
                showLabel = true;
            } else if (node.group === 'folder') {
                // Folders hidden if very far out, but generally visible
                if (globalScale > 0.4) showLabel = true; 
            } else if (node.depth > 2) {
                 // Deep nodes: only show if Room is NOT visible (user has panned away/zoomed in deep)
                 // OR if zoomed in extremely close
                 if (!isRootVisible || globalScale > 3.0) {
                     showLabel = true;
                 }
            } else {
                 // Standard bookmarks (depth 1-2)
                 if (globalScale > 1.5) showLabel = true;
            }

            if (showLabel) {
                const textWidth = ctx.measureText(label).width;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = isHovered ? '#ffffff' : (isRoot ? '#FFD700' : 'rgba(255, 255, 255, 0.8)');
                ctx.fillText(label, node.x, node.y + r + fontSize, textWidth);
            }
        });

        // Edge/Link Rendering / LOD
        Graph.linkCanvasObject((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            // LOD: Hide edges if zoomed out too far, unless hovered
            if (globalScale < 0.6) return;

            const start = link.source;
            const end = link.target;

            if (typeof start !== 'object' || typeof end !== 'object') return;

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.lineWidth = 1 / globalScale;
            ctx.strokeStyle = '#333333';
            ctx.stroke();
        });

        // Add custom hover logic
        Graph.onNodeHover((node: any) => {
            hoveredNodeRef.current = node;
            if (containerRef.current) {
                containerRef.current.style.cursor = node ? 'pointer' : 'default';
            }
        });

        // Filter and update graph data based on expansion state
        const updateVisibleGraph = () => {
            const { nodes, links } = allDataRef.current;
            const expanded = expandedNodesRef.current;
            
            const visibleNodes = new Set<string>();
            const visibleNodeObjects: any[] = [];
            
            // Always show roots
            const roots = nodes.filter((n: any) => n.isRoot);
            const queue = [...roots];
            queue.forEach(n => visibleNodes.add(n.id));
            
            // Traverse
            while(queue.length > 0) {
                const node = queue.shift();
                visibleNodeObjects.push(node);
                
                if (expanded.has(node.id) && node.childIds) {
                    node.childIds.forEach((childId: string) => {
                         // Find child node object (optimize this map later if needed)
                         const child = nodes.find((n: any) => n.id === childId);
                         if (child && !visibleNodes.has(child.id)) {
                             visibleNodes.add(child.id);
                             queue.push(child);
                         }
                    });
                }
            }
            
            const visibleLinks = links.filter((link: any) => {
                 // ForceGraph creates objects for source/target, but initially they are IDs. 
                 // We need to handle both if we are re-using data or not.
                 // Ideally we filter raw links.
                 const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                 const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                 return visibleNodes.has(sourceId) && visibleNodes.has(targetId);
            });

            Graph.graphData({ nodes: visibleNodeObjects, links: visibleLinks });
        };

        // Load Data
        const loadData = async () => {
            const tree = await bookmarkService.getTree();
            const { nodes, links } = transformData(tree);
            
            allDataRef.current = { nodes, links };

            // Find Root
            rootNodeRef.current = nodes.find((n: any) => n.isRoot);
            
            // Initially expand root(s)
            if (rootNodeRef.current) {
                expandedNodesRef.current.add(rootNodeRef.current.id);
            }

            // Initial Draw
            updateVisibleGraph();

            // Apply specific physics forces
            // Prevent overlap
            Graph.d3Force('collide', forceCollide((node: any) => {
                const r = Math.sqrt(Math.max(0, node.val || 1)) * 2;
                return r + 5; // Radius + Padding
            }));

            // Strong repulsion for spacing
            Graph.d3Force('charge').strength(-500); // Stronger repulsion with bigger nodes
            
            // Adjust links
            Graph.d3Force('link')
                .distance((link: any) => {
                     // Larger distance for larger nodes
                    return 100;
                })
                .strength(0.3);
            
            // Warmup
            Graph.d3Force('charge').strength(-1000); 
            setTimeout(() => {
                 Graph.d3Force('charge').strength(-500); 
            }, 1000);
        };

        loadData();

        // Resize Handler
        const handleResize = () => {
            if (containerRef.current) {
                Graph.width(containerRef.current.clientWidth);
                Graph.height(containerRef.current.clientHeight);
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
             graphInstanceRef.current = null;
        };

    }, []);

    // Helper to transform bookmark tree to graph nodes/links
    const transformData = (tree: any[]): GraphData => {
        const nodes: any[] = [];
        const links: any[] = [];

        const traverse = (items: any[], parentId: string | null = null, depth: number = 0) => {
            items.forEach(item => {
                const isFolder = !item.url;
                const isRoot = parentId === null || depth === 0;

                // Calculate size based on depth - Aggressive Resize
                let val = 4; // Default Bookmark (Radius ~4)
                if (isRoot) {
                    val = 2500; // Radius ~100
                } else if (isFolder) {
                    // Decay: 400 -> 225 -> 100
                    // Radius: 40 -> 30 -> 20
                    val = Math.pow(Math.max(10, 20 - ((depth - 1) * 5)), 2); 
                }
                
                // Collect child IDs
                const childIds = item.children ? item.children.map((c: any) => c.id) : [];

                nodes.push({
                    id: item.id,
                    title: item.title || (item.url ? new URL(item.url).hostname : 'Folder'),
                    group: isFolder ? 'folder' : 'bookmark',
                    url: item.url,
                    val: val,
                    isRoot: isRoot,
                    depth: depth,
                    childIds: childIds, // Store child IDs for traversal
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

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default BookmarkGraph;
