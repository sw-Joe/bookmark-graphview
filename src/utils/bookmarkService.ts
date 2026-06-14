import { BookmarkNode } from '../types';

// Mozilla/Firefox 백업 포맷을 내부 표준 도메인 모델로 변환하는 정문화 함수
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
    getTree: async (): Promise<BookmarkNode[]> => {
        let parsedTree: BookmarkNode[] = [];

        try {
            // 업로드된 실제 백업 파일 데이터 자산 명세와 동기화
            const response = await fetch('/bookmarks-2026-06-14.json');
            if (!response.ok) {
                throw new Error(`HTTP fetch status error: ${response.status}`);
            }
            const backupData = await response.json();
            const standardRoot = transformBackupToStandard(backupData);
            
            standardRoot.id = 'root';
            if (!standardRoot.title) standardRoot.title = 'Bookmark Explorer';
            
            parsedTree = [standardRoot];
        } catch (error) {
            console.error("Failed to load runtime backup JSON, applying empty fallback:", error);
            parsedTree = [{ id: 'root', title: 'Bookmark Explorer', children: [] }];
        }

        // localStorage와의 영속성 결합 데이터 파이프라인
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