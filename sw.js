const CACHE_NAME = 'notas-app-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-900.woff2'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cacheando recursos');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[Service Worker] Instalação completa');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[Service Worker] Erro na instalação:', err);
            })
    );
});

// Ativar e limpar caches antigos
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Ativação completa');
            return self.clients.claim();
        })
    );
});

// Estratégia: Cache-first para assets, Network-first para dados
self.addEventListener('fetch', (event) => {
    // Ignorar requisições não-GET
    if (event.request.method !== 'GET') return;
    
    // URLs que devem ir direto para a rede
    if (event.request.url.includes('/api/') || event.request.url.includes('analytics')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Se temos em cache, retornar do cache
                if (cachedResponse) {
                    console.log('[Service Worker] Servindo do cache:', event.request.url);
                    return cachedResponse;
                }
                
                // Se não temos, buscar da rede
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Se a resposta não é válida, retornar como está
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Clonar a resposta para cache
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                console.log('[Service Worker] Cacheando novo recurso:', event.request.url);
                                cache.put(event.request, responseToCache);
                            });
                        
                        return networkResponse;
                    })
                    .catch(() => {
                        // Fallback para página offline
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('./index.html');
                        }
                        
                        // Fallback para ícone genérico
                        if (event.request.url.includes('favicon')) {
                            return new Response('', { status: 404 });
                        }
                        
                        return new Response('Conteúdo não disponível offline', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Sincronização em background
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-notes') {
        console.log('[Service Worker] Sincronizando notas...');
        event.waitUntil(syncNotes());
    }
});

async function syncNotes() {
    try {
        // Implementar sincronização com servidor aqui
        console.log('[Service Worker] Sincronização realizada');
    } catch (error) {
        console.error('[Service Worker] Erro na sincronização:', error);
    }
}

// Notificações push
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push recebido');
    
    const options = {
        body: event.data ? event.data.text() : 'Nova notificação do Notes App',
        icon: './assets/icons/icon-192.png',
        badge: './assets/icons/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '1'
        },
        actions: [
            {
                action: 'open',
                title: 'Abrir app'
            },
            {
                action: 'close',
                title: 'Fechar'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Notes App', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notificação clicada');
    
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});