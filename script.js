class NotesApp {
    constructor() {
        this.currentNotebook = null;
        this.currentSheet = null;
        this.notebooks = [];
        this.deferredPrompt = null;
        this.editingNotebookId = null;
        this.isLocalMode = true; // Sempre modo local
        this.unsavedChanges = false;
        this.ignoredWords = new Set(); // Palavras ignoradas individualmente
        
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
        
        // Personalização da folha
        this.currentCustomization = {
            backgroundImage: null,
            backgroundOpacity: 0.1,
            backgroundBlur: 0,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
        };
        
        // Configurações de fonte
        this.fontSettings = {
            fontFamily: "'Inter', sans-serif",
            fontSize: 18,
            lineHeight: 1.8,
            letterSpacing: 0
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
        console.log('Inicializando ESCRITY...');
        
        // Mostrar tela de loading
        document.getElementById('loadingScreen').style.display = 'flex';
        
        // Carregar configuração de músicas padrão
        await this.loadDefaultMusic();
        
        // Configurar eventos
        this.setupEventListeners();
        
        // Configurar service worker
        await this.setupServiceWorker();
        this.setupInstallPrompt();
        
        // Configurar eventos do áudio
        this.setupAudioEvents();
        
        // Carregar configurações de música
        this.loadMusicSettings();
        
        // Carregar dados locais
        await this.loadData();
        
        // Esconder loading e mostrar app
        setTimeout(() => {
            document.getElementById('loadingScreen').classList.add('fade-out');
            setTimeout(() => {
                document.getElementById('loadingScreen').style.display = 'none';
                this.enterApp();
            }, 500);
        }, 800);
    }

    enterApp() {
        console.log('Entrando no app...');
        
        try {
            // Atualizar interface
            document.getElementById('currentUsername').textContent = 'Modo Local';
            
            const syncStatus = document.getElementById('syncStatus');
            syncStatus.innerHTML = '<i class="fas fa-laptop"></i> Dispositivo Local';
            syncStatus.style.color = 'var(--warning-color)';
            
            // Mostrar app
            document.getElementById('app-container').style.display = 'flex';
            
            // Renderizar notebooks
            this.renderNotebooks();
            
            // Selecionar o primeiro notebook ou criar padrão
            if (this.notebooks.length > 0) {
                this.selectNotebook(this.notebooks[0].id);
            } else {
                this.createDefaultNotebook();
            }
            
            // Mostrar notificação
            this.showNotification('ESCRITY iniciado em modo local. Dados salvos apenas neste dispositivo.', 'info');
            
            // Configurar intervalos
            this.setupIntervals();
            
            // Registrar evento de saída
            this.setupBeforeUnload();
            
        } catch (error) {
            console.error('Erro ao entrar no app:', error);
            this.showNotification('Erro ao carregar dados. Tente recarregar a página.', 'error');
        }
    }

    async loadData() {
        console.log('Carregando dados locais...');
        
        // Carregar dados locais
        const localData = localStorage.getItem('escry-local-data');
        if (localData) {
            try {
                const data = JSON.parse(localData);
                this.notebooks = data.notebooks || [];
                this.fontSettings = data.fontSettings || this.fontSettings;
                this.ignoredWords = new Set(data.ignoredWords || []);
                console.log('Dados locais carregados:', this.notebooks.length);
            } catch (e) {
                console.error('Erro ao parsear dados locais:', e);
                this.notebooks = [];
            }
        } else {
            this.notebooks = [];
        }
    }

    saveData() {
        console.log('Salvando dados...');
        
        const data = {
            notebooks: this.notebooks,
            fontSettings: this.fontSettings,
            ignoredWords: Array.from(this.ignoredWords),
            lastSave: new Date().toISOString(),
            version: '2.0'
        };
        
        // Salvar localmente
        localStorage.setItem('escry-local-data', JSON.stringify(data));
        console.log('Dados salvos localmente');
        
        this.updateLastSaved();
        this.unsavedChanges = false;
        document.getElementById('saveBtn').classList.remove('unsaved');
    }

    clearLocalData() {
        if (confirm('Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.')) {
            localStorage.removeItem('escry-local-data');
            localStorage.removeItem('escry-music');
            this.notebooks = [];
            this.currentNotebook = null;
            this.currentSheet = null;
            this.renderNotebooks();
            this.clearEditor();
            this.showNotification('Todos os dados foram limpos.', 'info');
        }
    }

    createDefaultNotebook() {
        console.log('Criando caderno padrão...');
        
        const defaultNotebook = {
            id: 'notebook-default-' + Date.now(),
            name: 'Meu Primeiro Caderno',
            cover: 'default.jpg', // Referência direta à capa padrão
            customCover: null,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            sheets: [{
                id: 'sheet-default-' + Date.now(),
                title: 'Bem-vindo ao ESCRITY',
                content: `
                    <h1>Bem-vindo ao ESCRITY! ✨</h1>
                    <p>Seu editor de notas local está pronto para uso.</p>
                    <h2>🎯 Comece por aqui:</h2>
                    <ul>
                        <li><strong>Novo Caderno:</strong> Clique no botão "+" na barra lateral</li>
                        <li><strong>Nova Folha:</strong> Clique no botão "+" na barra de folhas</li>
                        <li><strong>Formatação:</strong> Use os botões na barra superior</li>
                        <li><strong>Imagens:</strong> Clique no botão de imagem para inserir</li>
                        <li><strong>Personalização:</strong> Clique em "Personalizar" para mudar o fundo da folha</li>
                        <li><strong>Fonte:</strong> Clique em "Fonte" para alterar aparência do texto</li>
                    </ul>
                    <p><em>Dica: Use Ctrl+S para salvar rapidamente!</em></p>
                `,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                images: [],
                customization: {
                    backgroundImage: null,
                    backgroundOpacity: 0.1,
                    backgroundBlur: 0
                },
                fontSettings: { ...this.fontSettings }
            }]
        };
        
        this.notebooks.push(defaultNotebook);
        this.saveData();
        this.renderNotebooks();
        this.selectNotebook(defaultNotebook.id);
        
        this.showNotification('Caderno padrão criado. Comece a escrever!', 'info');
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
            version: '2.0',
            mode: 'local',
            date: new Date().toISOString(),
            data: {
                notebooks: this.notebooks,
                music: this.tracks.uploaded,
                fontSettings: this.fontSettings,
                ignoredWords: Array.from(this.ignoredWords)
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
            
            // Restaurar configurações de fonte
            if (this.pendingRestoreData.data.fontSettings) {
                this.fontSettings = this.pendingRestoreData.data.fontSettings;
            }
            
            // Restaurar palavras ignoradas
            if (this.pendingRestoreData.data.ignoredWords) {
                this.ignoredWords = new Set(this.pendingRestoreData.data.ignoredWords);
            }
            
            // Salvar dados
            this.saveData();
            
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
                <h3>${this.escapeHtml(notebook.name)}</h3>
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
            this.saveData();
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
            `Tem certeza que deseja excluir o caderno "${notebook.name}"? Todas as ${notebook.sheets?.length || 0} folhas serão perdidas!`;
        
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
                this.saveData();
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
                <h4>${this.escapeHtml(sheet.title)}</h4>
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
            this.saveData();
        }
        
        // Atualizar interface
        document.getElementById('currentNotebookTitle').textContent = notebook.name;
        this.updateCover(notebook.cover, notebook.customCover);
        this.renderNotebooks();
        this.renderSheets();
        
        // Selecionar a primeira folha
        if (notebook.sheets.length > 0) {
            this.selectSheet(notebook.sheets[0].id);
        }
    }

    selectSheet(id) {
        if (!this.currentNotebook) return;
        
        // Salvar conteúdo atual antes de trocar
        this.saveCurrentContent();
        
        const sheet = this.currentNotebook.sheets.find(s => s.id === id);
        if (!sheet) return;
        
        this.currentSheet = sheet;
        
        // Atualizar interface
        document.getElementById('currentSheetTitle').textContent = sheet.title;
        document.getElementById('sheetDate').textContent = this.formatDate(sheet.updated);
        
        // Carregar conteúdo
        const editor = document.getElementById('editor');
        editor.innerHTML = sheet.content || '<p>Comece a escrever aqui...</p>';
        
        // Aplicar configurações de fonte da folha
        if (sheet.fontSettings) {
            this.applyFontSettings(sheet.fontSettings);
        } else {
            this.applyFontSettings(this.fontSettings);
        }
        
        // Aplicar personalização
        if (sheet.customization) {
            this.applySheetCustomization(sheet.customization);
        } else {
            this.clearSheetCustomization();
        }
        
        // Atualizar contadores
        this.updateCharCount();
        this.updateWordCount();
        this.updateImageCount();
        
        // Renderizar lista de folhas
        this.renderSheets();
        
        // Focar no editor
        setTimeout(() => {
            editor.focus();
            this.moveCursorToEnd(editor);
        }, 100);
    }

    createNotebook(name) {
        const id = 'notebook-' + Date.now();
        const newNotebook = {
            id,
            name,
            cover: 'default.jpg',
            customCover: null,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            sheets: [this.createNewSheet('Folha 1')]
        };
        
        this.notebooks.push(newNotebook);
        this.saveData();
        this.renderNotebooks();
        this.selectNotebook(id);
        
        this.showNotification(`Caderno "${name}" criado com sucesso!`);
    }

    createNewSheet(title) {
        return {
            id: 'sheet-' + Date.now(),
            title,
            content: '<p>Comece a escrever aqui...</p>',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            images: [],
            customization: {
                backgroundImage: null,
                backgroundOpacity: 0.1,
                backgroundBlur: 0,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            },
            fontSettings: { ...this.fontSettings }
        };
    }

    addSheet(title) {
        if (!this.currentNotebook) return;
        
        const newSheet = this.createNewSheet(title);
        this.currentNotebook.sheets.push(newSheet);
        this.currentNotebook.updated = new Date().toISOString();
        
        this.saveData();
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
        
        this.saveData();
        this.renderSheets();
        
        this.showNotification(`Folha "${sheetTitle}" excluída com sucesso!`);
    }

    saveContent() {
        if (!this.currentSheet) return;
        
        const content = document.getElementById('editor').innerHTML;
        this.currentSheet.content = content;
        this.currentSheet.updated = new Date().toISOString();
        
        // Salvar configurações de fonte atuais
        this.currentSheet.fontSettings = { ...this.fontSettings };
        
        // Extrair imagens do conteúdo
        this.extractImagesFromContent();
        
        if (this.currentNotebook) {
            this.currentNotebook.updated = new Date().toISOString();
        }
        
        this.saveData();
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
            
            // Salvar configurações de fonte atuais
            this.currentSheet.fontSettings = { ...this.fontSettings };
        }
    }

    updateCover(coverType, customCover = null) {
        if (!this.currentNotebook) return;
        
        this.currentNotebook.cover = coverType;
        this.currentNotebook.customCover = customCover;
        
        const coverImg = document.getElementById('currentCover');
        
        if (coverType === 'custom' && customCover) {
            coverImg.src = customCover;
        } else {
            // Usar capa padrão
            coverImg.src = 'assets/capas/default.jpg';
        }
        
        this.saveData();
    }

    showCoverModal() {
        const modal = document.getElementById('coverModal');
        modal.classList.add('active');
        
        // Resetar opções
        const coverOptions = document.querySelectorAll('.cover-option');
        coverOptions.forEach(option => {
            option.classList.remove('active');
            if (option.dataset.cover === (this.currentNotebook?.cover === 'default.jpg' ? 'default' : 'custom')) {
                option.classList.add('active');
            }
        });
        
        // Mostrar/ocultar upload personalizado
        const customUpload = document.getElementById('coverCustomUpload');
        const preview = document.getElementById('coverPreview');
        
        if (this.currentNotebook?.cover === 'custom' && this.currentNotebook.customCover) {
            customUpload.style.display = 'block';
            preview.style.display = 'block';
            document.getElementById('previewCover').src = this.currentNotebook.customCover;
        } else {
            customUpload.style.display = 'none';
            preview.style.display = 'none';
        }
    }

    applyCover() {
        const selectedCover = document.querySelector('.cover-option.active').dataset.cover;
        
        if (selectedCover === 'custom') {
            const customCover = this.currentNotebook?.customCover;
            if (customCover) {
                this.updateCover('custom', customCover);
                this.showNotification('Capa personalizada aplicada!');
            } else {
                this.showNotification('Selecione uma imagem primeiro', 'warning');
                return;
            }
        } else {
            this.updateCover('default.jpg', null);
            this.showNotification('Capa padrão aplicada!');
        }
        
        document.getElementById('coverModal').classList.remove('active');
    }

    handleCoverUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            this.showNotification('Selecione um arquivo de imagem válido', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('previewCover');
            preview.src = e.target.result;
            document.getElementById('coverPreview').style.display = 'block';
            
            // Atualizar capa atual
            if (this.currentNotebook) {
                this.currentNotebook.customCover = e.target.result;
                this.updateCover('custom', e.target.result);
            }
        };
        reader.readAsDataURL(file);
    }

    updateCharCount() {
        const editor = document.getElementById('editor');
        const text = editor.textContent;
        const charCount = text.length;
        document.getElementById('charCount').textContent = `${charCount.toLocaleString()} caracteres`;
        document.getElementById('totalChars').textContent = `${charCount.toLocaleString()} caracteres`;
    }

    updateWordCount() {
        const editor = document.getElementById('editor');
        const text = editor.textContent.trim();
        const wordCount = text === '' ? 0 : text.split(/\s+/).length;
        document.getElementById('wordCount').textContent = `${wordCount.toLocaleString()} palavras`;
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
        this.clearSheetCustomization();
        this.updateCharCount();
        this.updateWordCount();
        this.updateImageCount();
    }

    clearSheetCustomization() {
        const editor = document.getElementById('editor');
        editor.style.backgroundImage = 'none';
        editor.style.backgroundColor = 'white';
        editor.style.backgroundBlur = 'none';
        editor.style.opacity = '1';
        editor.style.filter = 'none';
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
                return diffMins < 1 ? 'Agora mesmo' : `${diffMins} min atrás`;
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    moveCursorToEnd(element) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
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
        
        this.unsavedChanges = true;
        this.checkUnsavedChanges();
    }

    ignoreCurrentWord() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const selectedText = range.toString().trim();
        
        if (!selectedText) {
            // Se nada está selecionado, selecionar a palavra atual
            const editor = document.getElementById('editor');
            const wordRange = this.getWordRange(range);
            if (wordRange) {
                const word = wordRange.toString();
                if (word) {
                    this.ignoredWords.add(word.toLowerCase());
                    this.showNotification(`Palavra "${word}" ignorada`, 'info');
                    
                    // Adicionar classe para esconder underline vermelho
                    const span = document.createElement('span');
                    span.className = 'ignored-word';
                    span.textContent = word;
                    wordRange.deleteContents();
                    wordRange.insertNode(span);
                    
                    this.saveData();
                }
            }
        } else {
            // Ignorar texto selecionado
            this.ignoredWords.add(selectedText.toLowerCase());
            this.showNotification(`Palavra "${selectedText}" ignorada`, 'info');
            
            // Adicionar classe para esconder underline vermelho
            const span = document.createElement('span');
            span.className = 'ignored-word';
            span.textContent = selectedText;
            range.deleteContents();
            range.insertNode(span);
            
            this.saveData();
        }
    }

    getWordRange(range) {
        if (!range.collapsed) return range;
        
        const editor = document.getElementById('editor');
        const text = editor.textContent;
        const startOffset = range.startOffset;
        const container = range.startContainer;
        
        if (container.nodeType !== Node.TEXT_NODE) return null;
        
        let start = startOffset;
        let end = startOffset;
        
        // Encontrar início da palavra
        while (start > 0 && !/\s/.test(text[start - 1])) {
            start--;
        }
        
        // Encontrar fim da palavra
        while (end < text.length && !/\s/.test(text[end])) {
            end++;
        }
        
        if (start < end) {
            const wordRange = document.createRange();
            wordRange.setStart(container, start);
            wordRange.setEnd(container, end);
            return wordRange;
        }
        
        return null;
    }

    // ========== PERSONALIZAÇÃO DE FOLHA ==========

    showCustomizeSheetModal() {
        if (!this.currentSheet) {
            this.showNotification('Selecione uma folha primeiro', 'error');
            return;
        }
        
        const modal = document.getElementById('customizeSheetModal');
        modal.classList.add('active');
        
        // Carregar configurações atuais
        const customization = this.currentSheet.customization || {
            backgroundImage: null,
            backgroundOpacity: 0.1,
            backgroundBlur: 0
        };
        
        // Atualizar opções
        const bgOptions = document.querySelectorAll('.bg-option');
        bgOptions.forEach(option => {
            option.classList.remove('active');
            if (customization.backgroundImage) {
                if (option.dataset.bg === 'custom') {
                    option.classList.add('active');
                }
            } else if (option.dataset.bg === 'none') {
                option.classList.add('active');
            }
        });
        
        // Atualizar sliders
        document.getElementById('bgOpacity').value = customization.backgroundOpacity || 0.1;
        document.getElementById('bgBlur').value = customization.backgroundBlur || 0;
        
        this.updateSliderValues();
        this.updatePreview();
    }

    updateSliderValues() {
        const opacityValue = document.getElementById('bgOpacity').value;
        const blurValue = document.getElementById('bgBlur').value;
        
        document.getElementById('opacityValue').textContent = `${Math.round(opacityValue * 100)}%`;
        document.getElementById('blurValue').textContent = `${blurValue}px`;
        
        // Atualizar preview
        this.updatePreview();
    }

    updatePreview() {
        const previewArea = document.getElementById('bgPreviewArea');
        const opacity = document.getElementById('bgOpacity').value;
        const blur = document.getElementById('bgBlur').value;
        const activeBg = document.querySelector('.bg-option.active').dataset.bg;
        
        previewArea.style.backgroundImage = 'none';
        previewArea.style.backgroundColor = 'white';
        
        if (activeBg === 'custom' && this.currentCustomization.backgroundImage) {
            previewArea.style.backgroundImage = `url("${this.currentCustomization.backgroundImage}")`;
            previewArea.style.backgroundSize = 'cover';
            previewArea.style.backgroundPosition = 'center';
        }
        
        previewArea.style.opacity = opacity;
        
        if (blur > 0) {
            previewArea.style.filter = `blur(${blur}px)`;
        } else {
            previewArea.style.filter = 'none';
        }
    }

    handleBackgroundUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            this.showNotification('Selecione um arquivo de imagem válido', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentCustomization.backgroundImage = e.target.result;
            this.updatePreview();
        };
        reader.readAsDataURL(file);
    }

    applySheetCustomization(customization) {
        if (!customization) return;
        
        const editor = document.getElementById('editor');
        
        if (customization.backgroundImage) {
            editor.style.backgroundImage = `url("${customization.backgroundImage}")`;
            editor.style.backgroundSize = customization.backgroundSize || 'cover';
            editor.style.backgroundPosition = customization.backgroundPosition || 'center';
            editor.style.backgroundRepeat = 'no-repeat';
        } else {
            editor.style.backgroundImage = 'none';
            editor.style.backgroundColor = 'white';
        }
        
        editor.style.opacity = customization.backgroundOpacity || 1;
        
        if (customization.backgroundBlur > 0) {
            editor.style.filter = `blur(${customization.backgroundBlur}px)`;
        } else {
            editor.style.filter = 'none';
        }
    }

    saveCustomization() {
        if (!this.currentSheet) return;
        
        const customization = {
            backgroundImage: this.currentCustomization.backgroundImage,
            backgroundOpacity: parseFloat(document.getElementById('bgOpacity').value),
            backgroundBlur: parseInt(document.getElementById('bgBlur').value),
            backgroundSize: 'cover',
            backgroundPosition: 'center'
        };
        
        this.currentSheet.customization = customization;
        this.applySheetCustomization(customization);
        
        this.saveData();
        this.showNotification('Folha personalizada!', 'success');
        document.getElementById('customizeSheetModal').classList.remove('active');
    }

    // ========== CONFIGURAÇÕES DE FONTE ==========

    showFontSettingsModal() {
        if (!this.currentSheet) {
            this.showNotification('Selecione uma folha primeiro', 'error');
            return;
        }
        
        const modal = document.getElementById('fontSettingsModal');
        modal.classList.add('active');
        
        // Carregar configurações atuais
        const settings = this.currentSheet.fontSettings || this.fontSettings;
        
        document.getElementById('fontFamily').value = settings.fontFamily;
        document.getElementById('fontSize').value = settings.fontSize;
        document.getElementById('lineHeight').value = settings.lineHeight;
        document.getElementById('letterSpacing').value = settings.letterSpacing;
        
        this.updateFontPreview();
    }

    updateFontPreview() {
        const previewArea = document.getElementById('fontPreviewArea');
        const fontFamily = document.getElementById('fontFamily').value;
        const fontSize = document.getElementById('fontSize').value;
        const lineHeight = document.getElementById('lineHeight').value;
        const letterSpacing = document.getElementById('letterSpacing').value;
        
        previewArea.style.fontFamily = fontFamily;
        previewArea.style.fontSize = `${fontSize}px`;
        previewArea.style.lineHeight = lineHeight;
        previewArea.style.letterSpacing = `${letterSpacing}px`;
        
        // Atualizar valores exibidos
        document.getElementById('fontSizeValue').textContent = `${fontSize}px`;
        document.getElementById('lineHeightValue').textContent = lineHeight;
        document.getElementById('letterSpacingValue').textContent = `${letterSpacing}px`;
    }

    applyFontSettings(settings = null) {
        const editor = document.getElementById('editor');
        
        if (settings) {
            this.fontSettings = { ...settings };
        } else {
            this.fontSettings = {
                fontFamily: document.getElementById('fontFamily').value,
                fontSize: parseInt(document.getElementById('fontSize').value),
                lineHeight: parseFloat(document.getElementById('lineHeight').value),
                letterSpacing: parseFloat(document.getElementById('letterSpacing').value)
            };
        }
        
        editor.style.fontFamily = this.fontSettings.fontFamily;
        editor.style.fontSize = `${this.fontSettings.fontSize}px`;
        editor.style.lineHeight = this.fontSettings.lineHeight;
        editor.style.letterSpacing = `${this.fontSettings.letterSpacing}px`;
        
        // Salvar nas configurações da folha atual
        if (this.currentSheet) {
            this.currentSheet.fontSettings = { ...this.fontSettings };
            this.saveData();
        }
        
        if (!settings) {
            this.showNotification('Configurações de fonte aplicadas!', 'success');
            document.getElementById('fontSettingsModal').classList.remove('active');
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
        document.onerror = () => {
            this.showNotification('Não foi possível carregar a imagem da URL', 'error');
            document.getElementById('urlPreview').style.display = 'none';
            document.getElementById('insertImageBtn').disabled = true;
        };
        
        preview.onload = () => {
            document.getElementById('urlPreview').style.display = 'block';
            document.getElementById('insertImageBtn').disabled = false;
        };
        
        preview.onerror = () => {
            this.showNotification('Não foi possível carregar a imagem da URL', 'error');
            document.getElementById('urlPreview').style.display = 'none';
            document.getElementById('insertImageBtn').disabled = true;
        };
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
            // Inserir no cursor
            if (selection.rangeCount) {
                const range = selection.getRangeAt(0);
                range.insertNode(img);
            } else {
                // Inserir no final
                editor.appendChild(img);
            }
        }
        
        // Adicionar parágrafo após a imagem se for o último elemento
        if (editor.lastChild === img) {
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
        this.audio.addEventListener('error', (e) => {
            console.error('Erro no áudio:', e);
            this.showNotification('Erro ao reproduzir música', 'error');
        });
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
                    <p class="upload-hint">Adicione músicas na área de upload</p>
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
        
        // Tentar carregar a música
        this.audio.src = track.url;
        
        this.audio.play().then(() => {
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
            
        }).catch(e => {
            console.error('Erro ao reproduzir:', e);
            
            // Fallback para músicas padrão
            if (track.type === 'default') {
                this.showNotification('Música padrão não disponível offline', 'warning');
            } else {
                this.showNotification('Erro ao reproduzir música', 'error');
            }
        });
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
        if (!this.audio.duration || isNaN(this.audio.duration)) return;
        
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
        if (this.audio.duration && !isNaN(this.audio.duration)) {
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
                
                // Verificar se há uma nova versão
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
        console.log('Configurando eventos...');
        
        // ===== APP =====
        document.getElementById('clearDataBtn').onclick = () => this.clearLocalData();
        
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
            if (!this.currentNotebook) {
                this.showNotification('Selecione um caderno primeiro', 'error');
                return;
            }
            
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
        document.getElementById('boldBtn').addEventListener('click', () => {
            document.execCommand('bold');
            this.unsavedChanges = true;
            this.checkUnsavedChanges();
        });
        document.getElementById('italicBtn').addEventListener('click', () => {
            document.execCommand('italic');
            this.unsavedChanges = true;
            this.checkUnsavedChanges();
        });
        document.getElementById('underlineBtn').addEventListener('click', () => {
            document.execCommand('underline');
            this.unsavedChanges = true;
            this.checkUnsavedChanges();
        });
        document.getElementById('listUlBtn').addEventListener('click', () => {
            document.execCommand('insertUnorderedList');
            this.unsavedChanges = true;
            this.checkUnsavedChanges();
        });
        document.getElementById('listOlBtn').addEventListener('click', () => {
            document.execCommand('insertOrderedList');
            this.unsavedChanges = true;
            this.checkUnsavedChanges();
        });
        document.getElementById('imageBtn').addEventListener('click', () => this.showImageModal());
        document.getElementById('ignoreSpellBtn').addEventListener('click', () => this.ignoreCurrentWord());

        // Contador de caracteres e palavras
        const editor = document.getElementById('editor');
        editor.addEventListener('input', () => {
            this.updateCharCount();
            this.updateWordCount();
            this.updateImageCount();
            this.checkUnsavedChanges();
        });

        // Configurações de fonte
        document.getElementById('fontSettingsBtn').onclick = () => {
            this.showFontSettingsModal();
        };

        // Sliders de fonte
        document.getElementById('fontFamily').addEventListener('change', () => this.updateFontPreview());
        document.getElementById('fontSize').addEventListener('input', () => this.updateFontPreview());
        document.getElementById('lineHeight').addEventListener('input', () => this.updateFontPreview());
        document.getElementById('letterSpacing').addEventListener('input', () => this.updateFontPreview());

        // Aplicar configurações de fonte
        document.getElementById('applyFontBtn').onclick = () => {
            this.applyFontSettings();
        };

        document.getElementById('cancelFontBtn').onclick = () => {
            document.getElementById('fontSettingsModal').classList.remove('active');
        };

        // Capa
        document.getElementById('changeCoverBtn').onclick = () => {
            this.showCoverModal();
        };

        // Capa personalizada
        document.getElementById('coverFile').addEventListener('change', (e) => {
            this.handleCoverUpload(e.target.files[0]);
        });

        document.getElementById('coverUploadArea').addEventListener('click', () => {
            document.getElementById('coverFile').click();
        });

        // Personalizar folha
        document.getElementById('customizeSheetBtn').onclick = () => {
            this.showCustomizeSheetModal();
        };

        // Sliders de personalização
        document.getElementById('bgOpacity').addEventListener('input', () => {
            this.updateSliderValues();
        });

        document.getElementById('bgBlur').addEventListener('input', () => {
            this.updateSliderValues();
        });

        // Opções de fundo
        document.querySelectorAll('.bg-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.bg-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');
                
                if (option.dataset.bg === 'custom') {
                    document.getElementById('bgImageUpload').click();
                } else {
                    this.currentCustomization.backgroundImage = null;
                    this.updatePreview();
                }
            });
        });

        // Upload de imagem de fundo
        document.getElementById('bgImageUpload').addEventListener('change', (e) => {
            this.handleBackgroundUpload(e.target.files[0]);
        });

        // Aplicar personalização
        document.getElementById('applyCustomizeBtn').onclick = () => {
            this.saveCustomization();
        };

        document.getElementById('cancelCustomizeBtn').onclick = () => {
            document.getElementById('customizeSheetModal').classList.remove('active');
        };

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

        // ===== CAPA =====
        document.getElementById('cancelCoverBtn').onclick = () => {
            document.getElementById('coverModal').classList.remove('active');
        };
        
        document.getElementById('applyCoverBtn').onclick = () => {
            this.applyCover();
        };
        
        // Opções de capa
        document.querySelectorAll('.cover-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.cover-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');
                
                const customUpload = document.getElementById('coverCustomUpload');
                if (option.dataset.cover === 'custom') {
                    customUpload.style.display = 'block';
                } else {
                    customUpload.style.display = 'none';
                }
            });
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
        const mainSidebar = document.getElementById('mainSidebar');
        const sheetsSidebar = document.getElementById('sheetsSidebar');
        const mobileOverlay = document.getElementById('mobileOverlay');
        
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (window.innerWidth <= 992) {
                if (!mainSidebar.classList.contains('active') && !sheetsSidebar.classList.contains('active')) {
                    mainSidebar.classList.add('active');
                    mobileOverlay.classList.add('active');
                } else if (mainSidebar.classList.contains('active')) {
                    mainSidebar.classList.remove('active');
                    sheetsSidebar.classList.add('active');
                } else {
                    sheetsSidebar.classList.remove('active');
                    mobileOverlay.classList.remove('active');
                }
            }
        });

        // Fechar sidebars ao clicar fora (mobile)
        mobileOverlay.addEventListener('click', () => {
            mainSidebar.classList.remove('active');
            sheetsSidebar.classList.remove('active');
            mobileOverlay.classList.remove('active');
        });

        // Swipe para fechar sidebars
        let touchStartX = 0;
        let touchStartY = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (!mainSidebar.classList.contains('active') && !sheetsSidebar.classList.contains('active')) {
                return;
            }
            
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const diffX = touchX - touchStartX;
            const diffY = Math.abs(touchY - touchStartY);
            
            // Verificar se é um swipe horizontal (não vertical)
            if (Math.abs(diffX) > 50 && diffY < 50) {
                if (diffX > 0 && mainSidebar.classList.contains('active')) {
                    // Swipe para direita com sidebar aberta - fechar
                    mainSidebar.classList.remove('active');
                    mobileOverlay.classList.remove('active');
                } else if (diffX > 0 && sheetsSidebar.classList.contains('active')) {
                    // Swipe para direita com sheets sidebar aberta - voltar para main sidebar
                    sheetsSidebar.classList.remove('active');
                    mainSidebar.classList.add('active');
                }
            }
        }, { passive: true });

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
                document.getElementById('customizeSheetModal').classList.remove('active');
                document.getElementById('fontSettingsModal').classList.remove('active');
                document.getElementById('coverModal').classList.remove('active');
                document.getElementById('installInstructionsModal').classList.remove('active');
                
                // Fechar música se visível
                if (this.isMusicVisible) {
                    this.toggleMusicSidebar();
                }
                
                // Fechar sidebars mobile
                if (window.innerWidth <= 992) {
                    mainSidebar.classList.remove('active');
                    sheetsSidebar.classList.remove('active');
                    mobileOverlay.classList.remove('active');
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
                this.unsavedChanges = true;
                this.checkUnsavedChanges();
            }
            
            // Ctrl+I para itálico
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                document.execCommand('italic');
                this.unsavedChanges = true;
                this.checkUnsavedChanges();
            }
            
            // Ctrl+U para sublinhado
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                document.execCommand('underline');
                this.unsavedChanges = true;
                this.checkUnsavedChanges();
            }
            
            // Ctrl+Shift+I para imagem
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
                e.preventDefault();
                this.showImageModal();
            }
            
            // Ctrl+Space para play/pause música
            if (e.ctrlKey && e.key === ' ') {
                e.preventDefault();
                this.playPause();
            }
            
            // Ctrl+P para parágrafo
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                this.formatParagraph();
            }
            
            // Ctrl+Shift+I para ignorar palavra
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
                e.preventDefault();
                this.ignoreCurrentWord();
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
                    if (modal.id === 'customizeSheetModal') {
                        this.currentCustomization = {
                            backgroundImage: null,
                            backgroundOpacity: 0.1,
                            backgroundBlur: 0
                        };
                    }
                }
            });
        });

        // Salvar ao sair da página
        this.setupBeforeUnload();

        // Atualizar status da música quando houver erro
        this.audio.addEventListener('error', () => {
            this.showNotification('Erro ao carregar a música. Verifique o arquivo.', 'error');
            document.getElementById('musicStatusText').textContent = 'Erro';
            document.querySelector('#musicStatus i').style.color = 'var(--danger-color)';
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
            
            if (!isScrollable && element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA' && element.contentEditable !== 'true') {
                e.preventDefault();
            }
        }, {passive: false});
        
        // ===== LOADING SCREEN FALLBACK =====
        // Garantir que o loading some após um tempo máximo
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen && loadingScreen.style.display === 'flex') {
                console.log('Timeout do loading screen, forçando entrada no app');
                loadingScreen.classList.add('fade-out');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                    this.enterApp();
                }, 500);
            }
        }, 8000); // 8 segundos de timeout
        
        // ===== AJUSTES PARA MOBILE =====
        // Melhorar foco no editor em mobile
        editor.addEventListener('touchstart', () => {
            if (document.activeElement !== editor) {
                editor.focus();
            }
        }, { passive: true });
        
        // Prevenir zoom no foco do editor
        editor.addEventListener('focus', () => {
            setTimeout(() => {
                document.body.style.zoom = '100%';
            }, 100);
        });
    }
    
    setupBeforeUnload() {
        window.addEventListener('beforeunload', (e) => {
            if (this.currentSheet && this.unsavedChanges) {
                this.saveCurrentContent();
                this.saveData();
                
                // Em alguns navegadores, podemos mostrar um alerta
                e.preventDefault();
                e.returnValue = 'Você tem alterações não salvas. Tem certeza que deseja sair?';
            }
            
            // Salvar configurações de música
            this.saveMusicSettings();
        });
    }
    
    setupIntervals() {
        // Auto-save a cada 30 segundos
        setInterval(() => this.autoSave(), 30000);
        
        // Verificar modificações não salvas
        setInterval(() => this.checkUnsavedChanges(), 5000);
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
    }, 100);
});