// Service Worker for Quick Task PWA
const CACHE_NAME = 'quick-task-v2';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.svg',
    './icon-512.svg'
];

// 安装事件 - 缓存核心资源
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// 请求拦截 - 网络优先，缓存后备
self.addEventListener('fetch', event => {
    // 只处理 GET 请求
    if (event.request.method !== 'GET') return;
    
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // 缓存成功的响应
                if (response.status === 200) {
                    const cache = caches.open(CACHE_NAME);
                    cache.then(c => c.put(event.request, response.clone()));
                }
                return response;
            })
            .catch(() => {
                // 网络失败，从缓存获取
                return caches.match(event.request);
            })
    );
});
