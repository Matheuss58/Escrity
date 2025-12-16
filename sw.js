// Service Worker para ESCRITY v2.0
const CACHE_VERSION = 'escry-v2.0';
const APP_CACHE = 'app-cache-v2';
const DATA_CACHE = 'data-cache-v2';

// Arquivos para cache do App Shell
const APP_SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './assets/capas/default.jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando ESCRITY v2.0...');
  
  event.waitUntil(
    Promise.all([
      // Cache do App Shell
      caches.open(APP_CACHE)
        .then(cache => {
          console.log('[Service Worker] Cacheando App Shell');
          return cache.addAll(APP_SHELL_FILES).catch(error => {
            console.warn('[Service Worker] Alguns arquivos não puderam ser cacheados:', error);
          });
        }),
      
      // Skip waiting para ativação imediata
      self.skipWaiting()
    ]).then(() => {
      console.log('[Service Worker] Instalação completa');
    }).catch(error => {
      console.error('[Service Worker] Erro na instalação:', error);
    })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Ativando ESCRITY v2.0...');
  
  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== APP_CACHE && cacheName !== DATA_CACHE) {
              console.log('[Service Worker] Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Claim clients imediatamente
      self.clients.claim()
    ]).then(() => {
      console.log('[Service Worker] Ativação completa');
      
      // Notificar todos os clients que o SW está pronto
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: CACHE_VERSION,
            timestamp: new Date().toISOString()
          });
        });
      });
    })
  );
});

// Estratégia de Cache: Stale-While-Revalidate
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Ignorar requisições não GET
  if (request.method !== 'GET') return;
  
  // Ignorar requisições de chrome-extension
  if (request.url.startsWith('chrome-extension://')) return;
  
  // Ignorar blob/data URLs
  if (request.url.startsWith('blob:') || request.url.startsWith('data:')) {
    return;
  }
  
  // Para o App Shell: Cache First com atualização em background
  if (APP_SHELL_FILES.some(file => url.pathname.endsWith(file.replace('./', ''))) ||
      url.pathname === '/' || 
      url.pathname === '/index.html') {
    
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        // Sempre tentar atualizar do servidor em background
        const fetchPromise = fetch(request).then(response => {
          // Atualizar cache se a resposta for válida
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(APP_CACHE).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        }).catch(() => {
          // Ignorar erro de atualização
        });
        
        // Retornar do cache imediatamente se disponível
        if (cachedResponse) {
          event.waitUntil(fetchPromise);
          return cachedResponse;
        }
        
        // Se não tem cache, buscar da rede
        return fetch(request).catch(() => {
          // Fallback para página offline
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
          return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
    );
    return;
  }
  
  // Para dados (APIs, etc): Network First
  event.respondWith(
    fetch(request)
      .then(response => {
        // Se a rede funcionar, armazenar no cache
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(DATA_CACHE)
            .then(cache => {
              cache.put(request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        // Se a rede falhar, tentar do cache
        return caches.match(request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Fallback genérico
            return new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Handler para mensagens do cliente
self.addEventListener('message', event => {
  const data = event.data;
  
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      });
      break;
      
    case 'GET_CACHE_INFO':
      caches.keys().then(cacheNames => {
        event.ports[0].postMessage({
          type: 'CACHE_INFO',
          caches: cacheNames
        });
      });
      break;
  }
});

// Background sync para dados offline
self.addEventListener('sync', event => {
  console.log('[Service Worker] Sync event:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('[Service Worker] Sincronizando dados em background...');
  
  // Aqui você implementaria a lógica de sincronização com servidor
  // Por enquanto, apenas log
  return Promise.resolve();
}

// Push notifications
self.addEventListener('push', event => {
  console.log('[Service Worker] Push received:', event.data);
  
  const options = {
    body: 'Novas atualizações disponíveis no ESCRITY',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: './',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir App'
      },
      {
        action: 'dismiss',
        title: 'Fechar'
      }
    ]
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      if (data.title) options.title = data.title;
      if (data.body) options.body = data.body;
    } catch (e) {
      options.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification('ESCRITY', options)
  );
});

// Handler para cliques em notificações
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click received:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Focar na janela existente ou abrir nova
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Buscar cliente focado ou visível
      for (const client of clientList) {
        if (client.visibilityState === 'visible') {
          return client.focus().then(() => {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: event.notification.data
            });
          });
        }
      }
      
      // Se não encontrou, abrir nova janela
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});