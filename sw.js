// Service Worker para ESCRITY (Versão 3.0)
const CACHE_VERSION = 'escry-v3.0';
const APP_CACHE = 'app-cache-v3';
const DATA_CACHE = 'data-cache-v3';

// Arquivos essenciais para cache
const APP_SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './assets/capas/default.jpg',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap'
];

// Instalação
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando ESCRITY v3.0...');
  
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => {
        console.log('[Service Worker] Cacheando arquivos essenciais');
        return cache.addAll(APP_SHELL_FILES).catch(error => {
          console.warn('[Service Worker] Alguns arquivos não puderam ser cacheados:', error);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação
self.addEventListener('activate', event => {
  console.log('[Service Worker] Ativando ESCRITY v3.0...');
  
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
      
      // Claim clients
      self.clients.claim()
    ]).then(() => {
      console.log('[Service Worker] Pronto para uso offline');
      
      // Notificar clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: CACHE_VERSION
          });
        });
      });
    })
  );
});

// Fetch strategy: Cache First para arquivos estáticos
self.addEventListener('fetch', event => {
  const request = event.request;
  
  // Ignorar requisições não GET
  if (request.method !== 'GET') return;
  
  // Ignorar blob/data URLs
  if (request.url.startsWith('blob:') || request.url.startsWith('data:')) return;
  
  // Para arquivos do app shell: Cache First
  if (APP_SHELL_FILES.some(file => request.url.includes(file.replace('./', '')))) {
    event.respondWith(
      caches.match(request).then(response => {
        // Retornar do cache se disponível
        if (response) {
          // Atualizar cache em background
          event.waitUntil(
            fetch(request).then(response => {
              if (response.ok) {
                return caches.open(APP_CACHE).then(cache => {
                  return cache.put(request, response);
                });
              }
            }).catch(() => {
              // Ignorar erro de atualização
            })
          );
          return response;
        }
        
        // Buscar da rede
        return fetch(request).catch(() => {
          // Fallback para offline
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }
  
  // Para outros recursos: Network First
  event.respondWith(
    fetch(request)
      .then(response => {
        // Armazenar no cache se for bem sucedido
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(DATA_CACHE)
            .then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Tentar do cache
        return caches.match(request);
      })
  );
});

// Mensagens do client
self.addEventListener('message', event => {
  const data = event.data;
  
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(APP_CACHE);
      caches.delete(DATA_CACHE);
      break;
      
    case 'GET_CACHE_INFO':
      caches.open(APP_CACHE).then(cache => {
        cache.keys().then(keys => {
          event.ports[0].postMessage({
            cacheSize: keys.length,
            version: CACHE_VERSION
          });
        });
      });
      break;
  }
});

// Push notifications (opcional)
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'ESCRITY: Suas histórias estão seguras.',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: './',
      date: new Date()
    }
  };
  
  event.waitUntil(self.registration.showNotification(data.title || 'ESCRITY', options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      for (const client of clientList) {
        if (client.visibilityState === 'visible') {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

// Background sync para backup
self.addEventListener('sync', event => {
  if (event.tag === 'sync-backup') {
    console.log('[Service Worker] Sincronizando backup em background...');
    // Aqui você poderia sincronizar com um servidor se tivesse
    event.waitUntil(Promise.resolve());
  }
});