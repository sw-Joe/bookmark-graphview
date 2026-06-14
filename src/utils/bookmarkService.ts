import { BookmarkNode } from '../types';

const isExtension = typeof chrome !== 'undefined' && !!chrome.bookmarks;

// Helper to flatten bookmark tree
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

/**
 * [리팩토링] 백업 JSON 스키마(Mozilla/Firefox 형식)를 내부 표준 BookmarkNode 포맷으로 변환하는 변환기
 */
const transformBackupToStandard = (backupNode: any): BookmarkNode => {
    const isFolder = backupNode.type === 'text/x-moz-place-container' || (!backupNode.uri && !!backupNode.children);
    
    const standardNode: BookmarkNode = {
        id: backupNode.id ? backupNode.id.toString() : backupNode.guid || Date.now().toString(),
        title: backupNode.title || (isFolder ? 'Folder' : 'Untitled'),
        ...(backupNode.uri && { url: backupNode.uri }),
        ...(backupNode.dateAdded && { dateAdded: Math.floor(backupNode.dateAdded / 1000) }) // 마이크로초 단위를 밀리초 단위로 보정
    };

    if (backupNode.children && Array.isArray(backupNode.children)) {
        standardNode.children = backupNode.children.map((child: any) => transformBackupToStandard(child));
    }

    return standardNode;
};

export const bookmarkService = {
    isExtension,

    getTree: async (): Promise<BookmarkNode[]> => {
        if (isExtension) {
            return new Promise<BookmarkNode[]>((resolve) => {
                chrome.bookmarks.getTree((tree) => {
                    resolve(tree as BookmarkNode[]);
                });
            });
        } else {
            let parsedTree: BookmarkNode[] = [];

            try {
                // [리팩토링] 하드코딩된 상수를 제거하고, 업로드한 외부 백업 json 파일을 비동기로 로드
                const response = await fetch('/bookmarks-2026-06-14.json');
                if (!response.ok) {
                    throw new Error(`Failed to fetch backup file: ${response.statusText}`);
                }
                const backupData = await response.json();
                
                // 루트 스키마 변환 후 내부 표준 트리로 포맷 정문화
                const standardRoot = transformBackupToStandard(backupData);
                
                // 기존 컴포넌트의 루트 탐색 조건(item.id === 'root') 충돌 방지를 위한 식별자 보정
                standardRoot.id = 'root';
                if (!standardRoot.title) {
                    standardRoot.title = 'Bookmark Explorer';
                }
                
                parsedTree = [standardRoot];
            } catch (error) {
                console.error("Backup JSON parsing failed, loading empty fallback tree:", error);
                // 파일 로드 실패 시 시스템 정지를 방지하기 위한 가드 컨텍스트 백업
                parsedTree = [{ id: 'root', title: 'Bookmark Explorer', children: [] }];
            }

            // 로컬 스토리지 데이터 결합 로직 무결성 유지
            const saved = localStorage.getItem('bookmarks');
            const simpleList: BookmarkNode[] = saved ? JSON.parse(saved) : [];
            
            if (simpleList.length > 0 && parsedTree[0]) {
                // 구조 변경 없이 업로드된 데이터의 대안 탑재 영역('toolbar' 또는 첫 번째 자식 폴더) 탐색
                const rootChildren = parsedTree[0].children || [];
                const targetFolder = rootChildren.find(c => c.id === '3' || c.title === 'toolbar' || c.title === 'Bookmarks Bar') || parsedTree[0];
                
                if (!targetFolder.children) targetFolder.children = [];
                targetFolder.children.push(...simpleList);
            }
            
            return parsedTree;
        }
    },

    getAsFlatList: async (): Promise<BookmarkNode[]> => {
        const tree = await bookmarkService.getTree();
        return flattenBookmarks(tree);
    },

    create: async (bookmark: { title: string; url: string }): Promise<void> => {
        if (isExtension) {
            return new Promise<void>((resolve) => {
                chrome.bookmarks.create({
                    title: bookmark.title,
                    url: bookmark.url,
                    parentId: '1'
                }, () => resolve());
            });
        } else {
            const saved = localStorage.getItem('bookmarks');
            const list: BookmarkNode[] = saved ? JSON.parse(saved) : [];
            const newBookmark = { 
                ...bookmark, 
                id: 'custom_' + Date.now().toString(),
                dateAdded: Date.now()
            };
            list.push(newBookmark as BookmarkNode);
            localStorage.setItem('bookmarks', JSON.stringify(list));
        }
    },

    remove: async (id: string): Promise<void> => {
        if (isExtension) {
            return new Promise<void>((resolve) => {
                chrome.bookmarks.remove(id, () => resolve());
            });
        } else {
            const saved = localStorage.getItem('bookmarks');
            let list: BookmarkNode[] = saved ? JSON.parse(saved) : [];
            list = list.filter(b => b.id !== id);
            localStorage.setItem('bookmarks', JSON.stringify(list));
        }
    }
};