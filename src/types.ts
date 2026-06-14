import { LinkObject, NodeObject } from 'force-graph';

export interface BookmarkNode {
    id: string;
    title: string;
    url?: string;
    dateAdded?: number;
    children?: BookmarkNode[];
}

export interface GraphNode {
    id: string;
    title: string;
    group: 'folder' | 'bookmark';
    url?: string;
    val: number;
    isRoot: boolean;
    depth: number;
    childIds: string[];
    parentId: string | null;
}

export interface RenderGraphNode extends NodeObject, GraphNode {}

export interface RenderGraphLink extends LinkObject<RenderGraphNode> {
    source: string | RenderGraphNode;
    target: string | RenderGraphNode;
}

export interface GraphData {
    nodes: GraphNode[];
    links: { source: string; target: string }[];
}