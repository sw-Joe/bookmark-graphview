import { NodeObject, LinkObject } from 'force-graph';

// Chrome Bookmark Interfaces
export interface BookmarkNode {
    id: string;
    parentId?: string;
    index?: number;
    url?: string;
    title: string;
    dateAdded?: number;
    dateGroupModified?: number;
    children?: BookmarkNode[];
    blockInteraction?: boolean;
}

// Graph Node definition matching our transformed data structure
export interface GraphNode {
    id: string;
    title: string;
    group: 'folder' | 'bookmark';
    url?: string;
    val: number; // Size
    isRoot: boolean;
    depth: number;
    childIds: string[];
    parentId: string | null;
}

// Physics-injected Render Node that extends force-graph's NodeObject
export interface RenderGraphNode extends NodeObject, GraphNode {}

// Render Link that extends force-graph's LinkObject
export interface RenderGraphLink extends LinkObject<RenderGraphNode> {
    source: string | RenderGraphNode;
    target: string | RenderGraphNode;
}

export interface GraphData {
    nodes: GraphNode[];
    links: { source: string; target: string }[];
}
