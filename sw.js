// Service Worker para ESCRITY
// Versão: 2.0

const CACHE_VERSION = 'escry-app-v2.0';
const APP_SHELL_CACHE = 'app-shell-v2';
const DATA_CACHE = 'app-data-v2';

// URLs para cache do App Shell
const APP_SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Segoe+UI:wght@300;400;500;600;700&display=swap',
  './assets/capas/default.jpg'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando ESCRITY...');
  
  event.waitUntil(
    Promise.all([
      // Cache do App Shell
      caches.open(APP_SHELL_CACHE)
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
  console.log('[Service Worker] Ativando ESCRITY...');
  
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

// Estratégia de Cache: Network First com fallback para cache
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
  
  // Para arquivos de música padrão, usar cache first
  if (url.pathname.includes('/assets/music/')) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then(response => {
          // Não cachear se falhar
          if (!response.ok) {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(APP_SHELL_CACHE).then(cache => {
            cache.put(request, responseToCache);
          });
          return response;
        }).catch(() => {
          // Retornar fallback para música
          return new Response('', {
            status: 404,
            headers: { 'Content-Type': 'audio/mpeg' }
          });
        });
      })
    );
    return;
  }
  
  // Para o App Shell: Cache First
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
            caches.open(APP_SHELL_CACHE).then(cache => {
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
          throw new Error('Offline');
        });
      })
    );
    return;
  }
  
  // Para outros recursos: Network First
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
            
            // Fallback genérico para páginas
            if (request.destination === 'document') {
              return caches.match('./index.html');
            }
            
            // Fallback para imagens
            if (request.destination === 'image') {
              return caches.match('./assets/capas/default.jpg');
            }
            
            throw new Error('Offline');
          });
      })
  );
});

// Handler para mensagens
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

// Handler para push notifications
self.addEventListener('push', event => {
  console.log('[Service Worker] Push received:', event.data);
  
  const options = {
    body: 'Novas atualizações disponíveis no ESCRITY',
    icon: './icons/icon-192x192.png',
    badge: './icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: './',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir App',
        icon: './icons/checkmark.png'
      },
      {
        action: 'dismiss',
        title: 'Fechar',
        icon: './icons/xmark.png'
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
        return clients.openWindow('./').then(client => {
          if (client) {
            setTimeout(() => {
              client.postMessage({
                type: 'NOTIFICATION_CLICK',
                data: event.notification.data
              });
            }, 1000);
          }
        });
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
async function syncNotes() {
  console.log('[Service Worker] Sincronizando notas em background...');
  
  // Aqui você implementaria a lógica de sincronização com servidor
  // Por enquanto, apenas log
  return Promise.resolve();
}

// Background sync para periodic sync (para versões mais recentes)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', event => {
    if (event.tag === 'backup-notes') {
      console.log('[Service Worker] Backup periódico iniciado');
      event.waitUntil(backupNotes());
    }
  });
}

// Função de backup periódico
async function backupNotes() {
  console.log('[Service Worker] Fazendo backup em background...');
  // Implementar lógica de backup
  return Promise.resolve();
}

// Handler para instalação do app
self.addEventListener('appinstalled', event => {
  console.log('[Service Worker] App instalado');
  
  // Limpar caches antigos
  caches.keys().then(cacheNames => {
    cacheNames.forEach(cacheName => {
      if (!cacheName.includes('v2')) {
        caches.delete(cacheName);
      }
    });
  });
});

// Handler para fetch de páginas offline
function getOfflinePage() {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ESCRITY - Offline</title>
        <style>
            body {
                font-family: 'Segoe UI', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-align: center;
                padding: 20px;
            }
            .container {
                max-width: 500px;
            }
            h1 {
                font-size: 2.5rem;
                margin-bottom: 20px;
            }
            p {
                font-size: 1.2rem;
                margin-bottom: 30px;
                opacity: 0.9;
            }
            .icon {
                font-size: 4rem;
                margin-bottom: 20px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="icon">📝</div>
            <h1>ESCRITY</h1>
            <p>Você está offline no momento.</p>
            <p>Algumas funcionalidades podem estar limitadas.</p>
            <p>Tente reconectar-se à internet para sincronizar seus dados.</p>
        </div>
    </body>
    </html>
  `;
}