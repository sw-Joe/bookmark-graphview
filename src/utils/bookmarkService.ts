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

// Rich nested mock bookmarks tree (Depth 3+ with diverse topics)
const mockBookmarks: BookmarkNode[] = [
    {
        id: 'root',
        title: 'Bookmark Explorer',
        children: [
            {
                id: 'bookmarks_bar',
                title: 'Bookmarks Bar',
                children: [
                    {
                        id: 'dev_resources',
                        title: 'Developer Resources',
                        children: [
                            {
                                id: 'frontend',
                                title: 'Frontend Frameworks',
                                children: [
                                    { id: 'react', title: 'React Official', url: 'https://react.dev' },
                                    { id: 'vue', title: 'Vue.js Home', url: 'https://vuejs.org' },
                                    { id: 'svelte', title: 'Svelte Hub', url: 'https://svelte.dev' },
                                    { id: 'nextjs', title: 'Next.js Framework', url: 'https://nextjs.org' }
                                ]
                            },
                            {
                                id: 'languages',
                                title: 'Programming Languages',
                                children: [
                                    { id: 'ts', title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org' },
                                    { id: 'rust', title: 'Rust Language', url: 'https://www.rust-lang.org' },
                                    { id: 'go', title: 'Go Programming', url: 'https://go.dev' }
                                ]
                            },
                            {
                                id: 'tools',
                                title: 'Developer Tools',
                                children: [
                                    { id: 'github', title: 'GitHub', url: 'https://github.com' },
                                    { id: 'vite', title: 'Vite Bundler', url: 'https://vite.dev' },
                                    { id: 'cursor', title: 'Cursor AI Editor', url: 'https://cursor.com' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'news_media',
                        title: 'News & Media',
                        children: [
                            { id: 'hacker_news', title: 'Hacker News', url: 'https://news.ycombinator.com' },
                            { id: 'dev_to', title: 'DEV Community', url: 'https://dev.to' },
                            { id: 'medium', title: 'Medium Blogs', url: 'https://medium.com' }
                        ]
                    },
                    {
                        id: 'social_comms',
                        title: 'Social & Chat',
                        children: [
                            { id: 'discord', title: 'Discord App', url: 'https://discord.com' },
                            { id: 'slack', title: 'Slack Workspace', url: 'https://slack.com' },
                            { id: 'twitter', title: 'X / Twitter', url: 'https://x.com' }
                        ]
                    }
                ]
            }
        ]
    }
];

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
            // Local Mock Data
            const saved = localStorage.getItem('bookmarks');
            const simpleList: BookmarkNode[] = saved ? JSON.parse(saved) : [];
            
            // Deep clone mockBookmarks to avoid mutating our static reference
            const tree = JSON.parse(JSON.stringify(mockBookmarks)) as BookmarkNode[];
            
            if (simpleList.length > 0) {
                // Find 'bookmarks_bar' inside the cloned tree and add simpleList
                const bookmarksBar = tree[0]?.children?.find(c => c.id === 'bookmarks_bar');
                if (bookmarksBar) {
                    if (!bookmarksBar.children) bookmarksBar.children = [];
                    bookmarksBar.children.push(...simpleList);
                }
            }
            return Promise.resolve(tree);
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
                id: Date.now().toString(),
                dateAdded: Date.now()
            };
            list.push(newBookmark as BookmarkNode);
            localStorage.setItem('bookmarks', JSON.stringify(list));
            return Promise.resolve();
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
            return Promise.resolve();
        }
    }
};
