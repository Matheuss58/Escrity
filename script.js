class NotesApp {
    constructor() {
        this.currentNotebook = null;
        this.currentSheet = null;
        this.notebooks = [];
        this.deferredPrompt = null;
        this.editingNotebookId = null;
        this.currentUser = null;
        this.isLocalMode = false;
        this.unsavedChanges = false;
        
        // Variáveis para música
        this.isMusicVisible = false;
        this.currentPlaylist = 'default';
        this.currentTrack = null;
        this.isPlaying = false;
        this.defaultTracks = [];
        this.tracks = {
            default: [],
            uploaded: []
        };
        
        this.audio = document.getElementById('audioPlayer');
        this.backupStats = {
            notebooks: 0,
            sheets: 0,
            size: '0 KB'
        };
        
        this.init();
    }

    async init() {
        // Mostrar tela de loading
        document.getElementById('loadingScreen').style.display = 'flex';
        
        // Carregar configuração de músicas padrão
        await this.loadDefaultMusic();
        
        // Configurar eventos primeiro
        this.setupEventListeners();
        
        // Configurar service worker e instalação
        await this.setupServiceWorker();
        this.setupInstallPrompt();
        
        // Configurar eventos do áudio
        this.setupAudioEvents();
        
        // Carregar configurações de música
        this.loadMusicSettings();
        
        // Verificar login e carregar dados
        await this.checkLogin();
        
        // Configurar intervalos
        this.setupIntervals();
        
        // Esconder loading
        setTimeout(() => {
            document.getElementById('loadingScreen').classList.add('fade-out');
            setTimeout(() => {
                document.getElementById('loadingScreen').style.display = 'none';
            }, 500);
        }, 500);
    }

    async checkLogin() {
        try {
            const savedUser = localStorage.getItem('escry-user');
            const savedData = localStorage.getItem('escry-data');
            
            console.log('Verificando login...', { savedUser: !!savedUser, savedData: !!savedData });
            
            if (savedUser && savedData) {
                const user = JSON.parse(savedUser);
                const data = JSON.parse(savedData);
                
                this.currentUser = user;
                this.isLocalMode = user.mode === 'local';
                
                // Carregar dados
                this.notebooks = data.notebooks || [];
                
                console.log('Dados carregados:', {
                    user: this.currentUser.username,
                    notebooks: this.notebooks.length,
                    isLocalMode: this.isLocalMode
                });
                
                // Atualizar interface
                document.getElementById('currentUsername').textContent = user.username;
                document.getElementById('syncStatus').innerHTML = 
                    this.isLocalMode ? 
                    '<i class="fas fa-laptop"></i> Modo offline' :
                    '<i class="fas fa-cloud"></i> Online';
                
                // Mostrar app
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('app-container').style.display = 'flex';
                
                this.renderNotebooks();
                
                if (this.notebooks.length > 0) {
                    this.selectNotebook(this.notebooks[0].id);
                } else {
                    // Criar caderno padrão se não houver nenhum
                    this.createDefaultNotebook();
                }
                
                // Tentar sincronizar se online
                if (!this.isLocalMode && navigator.onLine) {
                    setTimeout(() => this.syncData(), 1000);
                }
                
            } else {
                // Não há usuário salvo, mostrar tela de login
                this.showLoginScreen();
            }
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
            this.showNotification('Erro ao carregar dados. Por favor, faça login novamente.', 'error');
            this.showLoginScreen();
        }
    }

    showLoginScreen() {
    console.log('Mostrando tela de login...');
    
    // Elementos da tela de login
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('app-container'); // Agora com ID correto
    
    // Verificar se os elementos existem antes de tentar acessá-los
    if (loginScreen) {
        loginScreen.style.display = 'flex';
    } else {
        console.error('Elemento loginScreen não encontrado!');
    }
    
    if (appContainer) {
        appContainer.style.display = 'none';
    } else {
        console.warn('Elemento app-container não encontrado. Adicione id="app-container" no HTML.');
    }
    
    // Limpar campos de entrada
    const usernameField = document.getElementById('username');
    const pinField = document.getElementById('pin');
    
    if (usernameField) {
        usernameField.value = '';
    }
    
    if (pinField) {
        pinField.value = '';
    }
    
    // Remover classe 'active' de todas as modais abertas
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
    
    // Fechar sidebar de música se estiver aberta
    const musicSidebar = document.getElementById('musicSidebar');
    if (musicSidebar && musicSidebar.classList.contains('active')) {
        musicSidebar.classList.remove('active');
        this.isMusicVisible = false;
        document.getElementById('toggleMusic').innerHTML = '<i class="fas fa-music"></i> Música';
    }
    
    // Esconder loading screen se ainda estiver visível
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen && loadingScreen.style.display !== 'none') {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
    
    // Limpar dados atuais do app
    this.currentNotebook = null;
    this.currentSheet = null;
    this.currentUser = null;
    this.unsavedChanges = false;
    
    // Resetar editor
    const editor = document.getElementById('editor');
    if (editor) {
        editor.innerHTML = '<p>Selecione uma folha para começar a escrever...</p>';
    }
    
    // Focus no campo de usuário após um pequeno delay
    setTimeout(() => {
        if (usernameField) {
            usernameField.focus();
            
            // Adicionar evento para Enter
            usernameField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const pinField = document.getElementById('pin');
                    if (pinField) {
                        pinField.focus();
                    }
                }
            });
        }
        
        // Adicionar evento Enter no campo PIN
        if (pinField) {
            pinField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const loginBtn = document.getElementById('loginBtn');
                    if (loginBtn) {
                        loginBtn.click();
                    }
                }
            });
        }
        
        // Ativar botões de login/registro
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        
        if (loginBtn) {
            loginBtn.onclick = () => {
                const username = document.getElementById('username')?.value?.trim() || '';
                const pin = document.getElementById('pin')?.value || '';
                this.login(username, pin, false);
            };
        }
        
        if (registerBtn) {
            registerBtn.onclick = () => {
                const username = document.getElementById('username')?.value?.trim() || '';
                const pin = document.getElementById('pin')?.value || '';
                this.login(username, pin, true);
            };
        }
    }, 100);
}

    createDefaultNotebook() {
        console.log('Criando caderno padrão...');
        this.createNotebook('Meu Primeiro Caderno');
        this.showNotification('Caderno padrão criado. Comece a escrever!', 'info');
    }
async login(username, pin, isRegister = false) {
    try {
        console.log('Login/Registro:', { username, isRegister });
        
        // Validação dos campos
        if (!username.trim()) {
            this.showNotification('Digite um nome de usuário válido', 'error');
            return false;
        }
        
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            this.showNotification('Digite um PIN de 4 dígitos numéricos', 'error');
            return false;
        }
        
        // Criar objeto do usuário
        const localModeCheckbox = document.getElementById('localMode');
        this.currentUser = {
            username: username.trim(),
            pin: pin,
            mode: localModeCheckbox && localModeCheckbox.checked ? 'local' : 'sync',
            created: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };
        
        this.isLocalMode = this.currentUser.mode === 'local';
        
        // Salvar usuário no localStorage
        localStorage.setItem('escry-user', JSON.stringify(this.currentUser));
        
        // Carregar ou criar dados
        if (isRegister) {
            console.log('Criando novo usuário...');
            this.notebooks = [{
                id: 'notebook-' + Date.now(),
                name: 'Meu Primeiro Caderno',
                cover: 'default',
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                sheets: [{
                    id: 'sheet-' + Date.now(),
                    title: 'Bem-vindo ao ESCRITY',
                    content: '<p>Comece criando novas folhas e organize suas ideias!</p>',
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    images: []
                }]
            }];
        } else {
            console.log('Carregando dados existentes...');
            // Tentar carregar dados sincronizados
            await this.loadSyncedData();
        }
        
        // Salvar dados localmente
        this.saveLocalData();
        
        // Atualizar interface - COM VERIFICAÇÕES DE NULL
        const usernameElement = document.getElementById('currentUsername');
        const syncStatusElement = document.getElementById('syncStatus');
        const loginScreen = document.getElementById('loginScreen');
        const appContainer = document.getElementById('app-container');
        
        if (usernameElement) {
            usernameElement.textContent = this.currentUser.username;
        } else {
            console.warn('Elemento currentUsername não encontrado');
        }
        
        if (syncStatusElement) {
            syncStatusElement.innerHTML = this.isLocalMode 
                ? '<i class="fas fa-laptop"></i> Modo offline'
                : '<i class="fas fa-cloud"></i> Online';
        } else {
            console.warn('Elemento syncStatus não encontrado');
        }
        
        // Esconder tela de login e mostrar app
        if (loginScreen) {
            loginScreen.style.display = 'none';
        } else {
            console.error('Elemento loginScreen não encontrado');
        }
        
        if (appContainer) {
            appContainer.style.display = 'flex';
        } else {
            console.error('Elemento app-container não encontrado. Certifique-se de adicionar id="app-container" no HTML.');
            // Fallback: procurar por classe
            const appContainerByClass = document.querySelector('.app-container');
            if (appContainerByClass) {
                appContainerByClass.style.display = 'flex';
                console.warn('Usando fallback por classe .app-container');
            }
        }
        
        // Renderizar notebooks
        this.renderNotebooks();
        
        // Selecionar o primeiro notebook se existir
        if (this.notebooks.length > 0) {
            this.selectNotebook(this.notebooks[0].id);
        } else {
            // Criar caderno padrão se não houver nenhum
            this.createDefaultNotebook();
        }
        
        // Mostrar notificação de boas-vindas
        this.showNotification(`Bem-vindo, ${this.currentUser.username}!`, 'success');
        
        // Sincronizar se online e não estiver em modo local
        if (!this.isLocalMode && navigator.onLine) {
            setTimeout(() => {
                this.syncData();
                
                // Atualizar status da sincronização
                if (syncStatusElement) {
                    syncStatusElement.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizando...';
                    syncStatusElement.style.color = 'var(--warning-color)';
                    
                    // Restaurar status após 3 segundos
                    setTimeout(() => {
                        if (syncStatusElement) {
                            syncStatusElement.innerHTML = this.isLocalMode 
                                ? '<i class="fas fa-laptop"></i> Modo offline'
                                : '<i class="fas fa-check-circle"></i> Sincronizado';
                            syncStatusElement.style.color = '';
                        }
                    }, 3000);
                }
            }, 1000);
        }
        
        // Configurar auto-save após login
        this.setupIntervals();
        
        // Registrar evento de saída da página
        this.setupBeforeUnload();
        
        return true;
        
    } catch (error) {
        console.error('Erro durante o login:', error);
        this.showNotification('Erro durante o login. Tente novamente.', 'error');
        
        // Voltar para tela de login em caso de erro
        this.showLoginScreen();
        return false;
    }
}

// Adicione esta função auxiliar se não existir:
setupBeforeUnload() {
    window.addEventListener('beforeunload', (e) => {
        if (this.currentSheet && this.unsavedChanges) {
            this.saveCurrentContent();
            this.saveLocalData();
            
            // Em alguns navegadores, podemos mostrar um alerta
            e.preventDefault();
            e.returnValue = 'Você tem alterações não salvas. Tem certeza que deseja sair?';
        }
        
        // Salvar configurações de música
        this.saveMusicSettings();
    });
}

// E certifique-se que createDefaultNotebook() existe:
createDefaultNotebook() {
    console.log('Criando caderno padrão...');
    const defaultNotebook = {
        id: 'notebook-default-' + Date.now(),
        name: 'Meu Primeiro Caderno',
        cover: 'default',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        sheets: [{
            id: 'sheet-default-' + Date.now(),
            title: 'Bem-vindo ao ESCRITY',
            content: '<p>Comece criando novas folhas e organize suas ideias!</p>',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            images: []
        }]
    };
    
    this.notebooks.push(defaultNotebook);
    this.saveLocalData();
    this.renderNotebooks();
    this.selectNotebook(defaultNotebook.id);
    
    this.showNotification('Caderno padrão criado. Comece a escrever!', 'info');
}

    logout() {
        if (confirm('Tem certeza que deseja sair? Todas as alterações serão salvas.')) {
            // Salvar antes de sair
            this.saveContent();
            this.saveLocalData();
            
            // Limpar
            this.currentUser = null;
            this.notebooks = [];
            localStorage.removeItem('escry-user');
            
            // Mostrar tela de login
            this.showLoginScreen();
        }
    }

    async loadSyncedData() {
        if (this.isLocalMode || !navigator.onLine) {
            // Carregar apenas dados locais
            const localData = localStorage.getItem('escry-data');
            if (localData) {
                try {
                    const data = JSON.parse(localData);
                    this.notebooks = data.notebooks || [];
                    console.log('Dados locais carregados:', this.notebooks.length);
                } catch (e) {
                    console.error('Erro ao parsear dados locais:', e);
                    this.notebooks = [];
                }
            } else {
                this.notebooks = [];
                console.log('Nenhum dado local encontrado');
            }
            return;
        }
        
        try {
            // Aqui você implementaria a sincronização com um servidor
            // Por enquanto, vamos usar apenas dados locais
            const localData = localStorage.getItem('escry-data');
            if (localData) {
                const data = JSON.parse(localData);
                this.notebooks = data.notebooks || [];
            } else {
                this.notebooks = [];
            }
            
            // Simular sincronização (para demonstração)
            const syncKey = `escry-sync-${this.currentUser.username}`;
            const syncedData = localStorage.getItem(syncKey);
            
            if (syncedData) {
                try {
                    const remoteData = JSON.parse(syncedData);
                    // Mesclar dados (simples - em produção seria mais complexo)
                    if (remoteData.lastSync > (data?.lastSync || 0)) {
                        this.notebooks = remoteData.notebooks;
                        console.log('Dados sincronizados do servidor:', this.notebooks.length);
                        this.showNotification('Dados sincronizados do servidor', 'info');
                    }
                } catch (e) {
                    console.error('Erro ao parsear dados sincronizados:', e);
                }
            }
            
        } catch (error) {
            console.error('Erro ao sincronizar:', error);
            this.showNotification('Erro ao sincronizar. Usando dados locais.', 'warning');
            
            // Carregar dados locais como fallback
            const localData = localStorage.getItem('escry-data');
            if (localData) {
                const data = JSON.parse(localData);
                this.notebooks = data.notebooks || [];
            }
        }
    }

    async syncData() {
        if (this.isLocalMode || !navigator.onLine || !this.currentUser) {
            return;
        }
        
        try {
            // Salvar dados locais primeiro
            this.saveLocalData();
            
            // Simular upload para servidor
            const syncKey = `escry-sync-${this.currentUser.username}`;
            const dataToSync = {
                notebooks: this.notebooks,
                lastSync: Date.now(),
                user: this.currentUser.username
            };
            
            localStorage.setItem(syncKey, JSON.stringify(dataToSync));
            
            // Atualizar status
            const syncStatus = document.getElementById('syncStatus');
            syncStatus.innerHTML = '<i class="fas fa-check-circle"></i> Sincronizado';
            syncStatus.style.color = '';
            
            console.log('Dados sincronizados:', new Date().toLocaleTimeString());
            
        } catch (error) {
            console.error('Erro na sincronização:', error);
            const syncStatus = document.getElementById('syncStatus');
            syncStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro na sincronização';
            syncStatus.style.color = 'var(--warning-color)';
        }
    }

    saveLocalData() {
        if (!this.currentUser) return;
        
        const data = {
            notebooks: this.notebooks,
            lastSave: new Date().toISOString(),
            lastSync: Date.now()
        };
        
        localStorage.setItem('escry-data', JSON.stringify(data));
        this.updateLastSaved();
    }

    // ========== BACKUP E RESTAURAÇÃO ==========

    showBackupModal() {
        this.updateBackupStats();
        document.getElementById('backupModal').classList.add('active');
    }

    updateBackupStats() {
        let totalSheets = 0;
        let totalSize = 0;
        
        this.notebooks.forEach(notebook => {
            totalSheets += notebook.sheets?.length || 0;
            
            // Calcular tamanho aproximado
            notebook.sheets?.forEach(sheet => {
                totalSize += JSON.stringify(sheet).length;
            });
        });
        
        totalSize += JSON.stringify(this.notebooks).length;
        
        this.backupStats = {
            notebooks: this.notebooks.length,
            sheets: totalSheets,
            size: this.formatBytes(totalSize)
        };
        
        document.getElementById('backupNotebooks').textContent = this.backupStats.notebooks;
        document.getElementById('backupSheets').textContent = this.backupStats.sheets;
        document.getElementById('backupSize').textContent = this.backupStats.size;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    createBackup() {
        const data = {
            app: 'ESCRITY',
            version: '1.0',
            user: this.currentUser?.username || 'Anônimo',
            date: new Date().toISOString(),
            data: {
                notebooks: this.notebooks,
                music: this.tracks.uploaded
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `escry-backup-${new Date().toISOString().split('T')[0]}.escry`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Backup criado com sucesso!', 'success');
        document.getElementById('backupModal').classList.remove('active');
    }

    showRestoreModal() {
        document.getElementById('restoreModal').classList.add('active');
        document.getElementById('restoreFileInfo').style.display = 'none';
        document.getElementById('confirmRestoreBtn').disabled = true;
    }

    handleRestoreFile(file) {
        if (!file || !file.name.endsWith('.escry')) {
            this.showNotification('Selecione um arquivo de backup válido (.escry)', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backup = JSON.parse(e.target.result);
                
                // Validar backup
                if (!backup.app || backup.app !== 'ESCRITY') {
                    throw new Error('Arquivo de backup inválido');
                }
                
                // Mostrar informações do arquivo
                document.getElementById('restoreFileName').textContent = file.name;
                document.getElementById('restoreFileSize').textContent = this.formatBytes(file.size);
                document.getElementById('restoreFileInfo').style.display = 'block';
                document.getElementById('confirmRestoreBtn').disabled = false;
                
                // Armazenar dados para restauração
                this.pendingRestoreData = backup;
                
            } catch (error) {
                console.error('Erro ao ler backup:', error);
                this.showNotification('Erro ao ler arquivo de backup', 'error');
            }
        };
        
        reader.readAsText(file);
    }

    restoreFromBackup() {
        if (!this.pendingRestoreData) {
            this.showNotification('Nenhum backup selecionado', 'error');
            return;
        }
        
        if (!confirm('ATENÇÃO: Isso substituirá TODOS os seus dados atuais. Tem certeza?')) {
            return;
        }
        
        try {
            // Restaurar cadernos
            this.notebooks = this.pendingRestoreData.data.notebooks || [];
            
            // Restaurar músicas carregadas
            if (this.pendingRestoreData.data.music) {
                this.tracks.uploaded = this.pendingRestoreData.data.music;
                this.saveMusicSettings();
            }
            
            // Salvar dados
            this.saveLocalData();
            
            // Atualizar interface
            this.renderNotebooks();
            
            if (this.notebooks.length > 0) {
                this.selectNotebook(this.notebooks[0].id);
            } else {
                this.clearEditor();
            }
            
            this.showNotification('Backup restaurado com sucesso!', 'success');
            document.getElementById('restoreModal').classList.remove('active');
            
            // Limpar dados pendentes
            this.pendingRestoreData = null;
            
        } catch (error) {
            console.error('Erro ao restaurar backup:', error);
            this.showNotification('Erro ao restaurar backup', 'error');
        }
    }

    // ========== GERENCIAMENTO DE NOTAS ==========

    loadNotebooks() {
        const saved = localStorage.getItem('escry-data');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.notebooks = data.notebooks || [];
            } catch (e) {
                console.error('Erro ao carregar dados:', e);
                this.notebooks = [];
            }
        }
        
        this.renderNotebooks();
        
        if (this.notebooks.length > 0) {
            this.selectNotebook(this.notebooks[0].id);
        }
    }

    renderNotebooks() {
        const container = document.getElementById('notebooksList');
        container.innerHTML = '';
        
        if (this.notebooks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-book-open"></i>
                    <p>Nenhum caderno</p>
                    <p class="hint">Clique no + para criar um</p>
                </div>
            `;
            return;
        }
        
        this.notebooks.forEach(notebook => {
            const div = document.createElement('div');
            div.className = `notebook-item ${this.currentNotebook?.id === notebook.id ? 'active' : ''}`;
            div.innerHTML = `
                <h3>${notebook.name}</h3>
                <div class="notebook-date">${this.formatDate(notebook.updated)}</div>
                <div class="notebook-actions">
                    <button class="notebook-action-btn edit" data-id="${notebook.id}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="notebook-action-btn delete" data-id="${notebook.id}">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            `;
            
            // Selecionar caderno
            div.onclick = (e) => {
                if (!e.target.closest('.notebook-action-btn')) {
                    this.selectNotebook(notebook.id);
                }
            };
            
            // Botão editar
            div.querySelector('.edit').onclick = (e) => {
                e.stopPropagation();
                this.editNotebook(notebook.id);
            };
            
            // Botão excluir
            div.querySelector('.delete').onclick = (e) => {
                e.stopPropagation();
                this.deleteNotebook(notebook.id);
            };
            
            container.appendChild(div);
        });
    }

    editNotebook(notebookId) {
        const notebook = this.notebooks.find(n => n.id === notebookId);
        if (!notebook) return;
        
        this.editingNotebookId = notebookId;
        document.getElementById('editNotebookName').value = notebook.name;
        document.getElementById('editNotebookModal').classList.add('active');
        document.getElementById('editNotebookName').focus();
    }

    saveEditedNotebook() {
        if (!this.editingNotebookId) return;
        
        const newName = document.getElementById('editNotebookName').value.trim();
        if (!newName) {
            this.showNotification('Digite um nome para o caderno', 'error');
            return;
        }
        
        const notebook = this.notebooks.find(n => n.id === this.editingNotebookId);
        if (notebook) {
            notebook.name = newName;
            notebook.updated = new Date().toISOString();
            this.saveLocalData();
            this.renderNotebooks();
            
            if (this.currentNotebook?.id === this.editingNotebookId) {
                document.getElementById('currentNotebookTitle').textContent = newName;
            }
            
            this.showNotification(`Caderno renomeado para "${newName}"`);
        }
        
        document.getElementById('editNotebookModal').classList.remove('active');
        this.editingNotebookId = null;
    }

    deleteNotebook(notebookId) {
        const notebook = this.notebooks.find(n => n.id === notebookId);
        if (!notebook) return;
        
        // Não permitir deletar o último caderno
        if (this.notebooks.length <= 1) {
            this.showNotification('Não é possível deletar o último caderno!', 'error');
            return;
        }
        
        document.getElementById('confirmNotebookMessage').textContent = 
            `Tem certeza que deseja excluir o caderno "${notebook.name}"? Todas as ${notebook.sheets.length} folhas serão perdidas!`;
        
        const modal = document.getElementById('confirmNotebookModal');
        modal.classList.add('active');
        
        document.getElementById('confirmNotebookDeleteBtn').onclick = () => {
            const notebookIndex = this.notebooks.findIndex(n => n.id === notebookId);
            if (notebookIndex !== -1) {
                const notebookName = this.notebooks[notebookIndex].name;
                
                // Se o caderno atual está sendo excluído, selecionar outro
                if (this.currentNotebook?.id === notebookId) {
                    const nextNotebookIndex = notebookIndex === 0 ? 1 : notebookIndex - 1;
                    this.selectNotebook(this.notebooks[nextNotebookIndex].id);
                }
                
                this.notebooks.splice(notebookIndex, 1);
                this.saveLocalData();
                this.renderNotebooks();
                
                this.showNotification(`Caderno "${notebookName}" excluído com sucesso!`);
            }
            
            modal.classList.remove('active');
        };
        
        document.getElementById('cancelNotebookDeleteBtn').onclick = () => {
            modal.classList.remove('active');
        };
    }

    renderSheets() {
        const container = document.getElementById('sheetsList');
        const stats = document.getElementById('totalSheets');
        
        if (!this.currentNotebook || !this.currentNotebook.sheets) {
            container.innerHTML = '<p class="no-sheets">Nenhuma folha</p>';
            stats.textContent = '0 folhas';
            return;
        }
        
        container.innerHTML = '';
        const sheets = this.currentNotebook.sheets;
        
        sheets.forEach((sheet, index) => {
            const div = document.createElement('div');
            div.className = `sheet-item ${this.currentSheet?.id === sheet.id ? 'active' : ''}`;
            div.innerHTML = `
                <h4>${sheet.title}</h4>
                <div class="sheet-date">${this.formatDate(sheet.updated)}</div>
                <button class="delete-sheet" data-id="${sheet.id}" title="Excluir folha">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            div.onclick = (e) => {
                if (!e.target.closest('.delete-sheet')) {
                    this.selectSheet(sheet.id);
                }
            };
            
            const deleteBtn = div.querySelector('.delete-sheet');
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.showDeleteConfirm(sheet);
            };
            
            container.appendChild(div);
        });
        
        stats.textContent = `${sheets.length} folha${sheets.length !== 1 ? 's' : ''}`;
    }

    selectNotebook(id) {
        // Salvar conteúdo atual antes de trocar
        this.saveCurrentContent();
        
        const notebook = this.notebooks.find(n => n.id === id);
        if (!notebook) return;
        
        this.currentNotebook = notebook;
        
        // Garantir que tenha sheets
        if (!notebook.sheets || notebook.sheets.length === 0) {
            notebook.sheets = [this.createNewSheet('Folha 1')];
        }
        
        document.getElementById('currentNotebookTitle').textContent = notebook.name;
        this.updateCover(notebook.cover);
        this.renderNotebooks();
        this.renderSheets();
        
        // Selecionar a primeira folha
        this.selectSheet(notebook.sheets[0].id);
    }

    selectSheet(id) {
        if (!this.currentNotebook) return;
        
        // Salvar conteúdo atual antes de trocar
        this.saveCurrentContent();
        
        const sheet = this.currentNotebook.sheets.find(s => s.id === id);
        if (!sheet) return;
        
        this.currentSheet = sheet;
        document.getElementById('currentSheetTitle').textContent = sheet.title;
        document.getElementById('sheetDate').textContent = this.formatDate(sheet.updated);
        document.getElementById('editor').innerHTML = sheet.content || '<p>Comece a escrever aqui...</p>';
        
        this.renderSheets();
        this.updateCharCount();
        this.updateWordCount();
        this.updateImageCount();
    }

    createNotebook(name) {
        const id = 'notebook-' + Date.now();
        const newNotebook = {
            id,
            name,
            cover: 'default',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            sheets: [this.createNewSheet('Folha 1')]
        };
        
        this.notebooks.push(newNotebook);
        this.saveLocalData();
        this.renderNotebooks();
        this.selectNotebook(id);
        
        this.showNotification(`Caderno "${name}" criado com sucesso!`);
    }

    createNewSheet(title) {
        return {
            id: 'sheet-' + Date.now(),
            title,
            content: '',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            images: []
        };
    }

    addSheet(title) {
        if (!this.currentNotebook) return;
        
        const newSheet = this.createNewSheet(title);
        this.currentNotebook.sheets.push(newSheet);
        this.currentNotebook.updated = new Date().toISOString();
        
        this.saveLocalData();
        this.renderSheets();
        this.selectSheet(newSheet.id);
        
        this.showNotification(`Folha "${title}" criada com sucesso!`);
    }

    deleteSheet(sheetId) {
        if (!this.currentNotebook || !this.currentNotebook.sheets) return;
        
        const sheetIndex = this.currentNotebook.sheets.findIndex(s => s.id === sheetId);
        if (sheetIndex === -1) return;
        
        const sheetTitle = this.currentNotebook.sheets[sheetIndex].title;
        
        // Não permitir deletar a última folha
        if (this.currentNotebook.sheets.length <= 1) {
            this.showNotification('Não é possível deletar a última folha!', 'error');
            return;
        }
        
        this.currentNotebook.sheets.splice(sheetIndex, 1);
        this.currentNotebook.updated = new Date().toISOString();
        
        // Selecionar a primeira folha disponível
        this.selectSheet(this.currentNotebook.sheets[0].id);
        
        this.saveLocalData();
        this.renderSheets();
        
        this.showNotification(`Folha "${sheetTitle}" excluída com sucesso!`);
    }

    saveContent() {
        if (!this.currentSheet) return;
        
        const content = document.getElementById('editor').innerHTML;
        this.currentSheet.content = content;
        this.currentSheet.updated = new Date().toISOString();
        
        // Extrair imagens do conteúdo
        this.extractImagesFromContent();
        
        if (this.currentNotebook) {
            this.currentNotebook.updated = new Date().toISOString();
        }
        
        this.saveLocalData();
        this.updateLastSaved();
        this.unsavedChanges = false;
        document.getElementById('saveBtn').classList.remove('unsaved');
        this.showNotification('Salvo com sucesso!');
    }

    extractImagesFromContent() {
        if (!this.currentSheet) return;
        
        const editor = document.getElementById('editor');
        const images = editor.querySelectorAll('img');
        const imageData = [];
        
        images.forEach(img => {
            // Para imagens base64, armazenar apenas referência
            if (img.src.startsWith('data:')) {
                // Já está no conteúdo, não precisa duplicar
                return;
            }
            
            imageData.push({
                src: img.src,
                alt: img.alt || '',
                class: img.className || ''
            });
        });
        
        this.currentSheet.images = imageData;
    }

    autoSave() {
        if (!this.currentSheet || !this.unsavedChanges) return;
        
        const content = document.getElementById('editor').innerHTML;
        if (content !== this.currentSheet.content) {
            this.saveContent();
            console.log('Auto-save realizado:', new Date().toLocaleTimeString());
        }
    }

    saveCurrentContent() {
        if (this.currentSheet) {
            const content = document.getElementById('editor').innerHTML;
            this.currentSheet.content = content;
            this.currentSheet.updated = new Date().toISOString();
            this.extractImagesFromContent();
        }
    }

    updateCover(coverType) {
        if (!this.currentNotebook) return;
        
        this.currentNotebook.cover = coverType;
        const coverImg = document.getElementById('currentCover');
        const coverSelect = document.getElementById('coverSelect');
        
        // Cores para as capas
        const coverColors = {
            'default': '#ffffff',
            'blue': '#3498db',
            'green': '#2ecc71',
            'red': '#e74c3c',
            'purple': '#9b59b6',
            'orange': '#e67e22',
            'teal': '#1abc9c',
            'pink': '#e84393'
        };
        
        // Gradientes para cada cor
        const coverGradients = {
            'default': 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            'blue': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'green': 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            'red': 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)',
            'purple': 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
            'orange': 'linear-gradient(135deg, #f09819 0%, #edde5d 100%)',
            'teal': 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
            'pink': 'linear-gradient(135deg, #fd746c 0%, #ff9068 100%)'
        };
        
        coverSelect.value = coverType;
        
        if (coverType === 'custom' && this.currentNotebook.customCover) {
            coverImg.src = this.currentNotebook.customCover;
            coverImg.style.background = 'none';
        } else if (coverColors[coverType]) {
            coverImg.src = '';
            coverImg.style.background = coverGradients[coverType];
            coverImg.style.backgroundSize = 'cover';
        }
        
        this.saveLocalData();
        this.showNotification('Capa atualizada!');
    }

    updateCharCount() {
        const editor = document.getElementById('editor');
        const text = editor.textContent;
        const charCount = text.length;
        document.getElementById('charCount').textContent = `${charCount} caracteres`;
        document.getElementById('totalChars').textContent = `${charCount} caracteres`;
    }

    updateWordCount() {
        const editor = document.getElementById('editor');
        const text = editor.textContent.trim();
        const wordCount = text === '' ? 0 : text.split(/\s+/).length;
        document.getElementById('wordCount').textContent = `${wordCount} palavras`;
    }

    updateImageCount() {
        const editor = document.getElementById('editor');
        const images = editor.querySelectorAll('img');
        const imageCount = images.length;
        document.getElementById('imageCount').textContent = `${imageCount} imagem${imageCount !== 1 ? 'ns' : ''}`;
    }

    updateLastSaved() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
        document.getElementById('lastSaved').textContent = `Salvo: ${timeStr}`;
    }

    clearEditor() {
        document.getElementById('currentNotebookTitle').textContent = 'Selecione um caderno';
        document.getElementById('currentSheetTitle').textContent = 'Nenhuma folha selecionada';
        document.getElementById('sheetDate').textContent = '';
        document.getElementById('editor').innerHTML = '<p>Selecione uma folha para começar a escrever...</p>';
        this.updateCharCount();
        this.updateWordCount();
        this.updateImageCount();
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notificationText');
        
        text.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'flex';
        
        // Remover a notificação após 3 segundos
        setTimeout(() => {
            notification.classList.add('hiding');
            setTimeout(() => {
                notification.style.display = 'none';
                notification.classList.remove('hiding');
            }, 300);
        }, 3000);
    }

    showDeleteConfirm(sheet) {
        const modal = document.getElementById('confirmModal');
        const message = document.getElementById('confirmMessage');
        message.textContent = `Tem certeza que deseja excluir a folha "${sheet.title}"? Esta ação não pode ser desfeita.`;
        
        modal.classList.add('active');
        
        document.getElementById('confirmDeleteBtn').onclick = () => {
            this.deleteSheet(sheet.id);
            modal.classList.remove('active');
        };
        
        document.getElementById('cancelDeleteBtn').onclick = () => {
            modal.classList.remove('active');
        };
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMins = Math.floor(diffMs / (1000 * 60));
                return diffMins < 1 ? 'Agora' : `${diffMins} min atrás`;
            }
            return `${diffHours} h atrás`;
        } else if (diffDays === 1) {
            return 'Ontem';
        } else if (diffDays < 7) {
            return `${diffDays} dias atrás`;
        } else {
            return date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }
    }

    checkUnsavedChanges() {
        if (!this.currentSheet) return;
        
        const currentContent = document.getElementById('editor').innerHTML;
        if (currentContent !== this.currentSheet.content) {
            this.unsavedChanges = true;
            const saveBtn = document.getElementById('saveBtn');
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar *';
            saveBtn.classList.add('unsaved');
        }
    }

    formatParagraph() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        
        if (selectedText) {
            // Aplicar parágrafo ao texto selecionado
            const p = document.createElement('p');
            p.textContent = selectedText;
            range.deleteContents();
            range.insertNode(p);
        } else {
            // Inserir novo parágrafo
            document.execCommand('formatBlock', false, 'p');
        } 
    }

    // ========== IMAGENS ==========
    showImageModal() {
        document.getElementById('imageModal').classList.add('active');
        document.getElementById('insertImageBtn').disabled = true;
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('urlPreview').style.display = 'none';
        document.getElementById('imageAlt').value = '';
        document.getElementById('imageSize').value = 'auto';
        document.getElementById('imageUrl').value = '';
        
        // Resetar file input
        document.getElementById('imageFile').value = '';
    }

    handleImageUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            this.showNotification('Selecione um arquivo de imagem válido', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('previewImage');
            preview.src = e.target.result;
            document.getElementById('imagePreview').style.display = 'block';
            document.getElementById('insertImageBtn').disabled = false;
            
            // Gerar nome automático para alt text
            const fileName = file.name.replace(/\.[^/.]+$/, "");
            document.getElementById('imageAlt').value = fileName;
        };
        reader.readAsDataURL(file);
    }

    handleUrlPreview() {
        const url = document.getElementById('imageUrl').value.trim();
        if (!url) return;
        
        // Validar URL
        try {
            new URL(url);
        } catch {
            this.showNotification('URL inválida', 'error');
            return;
        }
        
        const preview = document.getElementById('urlPreviewImage');
        preview.src = url;
        document.getElementById('urlPreview').style.display = 'block';
        document.getElementById('insertImageBtn').disabled = false;
    }

    insertImage() {
        let imageSrc = '';
        let imageAlt = document.getElementById('imageAlt').value.trim();
        const imageSize = document.getElementById('imageSize').value;
        
        const activeTab = document.querySelector('.option-tab.active').dataset.option;
        
        if (activeTab === 'upload') {
            const preview = document.getElementById('previewImage');
            if (!preview.src) {
                this.showNotification('Selecione uma imagem primeiro', 'error');
                return;
            }
            imageSrc = preview.src;
        } else {
            const url = document.getElementById('imageUrl').value.trim();
            if (!url) {
                this.showNotification('Digite uma URL válida', 'error');
                return;
            }
            imageSrc = url;
        }
        
        if (!imageAlt) {
            imageAlt = 'Imagem';
        }
        
        // Inserir imagem no editor
        const img = document.createElement('img');
        img.src = imageSrc;
        img.alt = imageAlt;
        
        // Aplicar classe de tamanho
        if (imageSize !== 'auto') {
            img.classList.add(imageSize);
        }
        
        // Inserir no cursor ou no final
        const editor = document.getElementById('editor');
        const selection = window.getSelection();
        
        if (selection.rangeCount && !selection.isCollapsed) {
            // Substituir texto selecionado
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
        } else {
            // Inserir no final
            editor.appendChild(img);
            editor.appendChild(document.createElement('p'));
        }
        
        // Focar no editor e colocar cursor após a imagem
        editor.focus();
        const range = document.createRange();
        range.setStartAfter(img);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Fechar modal
        document.getElementById('imageModal').classList.remove('active');
        
        // Atualizar contadores
        this.updateImageCount();
        this.unsavedChanges = true;
        this.checkUnsavedChanges();
        
        this.showNotification('Imagem inserida com sucesso!');
    }

    // ========== LINKS ==========

    showLinkModal() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        document.getElementById('linkText').value = selectedText;
        document.getElementById('linkUrl').value = '';
        document.getElementById('linkNewTab').checked = true;
        document.getElementById('linkModal').classList.add('active');
    }

    insertLink() {
        const text = document.getElementById('linkText').value.trim();
        const url = document.getElementById('linkUrl').value.trim();
        const newTab = document.getElementById('linkNewTab').checked;
        
        if (!text || !url) {
            this.showNotification('Preencha todos os campos', 'error');
            return;
        }
        
        // Validar URL
        try {
            new URL(url);
        } catch {
            this.showNotification('URL inválida', 'error');
            return;
        }
        
        // Criar link
        const a = document.createElement('a');
        a.href = url;
        a.textContent = text;
        a.title = text;
        
        if (newTab) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        }
        
        // Inserir no editor
        const editor = document.getElementById('editor');
        const selection = window.getSelection();
        
        if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            
            if (!selection.isCollapsed) {
                // Substituir texto selecionado
                range.deleteContents();
                range.insertNode(a);
            } else {
                // Inserir no cursor
                range.insertNode(a);
            }
            
            // Colocar cursor após o link
            const newRange = document.createRange();
            newRange.setStartAfter(a);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
        
        // Fechar modal
        document.getElementById('linkModal').classList.remove('active');
        
        this.unsavedChanges = true;
        this.checkUnsavedChanges();
        
        this.showNotification('Link inserido com sucesso!');
    }

    // ========== MÚSICA ==========

    async loadDefaultMusic() {
        try {
            const config = JSON.parse(document.getElementById('default-music-config').textContent);
            this.defaultTracks = config.tracks;
            this.tracks.default = config.tracks;
            
            // Renderizar músicas padrão
            this.renderDefaultTracks();
            
        } catch (error) {
            console.error('Erro ao carregar músicas padrão:', error);
            this.defaultTracks = [];
            this.tracks.default = [];
        }
    }

    loadMusicSettings() {
        const saved = localStorage.getItem('escry-music');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.tracks.uploaded = data.tracks || [];
                this.currentPlaylist = data.currentPlaylist || 'default';
                this.audio.volume = data.volume || 0.5;
                document.getElementById('volumeSlider').value = this.audio.volume;
            } catch (e) {
                this.tracks.uploaded = [];
                this.currentPlaylist = 'default';
                this.audio.volume = 0.5;
            }
        }
        
        this.renderUploadedTracks();
    }

    setupAudioEvents() {
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => {
            document.getElementById('duration').textContent = this.formatTime(this.audio.duration);
        });
        this.audio.addEventListener('ended', () => this.playNextTrack());
        this.audio.addEventListener('play', () => this.updatePlayState(true));
        this.audio.addEventListener('pause', () => this.updatePlayState(false));
    }

    toggleMusicSidebar() {
        const musicSidebar = document.getElementById('musicSidebar');
        this.isMusicVisible = !this.isMusicVisible;
        
        if (this.isMusicVisible) {
            musicSidebar.classList.add('active');
            document.getElementById('toggleMusic').innerHTML = '<i class="fas fa-times"></i> Fechar Música';
        } else {
            musicSidebar.classList.remove('active');
            document.getElementById('toggleMusic').innerHTML = '<i class="fas fa-music"></i> Música';
        }
    }

    renderDefaultTracks() {
        const container = document.getElementById('defaultTracksList');
        container.innerHTML = '';
        
        if (this.tracks.default.length === 0) {
            container.innerHTML = `
                <div class="no-tracks">
                    <i class="fas fa-music"></i>
                    <p>Nenhuma música padrão configurada</p>
                    <p class="upload-hint">Configure as músicas no código fonte</p>
                </div>
            `;
            return;
        }
        
        this.tracks.default.forEach((track, index) => {
            const div = document.createElement('div');
            div.className = `track-item ${this.currentTrack?.id === track.id ? 'playing' : ''}`;
            div.setAttribute('data-id', track.id);
            div.innerHTML = `
                <div class="track-number">${index + 1}</div>
                <div class="track-details">
                    <div class="title">${track.title}</div>
                    <div class="artist">${track.artist}</div>
                </div>
                <div class="track-duration">${track.duration}</div>
                <i class="fas fa-play"></i>
            `;
            
            div.onclick = () => this.playTrack(track);
            container.appendChild(div);
        });
    }

    renderUploadedTracks() {
        const container = document.getElementById('uploadedTracksList');
        container.innerHTML = '';
        
        if (this.tracks.uploaded.length === 0) {
            container.innerHTML = `
                <div class="no-tracks">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>Nenhuma música carregada</p>
                    <p class="upload-hint">Arraste ou clique para adicionar músicas</p>
                </div>
            `;
            return;
        }
        
        this.tracks.uploaded.forEach((track, index) => {
            const div = document.createElement('div');
            div.className = `track-item ${this.currentTrack?.id === track.id ? 'playing' : ''}`;
            div.setAttribute('data-id', track.id);
            div.innerHTML = `
                <div class="track-number">${index + 1}</div>
                <div class="track-details">
                    <div class="title">${track.title}</div>
                    <div class="artist">${track.artist}</div>
                </div>
                <div class="track-duration">${track.duration}</div>
                <button class="delete-track" data-id="${track.id}" title="Remover">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            div.onclick = (e) => {
                if (!e.target.closest('.delete-track')) {
                    this.playTrack(track);
                }
            };
            
            const deleteBtn = div.querySelector('.delete-track');
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteUploadedTrack(track.id);
            };
            
            container.appendChild(div);
        });
    }

    playTrack(track) {
        this.currentTrack = track;
        this.audio.src = track.url;
        
        this.audio.play().catch(e => {
            console.error('Erro ao reproduzir:', e);
            
            // Se for música padrão com caminho relativo, tentar fallback
            if (track.type === 'default' && track.url.startsWith('assets/')) {
                this.showNotification('Música padrão não encontrada. Configure os arquivos na pasta assets/music/', 'warning');
            } else {
                this.showNotification('Erro ao reproduzir música', 'error');
            }
        });
        
        // Atualizar UI
        document.getElementById('currentTrackTitle').textContent = track.title;
        document.getElementById('currentTrackArtist').textContent = track.artist;
        document.getElementById('playPause').innerHTML = '<i class="fas fa-pause"></i>';
        document.getElementById('playPause').title = 'Pausar';
        this.isPlaying = true;
        
        // Atualizar estado da faixa
        this.updateTrackStates();
        
        // Atualizar status na barra inferior
        document.getElementById('musicStatusText').textContent = 'Tocando';
        document.querySelector('#musicStatus i').style.color = '#9b59b6';
    }

    updatePlayState(playing) {
        this.isPlaying = playing;
        const playBtn = document.getElementById('playPause');
        
        if (playing) {
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            playBtn.title = 'Pausar';
            document.getElementById('musicStatusText').textContent = 'Tocando';
            document.querySelector('#musicStatus i').style.color = '#9b59b6';
        } else {
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.title = 'Reproduzir';
            document.getElementById('musicStatusText').textContent = 'Pausado';
            document.querySelector('#musicStatus i').style.color = '';
        }
    }

    playPause() {
        if (!this.currentTrack) {
            // Se não há música selecionada, tocar a primeira da playlist atual
            const tracks = this.tracks[this.currentPlaylist];
            if (tracks && tracks.length > 0) {
                this.playTrack(tracks[0]);
            } else {
                this.showNotification('Nenhuma música disponível', 'warning');
            }
            return;
        }
        
        if (this.isPlaying) {
            this.audio.pause();
        } else {
            this.audio.play().catch(e => {
                console.error('Erro ao retomar:', e);
            });
        }
    }

    playNextTrack() {
        const tracks = this.tracks[this.currentPlaylist];
        if (!tracks || tracks.length === 0) return;
        
        const currentIndex = tracks.findIndex(t => t.id === this.currentTrack?.id);
        const nextIndex = (currentIndex + 1) % tracks.length;
        
        if (tracks[nextIndex]) {
            this.playTrack(tracks[nextIndex]);
        }
    }

    playPrevTrack() {
        const tracks = this.tracks[this.currentPlaylist];
        if (!tracks || tracks.length === 0) return;
        
        const currentIndex = tracks.findIndex(t => t.id === this.currentTrack?.id);
        const prevIndex = currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1;
        
        if (tracks[prevIndex]) {
            this.playTrack(tracks[prevIndex]);
        }
    }

    updateProgress() {
        if (!this.audio.duration) return;
        
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        document.getElementById('progressSlider').value = progress;
        document.getElementById('currentTime').textContent = this.formatTime(this.audio.currentTime);
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updateTrackStates() {
        document.querySelectorAll('.track-item').forEach(item => {
            item.classList.remove('playing');
        });
        
        if (this.currentTrack) {
            const currentItem = document.querySelector(`.track-item[data-id="${this.currentTrack.id}"]`);
            if (currentItem) {
                currentItem.classList.add('playing');
            }
        }
    }

    updateVolume() {
        const volume = parseFloat(document.getElementById('volumeSlider').value);
        this.audio.volume = volume;
        this.saveMusicSettings();
    }

    updateProgressSlider() {
        const slider = document.getElementById('progressSlider');
        const progress = parseFloat(slider.value);
        if (this.audio.duration) {
            this.audio.currentTime = (progress / 100) * this.audio.duration;
        }
    }

    handleUploadedFiles(files) {
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('audio/')) {
                this.showNotification('Apenas arquivos de áudio são permitidos', 'error');
                return;
            }
            
            if (file.size > 50 * 1024 * 1024) { // 50MB
                this.showNotification('Arquivo muito grande (máximo 50MB)', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const track = {
                    id: 'uploaded-' + Date.now() + Math.random().toString(36).substr(2, 9),
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    artist: 'Arquivo Local',
                    duration: '--:--',
                    url: e.target.result,
                    type: 'local',
                    fileSize: file.size
                };
                
                this.tracks.uploaded.push(track);
                this.saveMusicSettings();
                this.renderUploadedTracks();
                
                // Se for a primeira música carregada, atualizar playlist
                if (this.tracks.uploaded.length === 1) {
                    this.switchMusicTab('uploaded');
                }
                
                this.showNotification(`"${file.name}" adicionado à biblioteca`);
            };
            reader.readAsDataURL(file);
        });
    }

    deleteUploadedTrack(trackId) {
        const trackIndex = this.tracks.uploaded.findIndex(track => track.id === trackId);
        if (trackIndex !== -1) {
            const track = this.tracks.uploaded[trackIndex];
            
            // Se a música que está sendo excluída está tocando atualmente
            if (this.currentTrack && this.currentTrack.id === trackId) {
                if (this.tracks.uploaded.length > 1) {
                    // Tocar a próxima música ou a anterior
                    const nextIndex = trackIndex < this.tracks.uploaded.length - 1 ? trackIndex + 1 : trackIndex - 1;
                    if (this.tracks.uploaded[nextIndex]) {
                        this.playTrack(this.tracks.uploaded[nextIndex]);
                    } else {
                        this.audio.pause();
                        this.currentTrack = null;
                        this.updatePlayState(false);
                    }
                } else {
                    // Última música sendo removida
                    this.audio.pause();
                    this.currentTrack = null;
                    this.updatePlayState(false);
                }
            }
            
            this.tracks.uploaded.splice(trackIndex, 1);
            this.saveMusicSettings();
            this.renderUploadedTracks();
            
            this.showNotification('Música removida da biblioteca');
        }
    }

    switchMusicTab(tabName) {
        // Atualizar botões
        document.querySelectorAll('.music-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            }
        });
        
        // Atualizar conteúdo
        document.querySelectorAll('.tracks-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.id === tabName + 'Tracks') {
                tab.classList.add('active');
            }
        });
        
        this.currentPlaylist = tabName;
        this.saveMusicSettings();
    }

    saveMusicSettings() {
        const data = {
            tracks: this.tracks.uploaded,
            currentPlaylist: this.currentPlaylist,
            volume: this.audio.volume
        };
        localStorage.setItem('escry-music', JSON.stringify(data));
    }

    // ========== INSTALAÇÃO PWA ==========

    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registrado com sucesso:', registration);
                
                // Verificar se há uma nova versão do service worker
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('Novo Service Worker encontrado:', newWorker);
                    
                    newWorker.addEventListener('statechange', () => {
                        console.log('Estado do novo Service Worker:', newWorker.state);
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('Nova versão disponível. Por favor, atualize a página.');
                            this.showNotification('Nova versão disponível! Atualize a página.', 'info');
                        }
                    });
                });
                
            } catch (error) {
                console.error('Erro ao registrar Service Worker:', error);
                this.showNotification('Erro ao configurar app offline', 'error');
            }
        } else {
            console.log('Service Worker não suportado neste navegador');
        }
    }

    setupInstallPrompt() {
        const installBtn = document.getElementById('installBtn');
        
        // Verificar se já está instalado
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           window.navigator.standalone;
        
        if (isStandalone) {
            installBtn.style.display = 'none';
            return;
        }
        
        // Evento para detectar quando o app pode ser instalado
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('beforeinstallprompt disparado');
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Mostrar o botão de instalação
            installBtn.style.display = 'flex';
            installBtn.onclick = () => this.installApp();
        });
        
        // Evento quando o app é instalado
        window.addEventListener('appinstalled', () => {
            console.log('App instalado com sucesso!');
            this.deferredPrompt = null;
            installBtn.style.display = 'none';
            this.showNotification('App instalado com sucesso! Você pode acessá-lo diretamente do seu menu de apps.');
        });
        
        // Se não houver beforeinstallprompt, mostrar instruções manuais
        setTimeout(() => {
            if (!this.deferredPrompt && installBtn.style.display !== 'none') {
                installBtn.onclick = () => this.showInstallInstructions();
            }
        }, 3000);
    }

    async installApp() {
        const installBtn = document.getElementById('installBtn');
        
        if (!this.deferredPrompt) {
            this.showInstallInstructions();
            return;
        }
        
        // Mostrar prompt de instalação
        this.deferredPrompt.prompt();
        
        // Aguardar a resposta do usuário
        const choiceResult = await this.deferredPrompt.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
            console.log('Usuário aceitou a instalação');
            installBtn.style.display = 'none';
            this.showNotification('Instalando... O app estará disponível em breve no seu menu de aplicativos.');
        } else {
            console.log('Usuário recusou a instalação');
            this.showNotification('Instalação cancelada. Você ainda pode usar o app no navegador.', 'warning');
        }
        
        this.deferredPrompt = null;
    }

    showInstallInstructions() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isAndroid = /Android/.test(navigator.userAgent);
        
        let instructions = '';
        
        if (isIOS) {
            instructions = `
                <strong>Para instalar no iPhone/iPad:</strong>
                <ol>
                    <li>Toque no botão "Compartilhar" (ícone de quadrado com flecha para cima)</li>
                    <li>Role para baixo e toque em "Adicionar à Tela de Início"</li>
                    <li>Toque em "Adicionar" no canto superior direito</li>
                </ol>
                <p><small>Esta funcionalidade está disponível no Safari.</small></p>
            `;
        } else if (isAndroid) {
            instructions = `
                <strong>Para instalar no Android:</strong>
                <ol>
                    <li>Toque no menu (três pontos) no navegador</li>
                    <li>Selecione "Adicionar à tela inicial" ou "Instalar app"</li>
                    <li>Toque em "Adicionar" ou "Instalar" para confirmar</li>
                </ol>
                <p><small>Funciona no Chrome e em navegadores baseados no Chromium.</small></p>
            `;
        } else {
            instructions = `
                <strong>Para instalar no computador:</strong>
                <ol>
                    <li>No Chrome/Edge: Clique no ícone de instalação (quadrado com +) na barra de endereço</li>
                    <li>No Firefox: Clique no ícone de casa no endereço, depois em "Instalar"</li>
                    <li>No Safari: No menu "Arquivo", selecione "Adicionar à Tela de Início"</li>
                </ol>
            `;
        }
        
        document.getElementById('installInstructions').innerHTML = instructions;
        document.getElementById('installInstructionsModal').classList.add('active');
    }

    // ========== EVENT LISTENERS ==========

    setupEventListeners() {
        // ===== LOGIN =====
        document.getElementById('loginBtn').onclick = () => {
            const username = document.getElementById('username').value.trim();
            const pin = document.getElementById('pin').value;
            this.login(username, pin, false);
        };

        document.getElementById('registerBtn').onclick = () => {
            const username = document.getElementById('username').value.trim();
            const pin = document.getElementById('pin').value;
            this.login(username, pin, true);
        };

        // Enter para login
        document.getElementById('username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('pin').focus();
            }
        });

        document.getElementById('pin').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('loginBtn').click();
            }
        });

        // ===== APP =====
        document.getElementById('logoutBtn').onclick = () => this.logout();
        
        document.getElementById('syncNowBtn').onclick = () => {
            if (this.isLocalMode) {
                this.showNotification('Modo offline ativado. Desative no login para sincronizar.', 'warning');
            } else if (!navigator.onLine) {
                this.showNotification('Sem conexão com a internet', 'error');
            } else {
                this.syncData();
                this.showNotification('Sincronizando...', 'info');
            }
        };

        // ===== NOTAS =====
        document.getElementById('newNotebook').onclick = () => {
            document.getElementById('notebookModal').classList.add('active');
            document.getElementById('notebookName').focus();
        };

        document.getElementById('createNotebookBtn').onclick = () => {
            const name = document.getElementById('notebookName').value.trim();
            if (name) {
                this.createNotebook(name);
                document.getElementById('notebookModal').classList.remove('active');
                document.getElementById('notebookName').value = '';
            } else {
                this.showNotification('Digite um nome para o caderno', 'error');
            }
        };

        document.getElementById('cancelNotebookBtn').onclick = () => {
            document.getElementById('notebookModal').classList.remove('active');
        };

        document.getElementById('notebookName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('createNotebookBtn').click();
            }
        });

        // Editar caderno
        document.getElementById('saveEditBtn').onclick = () => this.saveEditedNotebook();
        document.getElementById('cancelEditBtn').onclick = () => {
            document.getElementById('editNotebookModal').classList.remove('active');
            this.editingNotebookId = null;
        };

        document.getElementById('editNotebookName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveEditedNotebook();
            }
        });

        // Nova folha
        document.getElementById('newSheet').onclick = () => {
            document.getElementById('sheetModal').classList.add('active');
            document.getElementById('sheetName').focus();
        };

        document.getElementById('createSheetBtn').onclick = () => {
            const name = document.getElementById('sheetName').value.trim();
            if (name) {
                this.addSheet(name);
                document.getElementById('sheetModal').classList.remove('active');
                document.getElementById('sheetName').value = '';
            } else {
                this.showNotification('Digite um título para a folha', 'error');
            }
        };

        document.getElementById('cancelSheetBtn').onclick = () => {
            document.getElementById('sheetModal').classList.remove('active');
        };

        document.getElementById('sheetName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('createSheetBtn').click();
            }
        });

        // Salvar
        document.getElementById('saveBtn').onclick = () => this.saveContent();

        // Ferramentas de formatação
        document.getElementById('paragraphBtn').addEventListener('click', () => this.formatParagraph());
        document.getElementById('boldBtn').addEventListener('click', () => document.execCommand('bold'));
        document.getElementById('italicBtn').addEventListener('click', () => document.execCommand('italic'));
        document.getElementById('underlineBtn').addEventListener('click', () => document.execCommand('underline'));
        document.getElementById('listUlBtn').addEventListener('click', () => document.execCommand('insertUnorderedList'));
        document.getElementById('listOlBtn').addEventListener('click', () => document.execCommand('insertOrderedList'));
        document.getElementById('imageBtn').addEventListener('click', () => this.showImageModal());
        document.getElementById('linkBtn').addEventListener('click', () => this.showLinkModal());

        // Contador de caracteres e palavras
        const editor = document.getElementById('editor');
        editor.addEventListener('input', () => {
            this.updateCharCount();
            this.updateWordCount();
            this.updateImageCount();
            this.checkUnsavedChanges();
        });

        // Seletor de capa
        document.getElementById('coverSelect').addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                document.getElementById('customCover').click();
            } else {
                this.updateCover(e.target.value);
            }
        });

        document.getElementById('changeCoverBtn').onclick = () => {
            document.getElementById('customCover').click();
        };

        // Capa personalizada
        document.getElementById('customCover').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (!file.type.startsWith('image/')) {
                    this.showNotification('Apenas arquivos de imagem são permitidos', 'error');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById('currentCover').src = event.target.result;
                    if (this.currentNotebook) {
                        this.currentNotebook.customCover = event.target.result;
                        this.currentNotebook.cover = 'custom';
                        document.getElementById('coverSelect').value = 'custom';
                        this.saveLocalData();
                        this.showNotification('Capa personalizada atualizada!');
                    }
                };
                reader.readAsDataURL(file);
            }
        });

        // Excluir folha atual
        document.getElementById('deleteSheetBtn').onclick = () => {
            if (this.currentSheet) {
                this.showDeleteConfirm(this.currentSheet);
            } else {
                this.showNotification('Nenhuma folha selecionada', 'error');
            }
        };

        // ===== BACKUP =====
        document.getElementById('backupBtn').onclick = () => this.showBackupModal();
        document.getElementById('restoreBtn').onclick = () => this.showRestoreModal();
        
        document.getElementById('cancelBackupBtn').onclick = () => {
            document.getElementById('backupModal').classList.remove('active');
        };
        
        document.getElementById('createBackupBtn').onclick = () => this.createBackup();
        
        document.getElementById('cancelRestoreBtn').onclick = () => {
            document.getElementById('restoreModal').classList.remove('active');
            this.pendingRestoreData = null;
        };
        
        document.getElementById('confirmRestoreBtn').onclick = () => this.restoreFromBackup();
        
        // Upload de arquivo de restore
        const restoreDropArea = document.getElementById('restoreDropArea');
        const restoreFile = document.getElementById('restoreFile');
        
        restoreDropArea.addEventListener('click', () => restoreFile.click());
        
        restoreDropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            restoreDropArea.style.borderColor = 'var(--primary-color)';
            restoreDropArea.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
        });
        
        restoreDropArea.addEventListener('dragleave', () => {
            restoreDropArea.style.borderColor = 'var(--border-color)';
            restoreDropArea.style.backgroundColor = '';
        });
        
        restoreDropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            restoreDropArea.style.borderColor = 'var(--border-color)';
            restoreDropArea.style.backgroundColor = '';
            this.handleRestoreFile(e.dataTransfer.files[0]);
        });
        
        restoreFile.addEventListener('change', (e) => {
            this.handleRestoreFile(e.target.files[0]);
        });

        // ===== IMAGENS =====
        document.getElementById('cancelImageBtn').onclick = () => {
            document.getElementById('imageModal').classList.remove('active');
        };
        
        document.getElementById('insertImageBtn').onclick = () => this.insertImage();
        
        // Tabs do modal de imagem
        document.querySelectorAll('.option-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.option-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.option-content').forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(tab.dataset.option + 'Option').classList.add('active');
                
                // Resetar botão de inserção
                document.getElementById('insertImageBtn').disabled = true;
            });
        });
        
        // Upload de imagem
        const imageUploadArea = document.getElementById('imageUploadArea');
        const imageFile = document.getElementById('imageFile');
        
        imageUploadArea.addEventListener('click', () => imageFile.click());
        
        imageUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageUploadArea.style.borderColor = 'var(--primary-color)';
            imageUploadArea.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
        });
        
        imageUploadArea.addEventListener('dragleave', () => {
            imageUploadArea.style.borderColor = 'var(--border-color)';
            imageUploadArea.style.backgroundColor = '';
        });
        
        imageUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            imageUploadArea.style.borderColor = 'var(--border-color)';
            imageUploadArea.style.backgroundColor = '';
            this.handleImageUpload(e.dataTransfer.files[0]);
        });
        
        imageFile.addEventListener('change', (e) => {
            this.handleImageUpload(e.target.files[0]);
        });
        
        document.getElementById('removePreview').onclick = () => {
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('insertImageBtn').disabled = true;
            document.getElementById('imageFile').value = '';
        };
        
        // Preview de URL
        document.getElementById('imageUrl').addEventListener('input', () => {
            this.handleUrlPreview();
        });
        
        document.getElementById('imageAlt').addEventListener('input', () => {
            const insertBtn = document.getElementById('insertImageBtn');
            if (!insertBtn.disabled) {
                // Habilitar apenas se já tiver uma imagem
                const activeTab = document.querySelector('.option-tab.active').dataset.option;
                if (activeTab === 'upload') {
                    insertBtn.disabled = !document.getElementById('previewImage').src;
                } else {
                    insertBtn.disabled = !document.getElementById('imageUrl').value.trim();
                }
            }
        });

        // ===== LINKS =====
        document.getElementById('cancelLinkBtn').onclick = () => {
            document.getElementById('linkModal').classList.remove('active');
        };
        
        document.getElementById('insertLinkBtn').onclick = () => this.insertLink();
        
        document.getElementById('linkText').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('linkUrl').focus();
            }
        });
        
        document.getElementById('linkUrl').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.insertLink();
            }
        });

        // ===== MÚSICA =====
        document.getElementById('toggleMusic').onclick = () => this.toggleMusicSidebar();
        document.getElementById('closeMusic').onclick = () => this.toggleMusicSidebar();
        
        // Tabs de música
        document.querySelectorAll('.music-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchMusicTab(tab.dataset.tab);
            });
        });
        
        // Controles do player
        document.getElementById('playPause').onclick = () => this.playPause();
        document.getElementById('nextTrack').onclick = () => this.playNextTrack();
        document.getElementById('prevTrack').onclick = () => this.playPrevTrack();
        
        // Sliders
        document.getElementById('volumeSlider').addEventListener('input', () => this.updateVolume());
        document.getElementById('progressSlider').addEventListener('input', () => this.updateProgressSlider());
        
        // Upload de música
        const uploadArea = document.getElementById('uploadArea');
        const audioUpload = document.getElementById('audioUpload');
        
        uploadArea.addEventListener('click', () => audioUpload.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--info-color)';
            uploadArea.style.backgroundColor = 'rgba(155, 89, 182, 0.1)';
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = 'rgba(255,255,255,0.3)';
            uploadArea.style.backgroundColor = 'rgba(255,255,255,0.05)';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'rgba(255,255,255,0.3)';
            uploadArea.style.backgroundColor = 'rgba(255,255,255,0.05)';
            this.handleUploadedFiles(e.dataTransfer.files);
        });
        
        audioUpload.addEventListener('change', (e) => {
            this.handleUploadedFiles(e.target.files);
            e.target.value = '';
        });

        // ===== INSTALAÇÃO =====
        document.getElementById('closeInstallInstructions').onclick = () => {
            document.getElementById('installInstructionsModal').classList.remove('active');
        };

        // ===== MENU MOBILE =====
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.querySelector('.sidebar');
        const sheetsSidebar = document.querySelector('.sheets-sidebar');
        
        mobileMenuBtn.addEventListener('click', () => {
            if (window.innerWidth <= 992) {
                if (!sidebar.classList.contains('active')) {
                    sidebar.classList.add('active');
                    sheetsSidebar.classList.remove('active');
                } else if (!sheetsSidebar.classList.contains('active')) {
                    sheetsSidebar.classList.add('active');
                    sidebar.classList.remove('active');
                } else {
                    sidebar.classList.remove('active');
                    sheetsSidebar.classList.remove('active');
                }
            }
        });

        // Fechar sidebars ao clicar fora (mobile)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 992) {
                if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target) && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                }
                if (!sheetsSidebar.contains(e.target) && !mobileMenuBtn.contains(e.target) && sheetsSidebar.classList.contains('active')) {
                    sheetsSidebar.classList.remove('active');
                }
            }
        });

        // ===== GERAL =====
        // Fechar modais com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.getElementById('notebookModal').classList.remove('active');
                document.getElementById('editNotebookModal').classList.remove('active');
                document.getElementById('sheetModal').classList.remove('active');
                document.getElementById('confirmModal').classList.remove('active');
                document.getElementById('confirmNotebookModal').classList.remove('active');
                document.getElementById('backupModal').classList.remove('active');
                document.getElementById('restoreModal').classList.remove('active');
                document.getElementById('imageModal').classList.remove('active');
                document.getElementById('linkModal').classList.remove('active');
                document.getElementById('installInstructionsModal').classList.remove('active');
                
                // Fechar música se visível
                if (this.isMusicVisible) {
                    this.toggleMusicSidebar();
                }
            }
            
            // Ctrl+S para salvar
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveContent();
            }
            
            // Ctrl+B para negrito
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                document.execCommand('bold');
            }
            
            // Ctrl+I para itálico
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                document.execCommand('italic');
            }
            
            // Ctrl+U para sublinhado
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                document.execCommand('underline');
            }
            
            // Ctrl+Shift+I para imagem
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
                e.preventDefault();
                this.showImageModal();
            }
            
            // Ctrl+K para link
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.showLinkModal();
            }
            
            // Ctrl+Space para play/pause música
            if (e.ctrlKey && e.key === ' ') {
                e.preventDefault();
                this.playPause();
            }
        });

        // Fechar modais clicando fora
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    if (modal.id === 'editNotebookModal') {
                        this.editingNotebookId = null;
                    }
                    if (modal.id === 'restoreModal') {
                        this.pendingRestoreData = null;
                    }
                }
            });
        });

        // Salvar ao sair da página
        window.addEventListener('beforeunload', (e) => {
            if (this.currentSheet && this.unsavedChanges) {
                this.saveCurrentContent();
                this.saveLocalData();
                
                // Em alguns navegadores, podemos mostrar um alerta
                e.preventDefault();
                e.returnValue = 'Você tem alterações não salvas. Tem certeza que deseja sair?';
            }
            
            // Salvar configurações de música
            this.saveMusicSettings();
        });

        // Atualizar status da música quando houver erro
        this.audio.addEventListener('error', () => {
            this.showNotification('Erro ao carregar a música. Verifique o arquivo.', 'error');
            document.getElementById('musicStatusText').textContent = 'Erro';
            document.querySelector('#musicStatus i').style.color = 'var(--danger-color)';
        });

        // Monitorar conexão para sincronização
        window.addEventListener('online', () => {
            if (!this.isLocalMode) {
                this.showNotification('Conexão restaurada. Sincronizando...', 'info');
                this.syncData();
                document.getElementById('syncStatus').innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizando...';
            }
        });

        window.addEventListener('offline', () => {
            this.showNotification('Sem conexão com a internet', 'warning');
            document.getElementById('syncStatus').innerHTML = '<i class="fas fa-wifi-slash"></i> Offline';
        });

        // Suporte a toque para melhor UX mobile
        document.addEventListener('touchstart', () => {}, {passive: true});
        
        // Prevenir zoom com dois dedos
        document.addEventListener('gesturestart', (e) => {
            e.preventDefault();
        });

        // Melhorar scroll em mobile
        let startY;
        document.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, {passive: true});

        document.addEventListener('touchmove', (e) => {
            const element = e.target;
            const isScrollable = element.scrollHeight > element.clientHeight;
            
            if (!isScrollable && element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
                e.preventDefault();
            }
        }, {passive: false});
        
        // ===== LOADING SCREEN FALLBACK =====
        // Garantir que o loading some após um tempo máximo
        setTimeout(() => {
            if (document.getElementById('loadingScreen').style.display === 'flex') {
                console.log('Timeout do loading screen, forçando tela de login');
                document.getElementById('loadingScreen').classList.add('fade-out');
                setTimeout(() => {
                    document.getElementById('loadingScreen').style.display = 'none';
                    this.showLoginScreen();
                }, 500);
            }
        }, 5000); // 5 segundos de timeout
    }
    
    setupIntervals() {
        // Auto-save a cada 30 segundos
        setInterval(() => this.autoSave(), 30000);
        
        // Verificar modificações não salvas
        setInterval(() => this.checkUnsavedChanges(), 5000);
        
        // Sincronização automática (se online)
        if (!this.isLocalMode) {
            setInterval(() => {
                if (navigator.onLine) {
                    this.syncData();
                }
            }, 60000); // A cada 1 minuto
        }
    }
}

// Inicializar o app quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, iniciando app...');
    
    // Pequeno delay para garantir que tudo está carregado
    setTimeout(() => {
        const app = new NotesApp();
        window.notesApp = app;
        
        // Verificar se há uma nova versão do service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Controller changed - new service worker activated');
                window.location.reload();
            });
        }
        
        // Forçar foco no campo de usuário se estiver na tela de login
        setTimeout(() => {
            const loginScreen = document.getElementById('loginScreen');
            const usernameField = document.getElementById('username');
            
            if (loginScreen && loginScreen.style.display !== 'none' && usernameField) {
                usernameField.focus();
            }
        }, 100);
    }, 100); // 100ms de delay
});