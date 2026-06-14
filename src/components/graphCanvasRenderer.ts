import { RenderGraphLink, RenderGraphNode } from '../types';

const truncateText = (text: string, maxLength: number = 25): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

/**
 * HTML5 Canvas 컨텍스트 상에 개별 노드(구체, 후광, 파비콘, 라벨)를 프레임 단위로 드로잉
 */
export const drawNode = (
    node: RenderGraphNode, 
    ctx: CanvasRenderingContext2D, 
    globalScale: number,
    currentSearchQuery: string,
    hoveredNode: RenderGraphNode | null,
    imgCache: { [key: string]: HTMLImageElement }
) => {
    const label = truncateText(node.title, node.isRoot ? 24 : 14);
    let baseFontSize = 10;
    if (node.isRoot) baseFontSize = 48;
    else if (node.group === 'folder') baseFontSize = 24;

    const fontSize = Math.max(4, baseFontSize / globalScale); 
    ctx.font = `${node.isRoot ? 'bold ' : ''}${fontSize}px Sans-Serif`;
    
    const isHovered = node === hoveredNode;
    const isRoot = node.isRoot;
    const r = Math.sqrt(Math.max(0, node.val || 1)) * 2;

    // 실시간 인앱 검색어 매칭 판별
    const isMatched = currentSearchQuery && node.title.toLowerCase().includes(currentSearchQuery.toLowerCase());

    // 1. 노드 선택 및 하이라이트 시 외부 그라데이션 후광(Glow) 효과 드로잉
    if (isHovered || isRoot || isMatched) {
        ctx.beginPath();
        ctx.arc(node.x ?? 0, node.y ?? 0, r + (isRoot ? 6 / globalScale : 2 / globalScale), 0, 2 * Math.PI, false); 
        ctx.fillStyle = isRoot ? 'rgba(255, 215, 0, 0.2)' : (isMatched ? 'rgba(255, 69, 0, 0.4)' : 'rgba(255, 255, 255, 0.3)');
        ctx.fill();
    }

    // 2. 중심 노드 알맹이 구체 드로잉
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = isRoot ? '#FFD700' : (isMatched ? '#FF4500' : (node.group === 'folder' ? '#ffffff' : '#444444'));
    ctx.fill();

    // 3. 단말 북마크 노드 내부 구글 S2 API 기반 파비콘 이미지 마스킹 클리핑 드로잉
    if (node.group === 'bookmark' && node.url) {
        let img = imgCache[node.url];
        if (!img) {
            img = new Image();
            let hostname = 'Unknown';
            try { hostname = new URL(node.url).hostname; } catch {}
            img.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
            imgCache[node.url] = img;
        }
        if (img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, r - 0.5, 0, 2 * Math.PI, false);
            ctx.clip(); // 노드 원형 영역 내부로 이미지만 보이게 마스킹 격리
            try { ctx.drawImage(img, (node.x ?? 0) - r, (node.y ?? 0) - r, r * 2, r * 2); } catch {}
            ctx.restore();
        }
    }

    // 4. LOD 기반 단계적 라벨 텍스트 드로잉 조건 분기
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
};

/**
 * D3 갱신 오차에 따른 link.source undefined 크래시를 원천 방어하는 수치형 타입 가드 결합 엣지 드로러
 */
export const drawLink = (link: RenderGraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (globalScale < 0.6) return; // 줌아웃이 심할 때는 선 드로잉을 생략하여 FPS 방어
    
    const start = link.source;
    const end = link.target;
    
    // [최종 교정 가드] D3의 객체 치환 레이스 컨디션을 100% 차단하는 수치 변수 타입 가드
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
};