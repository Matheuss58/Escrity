// Service Worker para Notas Avançadas
// Versão: 4.0

const CACHE_VERSION = 'notas-app-v4.0';
const APP_SHELL_CACHE = 'app-shell-v1';
const DATA_CACHE = 'app-data-v1';

// URLs para cache do App Shell
const APP_SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Segoe+UI:wght@300;400;500;600;700&display=swap'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando...');
  
  event.waitUntil(
    Promise.all([
      // Cache do App Shell
      caches.open(APP_SHELL_CACHE)
        .then(cache => {
          console.log('[Service Worker] Cacheando App Shell');
          return cache.addAll(APP_SHELL_FILES);
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
  console.log('[Service Worker] Ativando...');
  
  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== APP_SHELL_CACHE && 
                cacheName !== DATA_CACHE && 
                cacheName !== CACHE_VERSION) {
              console.log('[Service Worker] Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Claim clients
      self.clients.claim()
    ]).then(() => {
      console.log('[Service Worker] Ativação completa');
      
      // Notificar todos os clients que o SW está pronto
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
  
  // Para o App Shell: Cache First
  if (APP_SHELL_FILES.some(file => url.pathname.endsWith(file.replace('./', '')))) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          // Retornar do cache se disponível
          if (cachedResponse) {
            // Atualizar cache em background
            event.waitUntil(
              fetch(request).then(response => {
                if (response.ok) {
                  return caches.open(APP_SHELL_CACHE)
                    .then(cache => cache.put(request, response));
                }
              }).catch(() => {
                // Ignorar erro de atualização
              })
            );
            return cachedResponse;
          }
          
          // Se não estiver no cache, buscar da rede
          return fetch(request)
            .then(response => {
              // Verificar resposta válida
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clonar resposta para cache
              const responseToCache = response.clone();
              caches.open(APP_SHELL_CACHE)
                .then(cache => {
                  cache.put(request, responseToCache);
                });
              
              return response;
            })
            .catch(error => {
              console.error('[Service Worker] Fetch failed:', error);
              // Fallback para página offline
              if (request.destination === 'document') {
                return caches.match('./index.html');
              }
              throw error;
            });
        })
    );
    return;
  }
  
  // Para dados da API: Network First
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Se a rede funcionar, armazenar no cache
          const responseClone = response.clone();
          caches.open(DATA_CACHE)
            .then(cache => {
              cache.put(request, responseClone);
            });
          return response;
        })
        .catch(() => {
          // Se a rede falhar, tentar do cache
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              throw new Error('Offline');
            });
        })
    );
    return;
  }
  
  // Para outros recursos: Cache First com atualização
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // Sempre tentar atualizar do servidor em background
        const fetchPromise = fetch(request)
          .then(networkResponse => {
            // Atualizar cache
            if (networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_VERSION)
                .then(cache => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Ignorar erros de atualização
          });
        
        // Retornar do cache imediatamente
        if (cachedResponse) {
          event.waitUntil(fetchPromise);
          return cachedResponse;
        }
        
        // Se não tem cache, usar a resposta da rede
        return fetchPromise.then(response => {
          return response || new Response('', { 
            status: 404, 
            statusText: 'Not Found' 
          });
        });
      })
  );
});

// Handler para mensagens
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName);
      });
    });
  }
});

// Handler para push notifications
self.addEventListener('push', event => {
  console.log('[Service Worker] Push received');
  
  const options = {
    body: event.data ? event.data.text() : 'Nova notificação do Notas Avançadas',
    icon: 'icons/icon-192x192.png',
    badge: 'icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '2'
    },
    actions: [
      {
        action: 'explore',
        title: 'Abrir App',
        icon: 'icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: 'icons/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Notas Avançadas', options)
  );
});

// Handler para cliques em notificações
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click received');
  
  event.notification.close();
  
  if (event.action === 'close') {
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
          return client.focus();
        }
      }
      
      // Se não encontrou, abrir nova janela
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

// Handler para sincronização em background
self.addEventListener('sync', event => {
  console.log('[Service Worker] Sync event:', event.tag);
  
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncNotes());
  }
});

// Função de sincronização de notas
function syncNotes() {
  console.log('[Service Worker] Sincronizando notas...');
  // Aqui você implementaria a lógica de sincronização
  return Promise.resolve();
}

// Handler para periodic sync (para versões mais recentes)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', event => {
    if (event.tag === 'backup-notes') {
      console.log('[Service Worker] Backup periódico iniciado');
      event.waitUntil(backupNotes());
    }
  });
}

// Função de backup periódico
function backupNotes() {
  console.log('[Service Worker] Fazendo backup...');
  return Promise.resolve();
}