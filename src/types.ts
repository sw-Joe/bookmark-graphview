import { LinkObject, NodeObject } from 'force-graph';

// 웹 런타임 표준 계층형 북마크 트리 인터페이스
export interface BookmarkNode {
    id: string;
    title: string;
    url?: string;
    dateAdded?: number;
    children?: BookmarkNode[];
}

// 2D 네트워크 그래프 물리 연산용 원천 도메인 모델
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

// force-graph 엔진 내부 물리 포인터가 결합된 렌더링 노드 사양
export interface RenderGraphNode extends NodeObject, GraphNode {}

// D3 물리 엔진 및 캔버스 파이프라인 연산용 엣지(링크) 명세
export interface RenderGraphLink extends LinkObject<RenderGraphNode> {
    source: string | RenderGraphNode;
    target: string | RenderGraphNode;
}

export interface GraphData {
    nodes: GraphNode[];
    links: { source: string; target: string }[];
}