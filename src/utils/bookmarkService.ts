import { BookmarkNode } from '../types';

// 트리 평탄화가 필요한 경우 내부 모듈 헬퍼로만 유지하거나 미사용 시 제거
const flattenBookmarks = (nodes: BookmarkNode[]): BookmarkNode[] => {
    let result: BookmarkNode[] = [];
    for (const node of nodes) {
        if (node.url) {
            result.push(node);
        } else if (node.children) {
            result = result.concat(flattenBookmarks(node.children));
        }
    }
    return result;
};

// Mozilla/Firefox 백업 스펙을 내부 BookmarkNode 구조로 정규화하는 순수 어댑터 함수
const transformBackupToStandard = (backupNode: any): BookmarkNode => {
    const isFolder = backupNode.type === 'text/x-moz-place-container' || (!backupNode.uri && !!backupNode.children);
    
    const standardNode: BookmarkNode = {
        id: backupNode.id ? backupNode.id.toString() : backupNode.guid || Date.now().toString(),
        title: backupNode.title || (isFolder ? 'Folder' : 'Untitled'),
        ...(backupNode.uri && { url: backupNode.uri }),
        ...(backupNode.dateAdded && { dateAdded: Math.floor(backupNode.dateAdded / 1000) })
    };

    if (backupNode.children && Array.isArray(backupNode.children)) {
        standardNode.children = backupNode.children.map((child: any) => transformBackupToStandard(child));
    }

    return standardNode;
};

export const bookmarkService = {
    // 오직 웹 런타임 데이터 인프라 스트림만 남겨 명확성 확보
    getTree: async (): Promise<BookmarkNode[]> => {
        let parsedTree: BookmarkNode[] = [];

        try {
            const response = await fetch('/bookmarks-2026-06-08.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const backupData = await response.json();
            const standardRoot = transformBackupToStandard(backupData);
            
            standardRoot.id = 'root';
            if (!standardRoot.title) standardRoot.title = 'Bookmark Explorer';
            
            parsedTree = [standardRoot];
        } catch (error) {
            console.error("Failed to load runtime backup JSON:", error);
            parsedTree = [{ id: 'root', title: 'Bookmark Explorer', children: [] }];
        }

        // 로컬 영속성 스토리지 병합 파이프라인
        const saved = localStorage.getItem('bookmarks');
        const simpleList: BookmarkNode[] = saved ? JSON.parse(saved) : [];
        
        if (simpleList.length > 0 && parsedTree[0]) {
            const rootChildren = parsedTree[0].children || [];
            const targetFolder = rootChildren.find(c => c.id === '3' || c.title === 'toolbar' || c.title === 'Bookmarks Bar') || parsedTree[0];
            
            if (!targetFolder.children) targetFolder.children = [];
            targetFolder.children.push(...simpleList);
        }
        
        return parsedTree;
    }
};