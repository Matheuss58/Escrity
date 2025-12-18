class EscrityApp {
    constructor() {
        this.currentNotebook = null;
        this.currentSheet = null;
        this.notebooks = [];
        this.deferredPrompt = null;
        this.editingNotebookId = null;
        this.unsavedChanges = false;
        this.currentTextColor = '#2c3e50';
        
        // Música
        this.isMusicVisible = false;
        this.currentTrack = null;
        this.isPlaying = false;
        this.tracks = [];
        
        // Personalização
        this.currentCustomization = {
            backgroundType: 'none',
            backgroundColor: '#ffffff',
            backgroundImage: null,
            pageTone: '#ffffff',
            marginSize: 'normal'
        };
        
        // Configurações de fonte
        this.fontSettings = {
            fontFamily: "'Inter', sans-serif",
            fontSize: 18,
            lineHeight: 1.6
        };
        
        this.audio = document.getElementById('audioPlayer');
        this.audio.volume = 0.5;
        
        this.init();
    }

    async init() {
        console.log('ESCRITY: Inicializando guardião de histórias...');
        
        // Mostrar loading
        document.getElementById('loadingScreen').style.display = 'flex';
        
        // Configurar eventos
        this.setupEventListeners();
        
        // Configurar service worker
        await this.setupServiceWorker();
        this.setupInstallPrompt();
        
        // Configurar áudio
        this.setupAudioEvents();
        
        // Carregar configurações
        this.loadSettings();
        
        // Carregar dados
        await this.loadData();
        
        // Iniciar app
        setTimeout(() => {
            document.getElementById('loadingScreen').classList.add('fade-out');
            setTimeout(() => {
                document.getElementById('loadingScreen').style.display = 'none';
                this.enterApp();
            }, 500);
        }, 1000);
    }

    enterApp() {
        console.log('ESCRITY: Entrando no espaço de criação...');
        
        try {
            // Atualizar interface
            document.getElementById('currentUsername').textContent = 'Escritor Local';
            
            // Mostrar app
            document.getElementById('app-container').style.display = 'flex';
            
            // Renderizar notebooks
            this.renderNotebooks();
            
            // Selecionar ou criar caderno padrão
            if (this.notebooks.length > 0) {
                this.selectNotebook(this.notebooks[0].id);
            } else {
                this.createDefaultNotebook();
            }
            
            // Notificação inicial
            this.showNotification('Bem-vindo ao ESCRITY', 'Seu espaço seguro para histórias está pronto.', 'info');
            
            // Configurar intervalos
            this.setupIntervals();
            
            // Configurar salvamento automático
            this.setupAutoSave();
            
        } catch (error) {
            console.error('ESCRITY: Erro ao entrar:', error);
            this.showNotification('Erro', 'Não foi possível carregar seus dados.', 'error');
        }
    }

    async loadData() {
        console.log('ESCRITY: Carregando histórias...');
        
        const localData = localStorage.getItem('escry-data');
        if (localData) {
            try {
                const data = JSON.parse(localData);
                this.notebooks = data.notebooks || [];
                this.fontSettings = data.fontSettings || this.fontSettings;
                this.currentTextColor = data.textColor || '#2c3e50';
                
                console.log(`ESCRITY: ${this.notebooks.length} cadernos carregados`);
            } catch (e) {
                console.error('ESCRITY: Erro ao carregar dados:', e);
                this.notebooks = [];
                this.createDefaultNotebook();
            }
        } else {
            this.notebooks = [];
            this.createDefaultNotebook();
        }
    }

    saveData() {
        console.log('ESCRITY: Guardando histórias...');
        
        try {
            const data = {
                notebooks: this.notebooks,
                fontSettings: this.fontSettings,
                textColor: this.currentTextColor,
                lastSave: new Date().toISOString(),
                version: '3.0'
            };
            
            // Salvar localmente
            localStorage.setItem('escry-data', JSON.stringify(data));
            console.log('ESCRITY: Histórias guardadas com segurança');
            
            this.updateLastSaved();
            this.unsavedChanges = false;
            
            // Atualizar botão de salvar
            const saveBtn = document.getElementById('saveBtn');
            saveBtn.classList.remove('unsaved');
            saveBtn.innerHTML = '<i class="fas fa-save"></i> <span class="save-text">Guardado</span>';
            
            // Criar backup automático
            this.createAutoBackup();
            
            return true;
        } catch (error) {
            console.error('ESCRITY: Erro ao salvar dados:', error);
            this.showNotification('Erro', 'Não foi possível salvar seus dados.', 'error');
            return false;
        }
    }

    createAutoBackup() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const backupId = `backup-auto-${today}-${Date.now()}`;
            
            const backupData = {
                id: backupId,
                app: 'ESCRITY',
                version: '3.0',
                date: new Date().toISOString(),
                notebooks: this.notebooks,
                settings: {
                    fontSettings: this.fontSettings,
                    textColor: this.currentTextColor
                }
            };
            
            // Salvar backup
            localStorage.setItem(`escry-backup-${backupId}`, JSON.stringify(backupData));
            
            // Manter apenas últimos 30 backups
            this.cleanOldBackups();
            
            return true;
        } catch (error) {
            console.error('ESCRITY: Erro ao criar backup automático:', error);
            return false;
        }
    }

    cleanOldBackups() {
        try {
            const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('escry-backup-'));
            
            if (backupKeys.length > 30) {
                // Ordenar por data (mais antigo primeiro)
                backupKeys.sort();
                
                // Remover backups antigos
                const toRemove = backupKeys.slice(0, backupKeys.length - 30);
                toRemove.forEach(key => localStorage.removeItem(key));
            }
        } catch (error) {
            console.error('ESCRITY: Erro ao limpar backups antigos:', error);
        }
    }

    clearLocalData() {
        this.showConfirm(
            'Limpar tudo',
            'Tem certeza? Todas as suas histórias serão perdidas permanentemente.',
            () => {
                localStorage.removeItem('escry-data');
                
                // Remover backups, manter música
                const keysToRemove = Object.keys(localStorage).filter(key => 
                    key.startsWith('escry-backup-')
                );
                keysToRemove.forEach(key => localStorage.removeItem(key));
                
                this.notebooks = [];
                this.currentNotebook = null;
                this.currentSheet = null;
                
                this.renderNotebooks();
                this.clearEditor();
                
                this.showNotification('Limpeza completa', 'Seu espaço está vazio e pronto para novas histórias.', 'info');
                
                // Criar novo caderno padrão
                setTimeout(() => this.createDefaultNotebook(), 1000);
            }
        );
    }

    createDefaultNotebook() {
        const defaultNotebook = {
            id: 'notebook-' + Date.now(),
            name: 'Meu Primeiro Caderno',
            cover: 'default',
            customCover: null,
            color: '#1a1a2e',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            sheets: [{
                id: 'sheet-' + Date.now(),
                title: 'Primeira Página',
                content: '<p class="placeholder">Comece a escrever sua história aqui...</p>',
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                images: [],
                customization: {
                    backgroundType: 'none',
                    backgroundColor: '#ffffff',
                    backgroundImage: null,
                    pageTone: '#ffffff',
                    marginSize: 'normal'
                },
                fontSettings: { ...this.fontSettings }
            }]
        };
        
        this.notebooks.push(defaultNotebook);
        this.saveData();
        this.renderNotebooks();
        this.selectNotebook(defaultNotebook.id);
        
        this.showNotification('Espaço criado', 'Seu primeiro caderno está pronto para histórias.', 'success');
    }

    // ========== GERENCIAMENTO DE CADERNOS ==========

    renderNotebooks() {
        const container = document.getElementById('notebooksList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.notebooks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-book-open"></i>
                    <p>Nenhum caderno</p>
                    <p class="hint">Crie seu primeiro espaço</p>
                </div>
            `;
            document.getElementById('sheetsSection').style.display = 'none';
            return;
        }
        
        this.notebooks.forEach(notebook => {
            const div = document.createElement('div');
            div.className = `notebook-item ${this.currentNotebook?.id === notebook.id ? 'active' : ''}`;
            div.style.borderLeftColor = notebook.color || '#3498db';
            div.style.borderColor = notebook.color || '#3498db';
            
            const sheetCount = notebook.sheets ? notebook.sheets.length : 0;
            const lastUpdated = this.formatDate(notebook.updated);
            
            div.innerHTML = `
                <div class="notebook-content">
                    <h3>${this.escapeHtml(notebook.name)}</h3>
                    <div class="notebook-meta">
                        <span class="sheet-count">${sheetCount} ${sheetCount === 1 ? 'folha' : 'folhas'}</span>
                        <span class="notebook-date">${lastUpdated}</span>
                    </div>
                </div>
                <div class="notebook-actions">
                    <button class="notebook-action-btn edit" data-id="${notebook.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="notebook-action-btn delete" data-id="${notebook.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            div.onclick = (e) => {
                if (!e.target.closest('.notebook-action-btn')) {
                    this.selectNotebook(notebook.id);
                }
            };
            
            const editBtn = div.querySelector('.edit');
            const deleteBtn = div.querySelector('.delete');
            
            if (editBtn) {
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.editNotebook(notebook.id);
                };
            }
            
            if (deleteBtn) {
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.deleteNotebook(notebook.id);
                };
            }
            
            container.appendChild(div);
        });
        
        // Mostrar seção de folhas se houver caderno selecionado
        if (this.currentNotebook) {
            document.getElementById('sheetsSection').style.display = 'block';
            this.renderSheets();
        }
    }

    renderSheets() {
        const container = document.getElementById('sheetsList');
        if (!container) return;
        
        if (!this.currentNotebook || !this.currentNotebook.sheets || this.currentNotebook.sheets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file"></i>
                    <p>Nenhuma folha</p>
                    <p class="hint">Clique no + para criar</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        this.currentNotebook.sheets.forEach((sheet) => {
            const div = document.createElement('div');
            div.className = `sheet-item-compact ${this.currentSheet?.id === sheet.id ? 'active' : ''}`;
            div.innerHTML = `
                <i class="fas fa-file-lines"></i>
                <span class="sheet-title">${this.escapeHtml(sheet.title)}</span>
                <span class="sheet-date-small">${this.formatDate(sheet.updated, true)}</span>
            `;
            
            div.onclick = () => {
                this.selectSheet(sheet.id);
            };
            
            // Adicionar menu de contexto para exclusão
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showSheetContextMenu(e, sheet);
            });
            
            container.appendChild(div);
        });
        
        // Atualizar contador
        const countElement = document.getElementById('currentNotebookCount');
        if (countElement) {
            countElement.textContent = 
                `${this.currentNotebook.sheets.length} ${this.currentNotebook.sheets.length === 1 ? 'folha' : 'folhas'}`;
        }
    }

    showSheetContextMenu(e, sheet) {
        // Remover menus de contexto existentes
        const existingMenus = document.querySelectorAll('.context-menu');
        existingMenus.forEach(menu => menu.remove());
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${e.clientY}px;
            left: ${e.clientX}px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 10000;
            padding: 8px 0;
            min-width: 180px;
        `;
        
        menu.innerHTML = `
            <div class="menu-item" data-action="open">
                <i class="fas fa-folder-open"></i>
                <span>Abrir</span>
            </div>
            <div class="menu-item" data-action="rename">
                <i class="fas fa-edit"></i>
                <span>Renomear</span>
            </div>
            <div class="menu-divider"></div>
            <div class="menu-item danger" data-action="delete">
                <i class="fas fa-trash"></i>
                <span>Excluir</span>
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // Fechar menu ao clicar fora
        const closeMenu = () => {
            if (document.body.contains(menu)) {
                document.body.removeChild(menu);
            }
            document.removeEventListener('click', closeMenu);
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
        
        // Ações do menu
        menu.querySelectorAll('.menu-item').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                
                switch(action) {
                    case 'open':
                        this.selectSheet(sheet.id);
                        break;
                    case 'rename':
                        this.renameSheet(sheet);
                        break;
                    case 'delete':
                        this.deleteSheet(sheet.id);
                        break;
                }
                
                closeMenu();
            };
        });
    }

    selectNotebook(id) {
        // Salvar conteúdo atual antes de trocar
        this.saveCurrentContent();
        
        const notebook = this.notebooks.find(n => n.id === id);
        if (!notebook) return;
        
        this.currentNotebook = notebook;
        
        // Garantir que tenha sheets
        if (!notebook.sheets || notebook.sheets.length === 0) {
            notebook.sheets = [this.createNewSheet('Primeira Página')];
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
        
        // Mostrar seção de folhas
        document.getElementById('sheetsSection').style.display = 'block';
        
        // Fechar menu mobile se estiver aberto
        if (window.innerWidth <= 992) {
            document.getElementById('mainSidebar').classList.remove('active');
            document.getElementById('mobileOverlay').classList.remove('active');
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
        if (editor) {
            editor.innerHTML = sheet.content || '<p class="placeholder">Comece a escrever sua história aqui...</p>';
            
            // Aplicar cor do texto
            editor.style.color = this.currentTextColor;
            
            // Aplicar configurações de fonte
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
        }
        
        // Atualizar contadores
        this.updateCounters();
        
        // Renderizar folhas
        this.renderSheets();
        
        // Focar no editor
        setTimeout(() => {
            if (editor) {
                editor.focus();
                this.moveCursorToEnd(editor);
            }
        }, 100);
    }

    createNotebook(name, color = '#1a1a2e') {
        if (!name || name.trim() === '') {
            this.showNotification('Nome necessário', 'Digite um nome para o caderno.', 'error');
            return;
        }
        
        const id = 'notebook-' + Date.now();
        const newNotebook = {
            id,
            name: name.trim(),
            cover: 'default',
            customCover: null,
            color,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            sheets: [this.createNewSheet('Primeira Página')]
        };
        
        this.notebooks.push(newNotebook);
        this.saveData();
        this.renderNotebooks();
        this.selectNotebook(id);
        
        this.showNotification('Caderno criado', `"${name}" está pronto para histórias.`, 'success');
    }

    createNewSheet(title, template = 'blank') {
        let content = '<p class="placeholder">Comece a escrever sua história aqui...</p>';
        
        switch(template) {
            case 'chapter':
                content = `
                    <h1 style="text-align: center; margin-bottom: 3em;">${title}</h1>
                    <p style="text-indent: 2em;">Era uma vez...</p>
                `;
                break;
            case 'poem':
                content = `
                    <div style="text-align: center; font-style: italic; line-height: 2;">
                        <p>${title}</p>
                        <br>
                        <p>Verso por verso,</p>
                        <p>Palavra por palavra,</p>
                        <p>O poema nasce.</p>
                    </div>
                `;
                break;
            case 'diary':
                content = `
                    <h3 style="color: #7f8c8d; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.5em;">
                        ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </h3>
                    <p style="margin-top: 2em;">Hoje foi um dia...</p>
                `;
                break;
            case 'notes':
                content = `
                    <h3>${title}</h3>
                    <ul>
                        <li>Primeira ideia</li>
                        <li>Segunda ideia</li>
                        <li>Terceira ideia</li>
                    </ul>
                `;
                break;
        }
        
        return {
            id: 'sheet-' + Date.now(),
            title: title || 'Nova Folha',
            content,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            images: [],
            customization: {
                backgroundType: 'none',
                backgroundColor: '#ffffff',
                backgroundImage: null,
                pageTone: '#ffffff',
                marginSize: 'normal'
            },
            fontSettings: { ...this.fontSettings }
        };
    }

    addSheet(title, template = 'blank') {
        if (!this.currentNotebook) {
            this.showNotification('Selecione um caderno', 'Escolha um caderno primeiro.', 'error');
            return;
        }
        
        if (!title || title.trim() === '') {
            this.showNotification('Título necessário', 'Digite um título para a folha.', 'error');
            return;
        }
        
        const newSheet = this.createNewSheet(title.trim(), template);
        this.currentNotebook.sheets.push(newSheet);
        this.currentNotebook.updated = new Date().toISOString();
        
        this.saveData();
        this.renderSheets();
        this.selectSheet(newSheet.id);
        
        this.showNotification('Folha criada', `"${title}" foi adicionada ao caderno.`, 'success');
    }

    renameSheet(sheet) {
        const newTitle = prompt('Novo título da folha:', sheet.title);
        if (newTitle && newTitle.trim() && newTitle !== sheet.title) {
            sheet.title = newTitle.trim();
            sheet.updated = new Date().toISOString();
            
            if (this.currentNotebook) {
                this.currentNotebook.updated = new Date().toISOString();
            }
            
            this.saveData();
            this.renderSheets();
            
            if (this.currentSheet?.id === sheet.id) {
                document.getElementById('currentSheetTitle').textContent = newTitle;
            }
            
            this.showNotification('Folha renomeada', `Agora se chama "${newTitle}".`, 'info');
        }
    }

    deleteSheet(sheetId) {
        if (!this.currentNotebook || !this.currentNotebook.sheets) return;
        
        const sheetIndex = this.currentNotebook.sheets.findIndex(s => s.id === sheetId);
        if (sheetIndex === -1) return;
        
        const sheetTitle = this.currentNotebook.sheets[sheetIndex].title;
        
        // Não permitir deletar a última folha
        if (this.currentNotebook.sheets.length <= 1) {
            this.showNotification('Ação não permitida', 'Um caderno precisa ter pelo menos uma folha.', 'warning');
            return;
        }
        
        this.showConfirm(
            'Excluir folha',
            `Tem certeza que deseja excluir "${sheetTitle}"? Esta ação não pode ser desfeita.`,
            () => {
                this.currentNotebook.sheets.splice(sheetIndex, 1);
                this.currentNotebook.updated = new Date().toISOString();
                
                // Selecionar outra folha
                const nextSheetIndex = Math.min(sheetIndex, this.currentNotebook.sheets.length - 1);
                this.selectSheet(this.currentNotebook.sheets[nextSheetIndex].id);
                
                this.saveData();
                this.renderSheets();
                
                this.showNotification('Folha excluída', `"${sheetTitle}" foi removida permanentemente.`, 'info');
            }
        );
    }

    deleteNotebook(notebookId) {
        const notebook = this.notebooks.find(n => n.id === notebookId);
        if (!notebook) return;
        
        // Não permitir deletar o último caderno
        if (this.notebooks.length <= 1) {
            this.showNotification('Ação não permitida', 'Você precisa ter pelo menos um caderno.', 'warning');
            return;
        }
        
        this.showConfirm(
            'Excluir caderno',
            `Tem certeza que deseja excluir "${notebook.name}"? Todas as ${notebook.sheets?.length || 0} folhas serão perdidas permanentemente.`,
            () => {
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
                    
                    this.showNotification('Caderno excluído', `"${notebookName}" e todas as suas folhas foram removidas.`, 'info');
                }
            }
        );
    }

    editNotebook(notebookId) {
        const notebook = this.notebooks.find(n => n.id === notebookId);
        if (!notebook) return;
        
        const newName = prompt('Novo nome do caderno:', notebook.name);
        if (newName && newName.trim() && newName !== notebook.name) {
            notebook.name = newName.trim();
            notebook.updated = new Date().toISOString();
            
            this.saveData();
            this.renderNotebooks();
            
            if (this.currentNotebook?.id === notebookId) {
                document.getElementById('currentNotebookTitle').textContent = newName;
            }
            
            this.showNotification('Caderno renomeado', `Agora se chama "${newName}".`, 'success');
        }
    }

    // ========== EDITOR E FORMATAÇÃO ==========

    saveContent() {
        if (!this.currentSheet) {
            this.showNotification('Nenhuma folha selecionada', 'Selecione uma folha para salvar.', 'warning');
            return;
        }
        
        const editor = document.getElementById('editor');
        if (!editor) return;
        
        let content = editor.innerHTML;
        
        // Remover placeholder se existir
        if (content.includes('placeholder')) {
            content = content.replace(/placeholder/g, '');
            editor.innerHTML = content;
        }
        
        this.currentSheet.content = content;
        this.currentSheet.updated = new Date().toISOString();
        
        // Salvar configurações de fonte atuais
        this.currentSheet.fontSettings = { ...this.fontSettings };
        
        // Extrair imagens
        this.extractImagesFromContent();
        
        if (this.currentNotebook) {
            this.currentNotebook.updated = new Date().toISOString();
        }
        
        if (this.saveData()) {
            this.showNotification('História guardada', 'Seu progresso foi salvo com segurança.', 'success');
        }
    }

    saveCurrentContent() {
        if (this.currentSheet && document.getElementById('editor')) {
            const content = document.getElementById('editor').innerHTML;
            this.currentSheet.content = content;
            this.currentSheet.updated = new Date().toISOString();
            this.extractImagesFromContent();
            this.currentSheet.fontSettings = { ...this.fontSettings };
            return true;
        }
        return false;
    }

    setupAutoSave() {
        const editor = document.getElementById('editor');
        if (!editor) return;
        
        let saveTimeout;
        
        editor.addEventListener('input', () => {
            this.updateCounters();
            this.checkUnsavedChanges();
            
            // Auto-save após 3 segundos de inatividade
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (this.unsavedChanges && this.currentSheet) {
                    this.saveCurrentContent();
                    this.saveData();
                    console.log('ESCRITY: Auto-save realizado');
                }
            }, 3000);
        });
    }

    updateCounters() {
        const editor = document.getElementById('editor');
        if (!editor) return;
        
        const text = editor.textContent || '';
        
        // Contagem de caracteres
        const charCount = text.length;
        const charCountElement = document.getElementById('charCount');
        if (charCountElement) {
            charCountElement.textContent = `${charCount.toLocaleString()} caracteres`;
        }
        
        // Contagem de palavras
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        const wordCountElement = document.getElementById('wordCount');
        if (wordCountElement) {
            wordCountElement.textContent = wordCount.toLocaleString();
        }
    }

    updateLastSaved() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
        const lastSavedElement = document.getElementById('lastSaved');
        if (lastSavedElement) {
            lastSavedElement.textContent = `Salvo às ${timeStr}`;
        }
    }

    checkUnsavedChanges() {
        if (!this.currentSheet || !document.getElementById('editor')) return;
        
        const currentContent = document.getElementById('editor').innerHTML;
        if (currentContent !== this.currentSheet.content) {
            this.unsavedChanges = true;
            const saveBtn = document.getElementById('saveBtn');
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save"></i> <span class="save-text">Guardar *</span>';
                saveBtn.classList.add('unsaved');
            }
        } else {
            this.unsavedChanges = false;
            const saveBtn = document.getElementById('saveBtn');
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save"></i> <span class="save-text">Guardado</span>';
                saveBtn.classList.remove('unsaved');
            }
        }
    }

    applyFormatting(command, value = null) {
        document.execCommand(command, false, value);
        this.unsavedChanges = true;
        this.checkUnsavedChanges();
        
        // Aplicar cor do texto se for seleção de texto
        if (command === 'foreColor' || command === 'hiliteColor') {
            const editor = document.getElementById('editor');
            if (editor) {
                editor.focus();
            }
        }
    }

    changeTextColor() {
        const colorPicker = document.getElementById('textColorPicker');
        if (!colorPicker) return;
        
        this.currentTextColor = colorPicker.value;
        
        const editor = document.getElementById('editor');
        if (editor) {
            editor.style.color = this.currentTextColor;
        }
        
        this.unsavedChanges = true;
        this.checkUnsavedChanges();
        
        // Salvar preferência
        this.saveData();
    }

    insertImage() {
        const fileInput = document.getElementById('imageFile');
        if (!fileInput) return;
        
        fileInput.click();
        
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.type.startsWith('image/')) {
                this.showNotification('Formato inválido', 'Selecione apenas arquivos de imagem.', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.alt = 'Imagem inserida';
                img.className = 'responsive';
                
                // Inserir no editor
                const editor = document.getElementById('editor');
                if (!editor) return;
                
                const selection = window.getSelection();
                
                if (selection.rangeCount) {
                    const range = selection.getRangeAt(0);
                    range.insertNode(img);
                    
                    // Adicionar parágrafo após a imagem
                    const p = document.createElement('p');
                    range.setStartAfter(img);
                    range.insertNode(p);
                    
                    // Mover cursor para o novo parágrafo
                    range.setStart(p, 0);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                } else {
                    editor.appendChild(img);
                    editor.appendChild(document.createElement('p'));
                }
                
                editor.focus();
                this.unsavedChanges = true;
                this.checkUnsavedChanges();
                
                this.showNotification('Imagem adicionada', 'A imagem foi inserida em sua história.', 'success');
            };
            
            reader.readAsDataURL(file);
        };
    }

    insertDivider() {
        const hr = document.createElement('hr');
        
        const editor = document.getElementById('editor');
        if (!editor) return;
        
        const selection = window.getSelection();
        
        if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            range.insertNode(hr);
            
            // Adicionar parágrafo após o divisor
            const p = document.createElement('p');
            range.setStartAfter(hr);
            range.insertNode(p);
            
            // Mover cursor para o novo parágrafo
            range.setStart(p, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            editor.appendChild(hr);
            editor.appendChild(document.createElement('p'));
        }
        
        editor.focus();
        this.unsavedChanges = true;
        this.checkUnsavedChanges();
    }

    insertQuote() {
        const blockquote = document.createElement('blockquote');
        blockquote.innerHTML = '<p>Sua citação aqui...</p>';
        
        const editor = document.getElementById('editor');
        if (!editor) return;
        
        const selection = window.getSelection();
        
        if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            range.insertNode(blockquote);
            
            // Adicionar parágrafo após a citação
            const p = document.createElement('p');
            range.setStartAfter(blockquote);
            range.insertNode(p);
            
            // Mover cursor para o novo parágrafo
            range.setStart(p, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            editor.appendChild(blockquote);
            editor.appendChild(document.createElement('p'));
        }
        
        editor.focus();
        this.unsavedChanges = true;
        this.checkUnsavedChanges();
    }

    extractImagesFromContent() {
        if (!this.currentSheet) return;
        
        const editor = document.getElementById('editor');
        if (!editor) return;
        
        const images = editor.querySelectorAll('img');
        const imageData = [];
        
        images.forEach(img => {
            // Para imagens base64
            if (img.src.startsWith('data:')) {
                imageData.push({
                    src: img.src,
                    alt: img.alt || '',
                    class: img.className || ''
                });
            }
        });
        
        this.currentSheet.images = imageData;
    }

    clearEditor() {
        const notebookTitle = document.getElementById('currentNotebookTitle');
        const sheetTitle = document.getElementById('currentSheetTitle');
        const sheetDate = document.getElementById('sheetDate');
        const editor = document.getElementById('editor');
        const notebookCount = document.getElementById('currentNotebookCount');
        
        if (notebookTitle) notebookTitle.textContent = 'Selecione um caderno';
        if (sheetTitle) sheetTitle.textContent = 'Nenhuma folha selecionada';
        if (sheetDate) sheetDate.textContent = '';
        if (editor) editor.innerHTML = '<p class="placeholder">Selecione uma folha para começar a escrever...</p>';
        if (notebookCount) notebookCount.textContent = '0 folhas';
        
        this.clearSheetCustomization();
        this.updateCounters();
    }

    // ========== PERSONALIZAÇÃO ==========

    showCustomizeSheetModal() {
        if (!this.currentSheet) {
            this.showNotification('Selecione uma folha', 'Escolha uma folha para personalizar.', 'warning');
            return;
        }
        
        const modal = document.getElementById('customizeSheetModal');
        if (!modal) return;
        
        modal.classList.add('active');
        
        // Carregar configurações atuais
        const customization = this.currentSheet.customization || this.currentCustomization;
        
        // Selecionar opções atuais
        document.querySelectorAll('.bg-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.bg === customization.backgroundType) {
                option.classList.add('active');
            }
        });
        
        document.querySelectorAll('.color-tone').forEach(tone => {
            tone.classList.remove('active');
            if (tone.dataset.tone === customization.pageTone) {
                tone.classList.add('active');
            }
        });
        
        document.querySelectorAll('.margin-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.margin === customization.marginSize) {
                option.classList.add('active');
            }
        });
    }

    applySheetCustomization(customization) {
        const editor = document.getElementById('editor');
        if (!editor) return;
        
        // Resetar estilos primeiro
        editor.style.background = 'none';
        editor.style.backgroundColor = '#ffffff';
        editor.style.backgroundImage = 'none';
        editor.style.padding = '3rem';
        
        // Aplicar fundo
        if (customization.backgroundType === 'paper') {
            editor.style.background = 'var(--bg-paper)';
            editor.style.backgroundImage = `
                linear-gradient(90deg, transparent 79px, #abced4 79px, #abced4 81px, transparent 81px),
                linear-gradient(#eee .1em, transparent .1em)
            `;
            editor.style.backgroundSize = '100% 1.2em';
        } else if (customization.backgroundType === 'dark') {
            editor.style.background = 'var(--bg-night)';
            editor.style.backgroundImage = 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)';
            editor.style.backgroundSize = '20px 20px';
        } else if (customization.backgroundType === 'custom' && customization.backgroundImage) {
            editor.style.backgroundImage = `url("${customization.backgroundImage}")`;
            editor.style.backgroundSize = 'cover';
            editor.style.backgroundPosition = 'center';
            editor.style.backgroundColor = 'transparent';
        }
        
        // Aplicar tom da página se não for fundo customizado
        if (customization.backgroundType !== 'custom') {
            editor.style.backgroundColor = customization.pageTone;
        }
        
        // Aplicar margens
        switch(customization.marginSize) {
            case 'wide':
                editor.style.padding = '4rem';
                break;
            case 'normal':
                editor.style.padding = '3rem';
                break;
            case 'narrow':
                editor.style.padding = '2rem';
                break;
            case 'full':
                editor.style.padding = '1rem';
                break;
        }
    }

    clearSheetCustomization() {
        const editor = document.getElementById('editor');
        if (!editor) return;
        
        editor.style.background = 'none';
        editor.style.backgroundColor = '#ffffff';
        editor.style.backgroundImage = 'none';
        editor.style.padding = '3rem';
    }

    saveCustomization() {
        if (!this.currentSheet) return;
        
        const backgroundType = document.querySelector('.bg-option.active')?.dataset.bg || 'none';
        const pageTone = document.querySelector('.color-tone.active')?.dataset.tone || '#ffffff';
        const marginSize = document.querySelector('.margin-option.active')?.dataset.margin || 'normal';
        
        const customization = {
            backgroundType,
            backgroundColor: '#ffffff',
            backgroundImage: backgroundType === 'custom' ? this.currentCustomization.backgroundImage : null,
            pageTone,
            marginSize
        };
        
        this.currentSheet.customization = customization;
        this.applySheetCustomization(customization);
        
        this.saveData();
        
        const modal = document.getElementById('customizeSheetModal');
        if (modal) {
            modal.classList.remove('active');
        }
        
        this.showNotification('Ambiente configurado', 'Sua página foi personalizada.', 'success');
    }

    handleBackgroundUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            this.showNotification('Formato inválido', 'Selecione apenas arquivos de imagem.', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentCustomization.backgroundImage = e.target.result;
            
            // Atualizar visualização
            const customOption = document.querySelector('.bg-option[data-bg="custom"] .bg-preview');
            if (customOption) {
                customOption.style.backgroundImage = `url("${e.target.result}")`;
                customOption.style.backgroundSize = 'cover';
                customOption.innerHTML = '';
            }
        };
        reader.readAsDataURL(file);
    }

    // ========== CONFIGURAÇÕES DE FONTE ==========

    showFontSettingsModal() {
        if (!this.currentSheet) {
            this.showNotification('Selecione uma folha', 'Escolha uma folha para configurar.', 'warning');
            return;
        }
        
        const modal = document.getElementById('fontSettingsModal');
        if (!modal) return;
        
        modal.classList.add('active');
        
        // Carregar configurações atuais
        const settings = this.currentSheet.fontSettings || this.fontSettings;
        
        // Selecionar fonte atual
        document.querySelectorAll('.font-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.font === settings.fontFamily) {
                option.classList.add('active');
            }
        });
        
        // Atualizar sliders
        const fontSizeInput = document.getElementById('fontSize');
        const lineHeightInput = document.getElementById('lineHeight');
        
        if (fontSizeInput) fontSizeInput.value = settings.fontSize;
        if (lineHeightInput) lineHeightInput.value = settings.lineHeight;
        
        this.updateFontPreview();
    }

    updateFontPreview() {
        const previewArea = document.getElementById('fontPreviewArea');
        const activeFont = document.querySelector('.font-option.active');
        const fontSizeInput = document.getElementById('fontSize');
        const lineHeightInput = document.getElementById('lineHeight');
        
        if (!previewArea || !activeFont || !fontSizeInput || !lineHeightInput) return;
        
        const fontFamily = activeFont.dataset.font;
        const fontSize = fontSizeInput.value;
        const lineHeight = lineHeightInput.value;
        
        previewArea.style.fontFamily = fontFamily;
        previewArea.style.fontSize = `${fontSize}px`;
        previewArea.style.lineHeight = lineHeight;
        
        // Atualizar valores exibidos
        const fontSizeValue = document.getElementById('fontSizeValue');
        const lineHeightValue = document.getElementById('lineHeightValue');
        
        if (fontSizeValue) fontSizeValue.textContent = `${fontSize}px`;
        if (lineHeightValue) lineHeightValue.textContent = lineHeight;
    }

    applyFontSettings() {
        const activeFont = document.querySelector('.font-option.active');
        const fontSizeInput = document.getElementById('fontSize');
        const lineHeightInput = document.getElementById('lineHeight');
        
        if (!activeFont || !fontSizeInput || !lineHeightInput) return;
        
        const fontFamily = activeFont.dataset.font;
        const fontSize = parseInt(fontSizeInput.value);
        const lineHeight = parseFloat(lineHeightInput.value);
        
        this.fontSettings = {
            fontFamily,
            fontSize,
            lineHeight
        };
        
        // Aplicar ao editor
        const editor = document.getElementById('editor');
        if (editor) {
            editor.style.fontFamily = fontFamily;
            editor.style.fontSize = `${fontSize}px`;
            editor.style.lineHeight = lineHeight;
        }
        
        // Salvar na folha atual
        if (this.currentSheet) {
            this.currentSheet.fontSettings = { ...this.fontSettings };
            this.saveData();
        }
        
        const modal = document.getElementById('fontSettingsModal');
        if (modal) {
            modal.classList.remove('active');
        }
        
        this.showNotification('Escrita configurada', 'Seu estilo de escrita foi aplicado.', 'success');
    }

    // ========== MÚSICA ==========

    setupAudioEvents() {
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => {
            const durationElement = document.getElementById('duration');
            if (durationElement) {
                durationElement.textContent = this.formatTime(this.audio.duration);
            }
        });
        this.audio.addEventListener('ended', () => this.playNextTrack());
        this.audio.addEventListener('play', () => this.updatePlayState(true));
        this.audio.addEventListener('pause', () => this.updatePlayState(false));
        this.audio.addEventListener('error', () => {
            this.showNotification('Erro de áudio', 'Não foi possível reproduzir a música.', 'error');
        });
    }

    playTrack(track) {
        if (!track || !track.url) return;
        
        this.currentTrack = track;
        
        // Carregar a música
        this.audio.src = track.url;
        
        this.audio.play().then(() => {
            // Atualizar UI
            const trackTitle = document.getElementById('currentTrackTitle');
            const trackArtist = document.getElementById('currentTrackArtist');
            const playBtn = document.getElementById('playPause');
            const musicStatusText = document.getElementById('musicStatusText');
            const musicIcon = document.querySelector('#musicStatus i');
            
            if (trackTitle) trackTitle.textContent = track.title;
            if (trackArtist) trackArtist.textContent = track.artist || 'Importado';
            if (playBtn) playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            if (musicStatusText) musicStatusText.textContent = 'Tocando';
            if (musicIcon) musicIcon.style.color = '#9b59b6';
            
            this.isPlaying = true;
            
            // Atualizar estado da faixa
            this.updateTrackStates();
            
        }).catch(e => {
            console.error('ESCRITY: Erro ao reproduzir:', e);
            this.showNotification('Erro de reprodução', 'Não foi possível tocar a música.', 'error');
        });
    }

    updatePlayState(playing) {
        this.isPlaying = playing;
        const playBtn = document.getElementById('playPause');
        const musicStatusText = document.getElementById('musicStatusText');
        const musicIcon = document.querySelector('#musicStatus i');
        
        if (playing) {
            if (playBtn) {
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                playBtn.title = 'Pausar';
            }
            if (musicStatusText) musicStatusText.textContent = 'Tocando';
            if (musicIcon) musicIcon.style.color = '#9b59b6';
        } else {
            if (playBtn) {
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
                playBtn.title = 'Reproduzir';
            }
            if (musicStatusText) musicStatusText.textContent = 'Pausado';
            if (musicIcon) musicIcon.style.color = '';
        }
    }

    playPause() {
        if (!this.currentTrack && this.tracks.length > 0) {
            // Tocar a primeira trilha
            this.playTrack(this.tracks[0]);
            return;
        }
        
        if (this.isPlaying) {
            this.audio.pause();
        } else {
            this.audio.play().catch(e => {
                console.error('ESCRITY: Erro ao retomar:', e);
            });
        }
    }

    playNextTrack() {
        if (this.tracks.length === 0) return;
        
        const currentIndex = this.tracks.findIndex(t => t.id === this.currentTrack?.id);
        const nextIndex = (currentIndex + 1) % this.tracks.length;
        
        if (this.tracks[nextIndex]) {
            this.playTrack(this.tracks[nextIndex]);
        }
    }

    playPrevTrack() {
        if (this.tracks.length === 0) return;
        
        const currentIndex = this.tracks.findIndex(t => t.id === this.currentTrack?.id);
        const prevIndex = currentIndex <= 0 ? this.tracks.length - 1 : currentIndex - 1;
        
        if (this.tracks[prevIndex]) {
            this.playTrack(this.tracks[prevIndex]);
        }
    }

    updateProgress() {
        if (!this.audio.duration || isNaN(this.audio.duration)) return;
        
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        const progressFill = document.getElementById('progressFill');
        const currentTime = document.getElementById('currentTime');
        
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (currentTime) currentTime.textContent = this.formatTime(this.audio.currentTime);
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updateTrackStates() {
        document.querySelectorAll('.track-item-library').forEach(item => {
            item.classList.remove('playing');
        });
        
        if (this.currentTrack) {
            const currentItem = document.querySelector(`.track-item-library[data-id="${this.currentTrack.id}"]`);
            if (currentItem) {
                currentItem.classList.add('playing');
            }
        }
    }

    updateVolume(e) {
        const volumeBar = document.getElementById('volumeBar');
        if (!volumeBar) return;
        
        const rect = volumeBar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        
        this.audio.volume = percentage;
        const volumeFill = document.getElementById('volumeFill');
        if (volumeFill) {
            volumeFill.style.width = `${percentage * 100}%`;
        }
        
        // Salvar preferência
        this.saveMusicSettings();
    }

    updateProgressBar(e) {
        const progressBar = document.getElementById('progressBar');
        if (!progressBar) return;
        
        const rect = progressBar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        
        if (this.audio.duration && !isNaN(this.audio.duration)) {
            this.audio.currentTime = percentage * this.audio.duration;
        }
    }

    handleMusicUpload(files) {
        if (!files || files.length === 0) return;
        
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('audio/')) {
                this.showNotification('Formato inválido', 'Apenas arquivos de áudio são permitidos.', 'error');
                return;
            }
            
            if (file.size > 50 * 1024 * 1024) {
                this.showNotification('Arquivo grande', 'O arquivo é muito grande (máximo 50MB).', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const track = {
                    id: 'track-' + Date.now() + Math.random().toString(36).substr(2, 9),
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    artist: 'Importado',
                    duration: '--:--',
                    url: e.target.result,
                    type: 'audio'
                };
                
                this.tracks.push(track);
                this.saveMusicSettings();
                this.renderUploadedTracks();
                
                this.showNotification('Música importada', `"${file.name}" foi adicionada à sua biblioteca.`, 'success');
            };
            reader.readAsDataURL(file);
        });
    }

    renderUploadedTracks() {
        const container = document.getElementById('uploadedTracksList');
        if (!container) return;
        
        if (this.tracks.length === 0) {
            container.innerHTML = `
                <div class="empty-state" id="emptyTracksState">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>Nenhuma música importada</p>
                    <p class="hint">Importe suas músicas para criar atmosfera</p>
                </div>
            `;
            const trackCount = document.getElementById('trackCount');
            if (trackCount) trackCount.textContent = '0 músicas';
            return;
        }
        
        container.innerHTML = '';
        
        this.tracks.forEach((track, index) => {
            const div = document.createElement('div');
            div.className = `track-item-library ${this.currentTrack?.id === track.id ? 'playing' : ''}`;
            div.dataset.id = track.id;
            
            div.innerHTML = `
                <div class="track-number">${index + 1}</div>
                <div class="track-details-library">
                    <div class="title">${this.escapeHtml(track.title)}</div>
                    <div class="artist">${track.artist || 'Importado'}</div>
                </div>
                <div class="track-duration-library">${track.duration || '--:--'}</div>
                <button class="delete-track" data-id="${track.id}" title="Remover">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            div.onclick = (e) => {
                if (!e.target.closest('.delete-track')) {
                    this.playTrack(track);
                }
            };
            
            container.appendChild(div);
        });
        
        // Adicionar eventos de exclusão
        container.querySelectorAll('.delete-track').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trackId = btn.dataset.id;
                this.deleteUploadedTrack(trackId);
            };
        });
        
        // Atualizar contador
        const trackCount = document.getElementById('trackCount');
        if (trackCount) {
            trackCount.textContent = `${this.tracks.length} ${this.tracks.length === 1 ? 'música' : 'músicas'}`;
        }
    }

    deleteUploadedTrack(trackId) {
        const trackIndex = this.tracks.findIndex(track => track.id === trackId);
        if (trackIndex !== -1) {
            const track = this.tracks[trackIndex];
            
            // Se a música que está sendo excluída está tocando
            if (this.currentTrack && this.currentTrack.id === trackId) {
                this.audio.pause();
                this.currentTrack = null;
                this.updatePlayState(false);
            }
            
            this.tracks.splice(trackIndex, 1);
            this.saveMusicSettings();
            this.renderUploadedTracks();
            
            this.showNotification('Música removida', 'A música foi excluída da sua biblioteca.', 'info');
        }
    }

    deleteAllTracks() {
        if (this.tracks.length === 0) return;
        
        this.showConfirm(
            'Limpar todas as músicas',
            'Tem certeza que deseja remover todas as músicas importadas?',
            () => {
                this.tracks = [];
                if (this.currentTrack) {
                    this.audio.pause();
                    this.currentTrack = null;
                    this.updatePlayState(false);
                }
                this.saveMusicSettings();
                this.renderUploadedTracks();
                
                this.showNotification('Biblioteca limpa', 'Todas as músicas foram removidas.', 'info');
            }
        );
    }

    saveMusicSettings() {
        const data = {
            tracks: this.tracks,
            volume: this.audio.volume
        };
        try {
            localStorage.setItem('escry-music', JSON.stringify(data));
        } catch (error) {
            console.error('ESCRITY: Erro ao salvar configurações de música:', error);
        }
    }

    loadSettings() {
        // Carregar configurações de música
        try {
            const savedMusic = localStorage.getItem('escry-music');
            if (savedMusic) {
                const data = JSON.parse(savedMusic);
                this.tracks = data.tracks || [];
                this.audio.volume = data.volume || 0.5;
                
                // Atualizar volume
                const volumeFill = document.getElementById('volumeFill');
                if (volumeFill) {
                    volumeFill.style.width = `${this.audio.volume * 100}%`;
                }
                
                // Renderizar trilhas importadas
                this.renderUploadedTracks();
            }
        } catch (e) {
            console.error('ESCRITY: Erro ao carregar configurações de música:', e);
        }
        
        // Carregar outras configurações
        try {
            const savedSettings = localStorage.getItem('escry-settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                this.currentTextColor = settings.textColor || '#2c3e50';
                
                // Aplicar cor do texto
                const textColorPicker = document.getElementById('textColorPicker');
                const editor = document.getElementById('editor');
                
                if (textColorPicker) textColorPicker.value = this.currentTextColor;
                if (editor) editor.style.color = this.currentTextColor;
            }
        } catch (e) {
            console.error('ESCRITY: Erro ao carregar configurações:', e);
        }
    }

    // ========== BACKUP E RESTAURAÇÃO ==========

    showBackupModal() {
        const modal = document.getElementById('backupModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    showRestoreModal() {
        const modal = document.getElementById('restoreModal');
        if (modal) {
            modal.classList.add('active');
            this.loadBackupsList();
        }
    }

    createManualBackup() {
        try {
            const backupData = {
                id: `backup-manual-${Date.now()}`,
                app: 'ESCRITY',
                version: '3.0',
                date: new Date().toISOString(),
                notebooks: this.notebooks,
                settings: {
                    fontSettings: this.fontSettings,
                    textColor: this.currentTextColor
                }
            };
            
            localStorage.setItem(`escry-backup-${backupData.id}`, JSON.stringify(backupData));
            
            this.showNotification('Backup criado', 'Sua cópia de segurança foi salva com sucesso.', 'success');
            return true;
        } catch (error) {
            console.error('ESCRITY: Erro ao criar backup manual:', error);
            this.showNotification('Erro', 'Não foi possível criar o backup.', 'error');
            return false;
        }
    }

    loadBackupsList() {
        const container = document.getElementById('backupsList');
        if (!container) return;
        
        const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('escry-backup-'));
        
        if (backupKeys.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>Nenhum backup encontrado</p>
                </div>
            `;
            const confirmBtn = document.getElementById('confirmRestoreBtn');
            if (confirmBtn) confirmBtn.disabled = true;
            return;
        }
        
        container.innerHTML = '';
        
        backupKeys.forEach(key => {
            try {
                const backupData = JSON.parse(localStorage.getItem(key));
                const date = new Date(backupData.date);
                const dateStr = date.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const notebookCount = backupData.notebooks ? backupData.notebooks.length : 0;
                const sheetCount = backupData.notebooks ? 
                    backupData.notebooks.reduce((total, nb) => total + (nb.sheets ? nb.sheets.length : 0), 0) : 0;
                
                const div = document.createElement('div');
                div.className = 'backup-item';
                div.dataset.key = key;
                
                div.innerHTML = `
                    <div class="backup-info">
                        <div class="backup-title">
                            <i class="fas fa-archive"></i>
                            <span>Backup ${backupData.id.includes('manual') ? 'Manual' : 'Automático'}</span>
                        </div>
                        <div class="backup-details">
                            <span class="backup-date">${dateStr}</span>
                            <span class="backup-stats">${notebookCount} caderno(s), ${sheetCount} folha(s)</span>
                        </div>
                    </div>
                    <div class="backup-actions">
                        <button class="backup-action-btn restore" title="Restaurar">
                            <i class="fas fa-history"></i>
                        </button>
                        <button class="backup-action-btn delete" title="Excluir backup">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                div.querySelector('.restore').onclick = () => {
                    this.selectBackupForRestoration(key);
                };
                
                div.querySelector('.delete').onclick = () => {
                    this.deleteBackup(key);
                };
                
                container.appendChild(div);
            } catch (e) {
                console.error('ESCRITY: Erro ao processar backup:', e);
            }
        });
        
        const confirmBtn = document.getElementById('confirmRestoreBtn');
        if (confirmBtn) confirmBtn.disabled = true;
    }

    selectBackupForRestoration(key) {
        document.querySelectorAll('.backup-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = document.querySelector(`.backup-item[data-key="${key}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
            const confirmBtn = document.getElementById('confirmRestoreBtn');
            if (confirmBtn) confirmBtn.disabled = false;
            this.selectedBackupKey = key;
        }
    }

    restoreBackup() {
        if (!this.selectedBackupKey) return;
        
        this.showConfirm(
            'Restaurar Backup',
            'Tem certeza? Todos os dados atuais serão substituídos.',
            () => {
                try {
                    const backupData = JSON.parse(localStorage.getItem(this.selectedBackupKey));
                    
                    if (backupData && backupData.notebooks) {
                        this.notebooks = backupData.notebooks;
                        this.fontSettings = backupData.settings?.fontSettings || this.fontSettings;
                        this.currentTextColor = backupData.settings?.textColor || '#2c3e50';
                        
                        this.saveData();
                        this.renderNotebooks();
                        
                        if (this.notebooks.length > 0) {
                            this.selectNotebook(this.notebooks[0].id);
                        } else {
                            this.clearEditor();
                        }
                        
                        const modal = document.getElementById('restoreModal');
                        if (modal) modal.classList.remove('active');
                        
                        this.showNotification('Backup restaurado', 'Seus dados foram recuperados com sucesso.', 'success');
                    }
                } catch (e) {
                    console.error('ESCRITY: Erro ao restaurar backup:', e);
                    this.showNotification('Erro', 'Não foi possível restaurar o backup.', 'error');
                }
            }
        );
    }

    deleteBackup(key) {
        this.showConfirm(
            'Excluir Backup',
            'Tem certeza que deseja excluir este backup?',
            () => {
                localStorage.removeItem(key);
                this.loadBackupsList();
                this.showNotification('Backup excluído', 'O backup foi removido permanentemente.', 'info');
            }
        );
    }

    // ========== EXPORTAÇÃO ==========

    showExportModal() {
        if (!this.currentNotebook) {
            this.showNotification('Selecione um caderno', 'Escolha um caderno para exportar.', 'warning');
            return;
        }
        
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    exportNotebook(format) {
        if (!this.currentNotebook) return;
        
        const notebook = this.currentNotebook;
        const date = new Date().toLocaleDateString('pt-BR');
        const includeMetadata = document.getElementById('includeMetadata')?.checked || false;
        
        let exportedContent = '';
        let filename = `${notebook.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}`;
        
        switch(format) {
            case 'txt':
                exportedContent = this.exportNotebookToTxt(notebook, includeMetadata);
                filename += '.txt';
                break;
                
            case 'html':
                exportedContent = this.exportNotebookToHtml(notebook, includeMetadata, date);
                filename += '.html';
                break;
                
            case 'pdf':
                // Para PDF, exportar como HTML primeiro
                const htmlContent = this.exportNotebookToHtml(notebook, includeMetadata, date);
                this.exportToPDF(notebook.name, htmlContent);
                return;
        }
        
        // Criar e baixar arquivo
        try {
            const blob = new Blob([exportedContent], { type: this.getMimeType(format) });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            const modal = document.getElementById('exportModal');
            if (modal) modal.classList.remove('active');
            
            this.showNotification('Exportação concluída', `"${notebook.name}" foi exportado com sucesso.`, 'success');
        } catch (error) {
            console.error('ESCRITY: Erro ao exportar:', error);
            this.showNotification('Erro', 'Não foi possível exportar o caderno.', 'error');
        }
    }

    exportNotebookToTxt(notebook, includeMetadata) {
        let content = `CADERNO: ${notebook.name}\n`;
        content += `Data de criação: ${new Date(notebook.created).toLocaleDateString('pt-BR')}\n`;
        content += `Última atualização: ${new Date(notebook.updated).toLocaleDateString('pt-BR')}\n`;
        content += `Total de folhas: ${notebook.sheets ? notebook.sheets.length : 0}\n`;
        content += '='.repeat(50) + '\n\n';
        
        if (notebook.sheets && notebook.sheets.length > 0) {
            notebook.sheets.forEach((sheet, index) => {
                content += `FOLHA ${index + 1}: ${sheet.title}\n`;
                if (includeMetadata) {
                    content += `Criada em: ${new Date(sheet.created).toLocaleDateString('pt-BR')}\n`;
                    content += `Atualizada em: ${new Date(sheet.updated).toLocaleDateString('pt-BR')}\n`;
                }
                content += '-'.repeat(40) + '\n';
                
                // Converter HTML para texto simples
                const div = document.createElement('div');
                div.innerHTML = sheet.content;
                const textContent = div.textContent || div.innerText || '';
                content += textContent + '\n\n';
                content += '='.repeat(50) + '\n\n';
            });
        }
        
        if (includeMetadata) {
            content += '\n\n' + '='.repeat(50) + '\n';
            content += `Exportado do ESCRITY em ${new Date().toLocaleDateString('pt-BR')}\n`;
            content += 'www.escrity.app\n';
        }
        
        return content;
    }

    exportNotebookToHtml(notebook, includeMetadata, date) {
        let sheetsHtml = '';
        
        if (notebook.sheets && notebook.sheets.length > 0) {
            notebook.sheets.forEach((sheet, index) => {
                sheetsHtml += `
                    <div class="sheet">
                        <h2>${index + 1}. ${this.escapeHtml(sheet.title)}</h2>
                        ${includeMetadata ? `
                            <div class="sheet-meta">
                                Criada em: ${new Date(sheet.created).toLocaleDateString('pt-BR')} | 
                                Atualizada em: ${new Date(sheet.updated).toLocaleDateString('pt-BR')}
                            </div>
                        ` : ''}
                        <div class="sheet-content">${sheet.content}</div>
                        <hr class="sheet-divider">
                    </div>
                `;
            });
        }
        
        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${notebook.name} - ESCRITY</title>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            line-height: 1.8;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            color: #2c3e50;
            background: #f8f9fa;
        }
        .notebook-header {
            text-align: center;
            margin-bottom: 3rem;
            padding-bottom: 2rem;
            border-bottom: 2px solid #3498db;
        }
        .notebook-header h1 {
            color: #1a1a2e;
            margin-bottom: 1rem;
            font-size: 2.5em;
        }
        .notebook-meta {
            color: #7f8c8d;
            font-size: 0.95em;
            margin-bottom: 2rem;
        }
        .sheet {
            margin-bottom: 3rem;
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .sheet h2 {
            color: #2c3e50;
            margin-top: 0;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 0.5rem;
        }
        .sheet-meta {
            color: #95a5a6;
            font-size: 0.9em;
            margin-bottom: 1.5rem;
            font-style: italic;
        }
        .sheet-content {
            font-size: 1.1em;
            line-height: 1.8;
        }
        .sheet-content p {
            margin-bottom: 1.5em;
        }
        .sheet-content h1, .sheet-content h2, .sheet-content h3 {
            margin: 2em 0 1em;
            color: #1a1a2e;
        }
        .sheet-content blockquote {
            border-left: 4px solid #3498db;
            padding-left: 1.5em;
            margin: 2em 0;
            font-style: italic;
            color: #7f8c8d;
            background: #f8f9fa;
            padding: 1em;
            border-radius: 5px;
        }
        .sheet-content img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 1.5em 0;
        }
        .sheet-divider {
            border: none;
            border-top: 1px solid #e0e0e0;
            margin: 2rem 0;
        }
        .export-footer {
            text-align: center;
            color: #95a5a6;
            font-size: 0.9em;
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid #e0e0e0;
        }
        @media print {
            body {
                background: white !important;
                padding: 0 !important;
            }
            .sheet {
                box-shadow: none !important;
                padding: 0 !important;
                margin-bottom: 2rem !important;
            }
        }
    </style>
</head>
<body>
    <div class="notebook-header">
        <h1>${this.escapeHtml(notebook.name)}</h1>
        ${includeMetadata ? `
            <div class="notebook-meta">
                Criado em: ${new Date(notebook.created).toLocaleDateString('pt-BR')} | 
                Atualizado em: ${new Date(notebook.updated).toLocaleDateString('pt-BR')} | 
                Total de folhas: ${notebook.sheets ? notebook.sheets.length : 0}
            </div>
        ` : ''}
    </div>
    
    <div class="notebook-content">
        ${sheetsHtml}
    </div>
    
    ${includeMetadata ? `
        <div class="export-footer">
            Exportado do ESCRITY em ${date} | www.escrity.app
        </div>
    ` : ''}
</body>
</html>`;
    }

    exportToPDF(title, htmlContent) {
        // Esta função requer a biblioteca html2pdf.js
        // Para simplificar, vamos exportar como HTML
        this.exportNotebook('html');
    }

    stripHTML(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    getMimeType(format) {
        const mimeTypes = {
            'txt': 'text/plain',
            'html': 'text/html',
            'pdf': 'application/pdf'
        };
        return mimeTypes[format] || 'text/plain';
    }

    // ========== UTILITÁRIOS ==========

    showNotification(title, message, type = 'success') {
        const notification = document.getElementById('notification');
        const notificationTitle = document.getElementById('notificationTitle');
        const notificationText = document.getElementById('notificationText');
        
        if (!notification || !notificationTitle || !notificationText) return;
        
        notificationTitle.textContent = title;
        notificationText.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'flex';
        
        // Remover após 4 segundos
        setTimeout(() => {
            notification.classList.add('hiding');
            setTimeout(() => {
                notification.style.display = 'none';
                notification.classList.remove('hiding');
            }, 300);
        }, 4000);
    }

    showConfirm(title, message, callback) {
        const modal = document.getElementById('confirmModal');
        const messageEl = document.getElementById('confirmMessage');
        
        if (!modal || !messageEl) return;
        
        messageEl.textContent = message;
        modal.classList.add('active');
        
        const confirmBtn = document.getElementById('confirmActionBtn');
        const cancelBtn = document.getElementById('cancelConfirmBtn');
        
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                modal.classList.remove('active');
                if (callback) callback();
            };
        }
        
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                modal.classList.remove('active');
            };
        }
    }

    formatDate(dateString, short = false) {
        if (!dateString) return 'Nunca';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Data inválida';
        
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (short) {
            if (diffDays === 0) {
                return 'Hoje';
            } else if (diffDays === 1) {
                return 'Ontem';
            } else if (diffDays < 7) {
                return `${diffDays}d`;
            } else {
                return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            }
        }
        
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

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    moveCursorToEnd(element) {
        if (!element) return;
        
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // ========== EVENT LISTENERS ==========

    setupEventListeners() {
        console.log('ESCRITY: Configurando eventos...');
        
        // ===== APP =====
        const clearDataBtn = document.getElementById('clearDataBtn');
        if (clearDataBtn) {
            clearDataBtn.onclick = () => this.clearLocalData();
        }
        
        // ===== CADERNOS =====
        const newNotebookBtn = document.getElementById('newNotebook');
        if (newNotebookBtn) {
            newNotebookBtn.onclick = () => {
                const modal = document.getElementById('notebookModal');
                const notebookNameInput = document.getElementById('notebookName');
                if (modal) modal.classList.add('active');
                if (notebookNameInput) {
                    notebookNameInput.focus();
                    notebookNameInput.value = '';
                }
            };
        }

        const createNotebookBtn = document.getElementById('createNotebookBtn');
        if (createNotebookBtn) {
            createNotebookBtn.onclick = () => {
                const notebookNameInput = document.getElementById('notebookName');
                const modal = document.getElementById('notebookModal');
                
                if (notebookNameInput) {
                    const name = notebookNameInput.value.trim();
                    if (name) {
                        const color = document.querySelector('.color-option.active')?.dataset.color || '#1a1a2e';
                        this.createNotebook(name, color);
                        if (modal) modal.classList.remove('active');
                        notebookNameInput.value = '';
                    } else {
                        this.showNotification('Nome necessário', 'Digite um nome para o caderno.', 'error');
                    }
                }
            };
        }

        const cancelNotebookBtn = document.getElementById('cancelNotebookBtn');
        if (cancelNotebookBtn) {
            cancelNotebookBtn.onclick = () => {
                const modal = document.getElementById('notebookModal');
                if (modal) modal.classList.remove('active');
            };
        }

        const notebookNameInput = document.getElementById('notebookName');
        if (notebookNameInput) {
            notebookNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const createBtn = document.getElementById('createNotebookBtn');
                    if (createBtn) createBtn.click();
                }
            });
        }

        // Opções de cor
        document.querySelectorAll('.color-option').forEach(option => {
            option.onclick = () => {
                document.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');
            };
        });

        // ===== FOLHAS =====
        const newSheetBtn = document.getElementById('newSheet');
        if (newSheetBtn) {
            newSheetBtn.onclick = () => {
                if (!this.currentNotebook) {
                    this.showNotification('Selecione um caderno', 'Escolha um caderno primeiro.', 'error');
                    return;
                }
                
                const modal = document.getElementById('sheetModal');
                const sheetNameInput = document.getElementById('sheetName');
                if (modal) modal.classList.add('active');
                if (sheetNameInput) {
                    sheetNameInput.focus();
                    sheetNameInput.value = '';
                }
            };
        }

        const mobileNewSheetBtn = document.getElementById('mobileNewSheetBtn');
        if (mobileNewSheetBtn) {
            mobileNewSheetBtn.onclick = () => {
                if (!this.currentNotebook) {
                    this.showNotification('Selecione um caderno', 'Escolha um caderno primeiro.', 'error');
                    return;
                }
                
                const modal = document.getElementById('sheetModal');
                const sheetNameInput = document.getElementById('sheetName');
                if (modal) modal.classList.add('active');
                if (sheetNameInput) {
                    sheetNameInput.focus();
                    sheetNameInput.value = '';
                }
            };
        }

        const createSheetBtn = document.getElementById('createSheetBtn');
        if (createSheetBtn) {
            createSheetBtn.onclick = () => {
                const sheetNameInput = document.getElementById('sheetName');
                const sheetTemplate = document.getElementById('sheetTemplate');
                const modal = document.getElementById('sheetModal');
                
                if (sheetNameInput) {
                    const name = sheetNameInput.value.trim();
                    if (name) {
                        const template = sheetTemplate ? sheetTemplate.value : 'blank';
                        this.addSheet(name, template);
                        if (modal) modal.classList.remove('active');
                        sheetNameInput.value = '';
                    } else {
                        this.showNotification('Título necessário', 'Digite um título para a folha.', 'error');
                    }
                }
            };
        }

        const cancelSheetBtn = document.getElementById('cancelSheetBtn');
        if (cancelSheetBtn) {
            cancelSheetBtn.onclick = () => {
                const modal = document.getElementById('sheetModal');
                if (modal) modal.classList.remove('active');
            };
        }

        const sheetNameInput = document.getElementById('sheetName');
        if (sheetNameInput) {
            sheetNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const createBtn = document.getElementById('createSheetBtn');
                    if (createBtn) createBtn.click();
                }
            });
        }

        // ===== EDITOR =====
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.onclick = () => this.saveContent();
        }

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.onclick = () => this.showExportModal();
        }

        const deleteSheetBtn = document.getElementById('deleteSheetBtn');
        if (deleteSheetBtn) {
            deleteSheetBtn.onclick = () => {
                if (this.currentSheet) {
                    this.deleteSheet(this.currentSheet.id);
                }
            };
        }

        // Ferramentas de formatação
        const boldBtn = document.getElementById('boldBtn');
        if (boldBtn) boldBtn.onclick = () => this.applyFormatting('bold');
        
        const italicBtn = document.getElementById('italicBtn');
        if (italicBtn) italicBtn.onclick = () => this.applyFormatting('italic');
        
        const underlineBtn = document.getElementById('underlineBtn');
        if (underlineBtn) underlineBtn.onclick = () => this.applyFormatting('underline');
        
        const highlightBtn = document.getElementById('highlightBtn');
        if (highlightBtn) highlightBtn.onclick = () => this.applyFormatting('hiliteColor', '#f1c40f');
        
        const listBtn = document.getElementById('listUlBtn');
        if (listBtn) listBtn.onclick = () => this.applyFormatting('insertUnorderedList');
        
        const imageBtn = document.getElementById('imageBtn');
        if (imageBtn) imageBtn.onclick = () => this.insertImage();
        
        const quoteBtn = document.getElementById('quoteBtn');
        if (quoteBtn) quoteBtn.onclick = () => this.insertQuote();
        
        const dividerBtn = document.getElementById('dividerBtn');
        if (dividerBtn) dividerBtn.onclick = () => this.insertDivider();

        // Cor do texto
        const textColorPicker = document.getElementById('textColorPicker');
        if (textColorPicker) {
            textColorPicker.onchange = () => this.changeTextColor();
        }

        // ===== PERSONALIZAÇÃO =====
        const customizeBtn = document.getElementById('customizeSheetBtn');
        if (customizeBtn) {
            customizeBtn.onclick = () => this.showCustomizeSheetModal();
        }

        const fontSettingsBtn = document.getElementById('fontSettingsBtn');
        if (fontSettingsBtn) {
            fontSettingsBtn.onclick = () => this.showFontSettingsModal();
        }

        // Aplicar personalização
        const applyCustomizeBtn = document.getElementById('applyCustomizeBtn');
        if (applyCustomizeBtn) {
            applyCustomizeBtn.onclick = () => this.saveCustomization();
        }

        const cancelCustomizeBtn = document.getElementById('cancelCustomizeBtn');
        if (cancelCustomizeBtn) {
            cancelCustomizeBtn.onclick = () => {
                const modal = document.getElementById('customizeSheetModal');
                if (modal) modal.classList.remove('active');
            };
        }

        // Opções de fundo
        document.querySelectorAll('.bg-option').forEach(option => {
            option.onclick = () => {
                document.querySelectorAll('.bg-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');
                
                if (option.dataset.bg === 'custom') {
                    const bgUpload = document.getElementById('bgImageUpload');
                    if (bgUpload) bgUpload.click();
                }
            };
        });

        // Upload de imagem de fundo
        const bgImageUpload = document.getElementById('bgImageUpload');
        if (bgImageUpload) {
            bgImageUpload.onchange = (e) => {
                this.handleBackgroundUpload(e.target.files[0]);
            };
        }

        // Tons de página
        document.querySelectorAll('.color-tone').forEach(tone => {
            tone.onclick = () => {
                document.querySelectorAll('.color-tone').forEach(t => {
                    t.classList.remove('active');
                });
                tone.classList.add('active');
            };
        });

        // Margens
        document.querySelectorAll('.margin-option').forEach(option => {
            option.onclick = () => {
                document.querySelectorAll('.margin-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');
            };
        });

        // ===== CONFIGURAÇÕES DE FONTE =====
        const applyFontBtn = document.getElementById('applyFontBtn');
        if (applyFontBtn) {
            applyFontBtn.onclick = () => this.applyFontSettings();
        }

        const cancelFontBtn = document.getElementById('cancelFontBtn');
        if (cancelFontBtn) {
            cancelFontBtn.onclick = () => {
                const modal = document.getElementById('fontSettingsModal');
                if (modal) modal.classList.remove('active');
            };
        }

        // Opções de fonte
        document.querySelectorAll('.font-option').forEach(option => {
            option.onclick = () => {
                document.querySelectorAll('.font-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');
                this.updateFontPreview();
            };
        });

        // Sliders
        const fontSizeSlider = document.getElementById('fontSize');
        if (fontSizeSlider) {
            fontSizeSlider.oninput = () => this.updateFontPreview();
        }

        const lineHeightSlider = document.getElementById('lineHeight');
        if (lineHeightSlider) {
            lineHeightSlider.oninput = () => this.updateFontPreview();
        }

        // ===== MÚSICA =====
        const toggleMusicBtn = document.getElementById('toggleMusic');
        if (toggleMusicBtn) {
            toggleMusicBtn.onclick = () => this.toggleMusicSidebar();
        }

        const closeMusicBtn = document.getElementById('closeMusic');
        if (closeMusicBtn) {
            closeMusicBtn.onclick = () => this.toggleMusicSidebar();
        }

        // Player
        const playPauseBtn = document.getElementById('playPause');
        if (playPauseBtn) {
            playPauseBtn.onclick = () => this.playPause();
        }

        const nextTrackBtn = document.getElementById('nextTrack');
        if (nextTrackBtn) {
            nextTrackBtn.onclick = () => this.playNextTrack();
        }

        const prevTrackBtn = document.getElementById('prevTrack');
        if (prevTrackBtn) {
            prevTrackBtn.onclick = () => this.playPrevTrack();
        }

        // Barras de progresso
        const progressBar = document.getElementById('progressBar');
        const volumeBar = document.getElementById('volumeBar');
        
        if (progressBar) {
            progressBar.onclick = (e) => this.updateProgressBar(e);
        }
        
        if (volumeBar) {
            volumeBar.onclick = (e) => this.updateVolume(e);
        }

        // Upload de música
        const uploadArea = document.getElementById('uploadArea');
        const audioUpload = document.getElementById('audioUpload');
        
        if (uploadArea && audioUpload) {
            uploadArea.onclick = () => audioUpload.click();
            uploadArea.ondragover = (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'var(--accent-color)';
                uploadArea.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
            };
            uploadArea.ondragleave = () => {
                uploadArea.style.borderColor = 'rgba(255,255,255,0.3)';
                uploadArea.style.backgroundColor = 'rgba(255,255,255,0.05)';
            };
            uploadArea.ondrop = (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'rgba(255,255,255,0.3)';
                uploadArea.style.backgroundColor = 'rgba(255,255,255,0.05)';
                this.handleMusicUpload(e.dataTransfer.files);
            };
            
            audioUpload.onchange = (e) => {
                this.handleMusicUpload(e.target.files);
                e.target.value = '';
            };
        }

        // Limpar todas as músicas
        const deleteAllTracksBtn = document.getElementById('deleteAllTracks');
        if (deleteAllTracksBtn) {
            deleteAllTracksBtn.onclick = () => this.deleteAllTracks();
        }

        // ===== BACKUP =====
        const backupBtn = document.getElementById('backupBtn');
        if (backupBtn) {
            backupBtn.onclick = () => this.showBackupModal();
        }

        const restoreBtn = document.getElementById('restoreBtn');
        if (restoreBtn) {
            restoreBtn.onclick = () => this.showRestoreModal();
        }
        
        // Opções de backup
        document.querySelectorAll('.backup-option').forEach(option => {
            option.onclick = () => {
                const action = option.dataset.action;
                const modal = document.getElementById('backupModal');
                if (modal) modal.classList.remove('active');
                
                switch(action) {
                    case 'create':
                        this.createManualBackup();
                        break;
                    case 'restore':
                        this.showRestoreModal();
                        break;
                    case 'manage':
                        this.showRestoreModal();
                        break;
                }
            };
        });

        const cancelBackupBtn = document.getElementById('cancelBackupBtn');
        if (cancelBackupBtn) {
            cancelBackupBtn.onclick = () => {
                const modal = document.getElementById('backupModal');
                if (modal) modal.classList.remove('active');
            };
        }

        // Restauração
        const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
        if (confirmRestoreBtn) {
            confirmRestoreBtn.onclick = () => this.restoreBackup();
        }

        const cancelRestoreBtn = document.getElementById('cancelRestoreBtn');
        if (cancelRestoreBtn) {
            cancelRestoreBtn.onclick = () => {
                const modal = document.getElementById('restoreModal');
                if (modal) modal.classList.remove('active');
                this.selectedBackupKey = null;
            };
        }

        // ===== CAPA =====
        const changeCoverBtn = document.getElementById('changeCoverBtn');
        if (changeCoverBtn) {
            changeCoverBtn.onclick = () => {
                const modal = document.getElementById('coverModal');
                if (modal) modal.classList.add('active');
            };
        }

        const applyCoverBtn = document.getElementById('applyCoverBtn');
        if (applyCoverBtn) {
            applyCoverBtn.onclick = () => {
                const coverType = document.querySelector('.cover-preset.active')?.dataset.cover || 'default';
                
                if (coverType === 'custom' && this.currentNotebook?.customCover) {
                    this.updateCover('custom', this.currentNotebook.customCover);
                    this.showNotification('Capa aplicada', 'Sua capa personalizada foi aplicada.', 'success');
                } else {
                    this.updateCover(coverType, null);
                    this.showNotification('Capa aplicada', 'A capa foi alterada.', 'success');
                }
                
                const modal = document.getElementById('coverModal');
                if (modal) modal.classList.remove('active');
            };
        }

        const cancelCoverBtn = document.getElementById('cancelCoverBtn');
        if (cancelCoverBtn) {
            cancelCoverBtn.onclick = () => {
                const modal = document.getElementById('coverModal');
                if (modal) modal.classList.remove('active');
            };
        }

        // Opções de capa
        document.querySelectorAll('.cover-preset').forEach(preset => {
            preset.onclick = () => {
                document.querySelectorAll('.cover-preset').forEach(p => {
                    p.classList.remove('active');
                });
                preset.classList.add('active');
                
                const customCoverUpload = document.getElementById('customCoverUpload');
                const coverFileInput = document.getElementById('coverFile');
                
                if (preset.dataset.cover === 'custom') {
                    if (customCoverUpload) customCoverUpload.style.display = 'block';
                    if (coverFileInput) coverFileInput.click();
                } else {
                    if (customCoverUpload) customCoverUpload.style.display = 'none';
                }
            };
        });

        // Upload de capa personalizada
        const coverFileInput = document.getElementById('coverFile');
        if (coverFileInput) {
            coverFileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file || !file.type.startsWith('image/')) {
                    this.showNotification('Formato inválido', 'Selecione apenas imagens.', 'error');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (this.currentNotebook) {
                        this.currentNotebook.customCover = e.target.result;
                        this.updateCover('custom', e.target.result);
                    }
                };
                reader.readAsDataURL(file);
            };
        }

        // ===== EXPORTAÇÃO =====
        const cancelExportBtn = document.getElementById('cancelExportBtn');
        if (cancelExportBtn) {
            cancelExportBtn.onclick = () => {
                const modal = document.getElementById('exportModal');
                if (modal) modal.classList.remove('active');
            };
        }

        const confirmExportBtn = document.getElementById('confirmExportBtn');
        if (confirmExportBtn) {
            confirmExportBtn.onclick = () => {
                const activeOption = document.querySelector('.export-option.active');
                const format = activeOption ? activeOption.dataset.format : 'txt';
                this.exportNotebook(format);
            };
        }

        document.querySelectorAll('.export-option').forEach(option => {
            option.onclick = () => {
                document.querySelectorAll('.export-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');
            };
        });

        // ===== MOBILE =====
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('mainSidebar');
        const mobileOverlay = document.getElementById('mobileOverlay');
        
        if (mobileMenuBtn && sidebar && mobileOverlay) {
            mobileMenuBtn.onclick = () => {
                sidebar.classList.toggle('active');
                mobileOverlay.classList.toggle('active');
            };

            mobileOverlay.onclick = () => {
                sidebar.classList.remove('active');
                mobileOverlay.classList.remove('active');
            };
        }

        // Swipe para fechar sidebar
        let touchStartX = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (!sidebar || !sidebar.classList.contains('active')) return;
            
            const touchX = e.touches[0].clientX;
            const diffX = touchX - touchStartX;
            
            if (diffX > 50) {
                sidebar.classList.remove('active');
                if (mobileOverlay) mobileOverlay.classList.remove('active');
            }
        }, { passive: true });

        // ===== TECLAS DE ATALHO =====
        document.addEventListener('keydown', (e) => {
            // Ctrl+S para salvar
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveContent();
            }
            
            // Ctrl+B para negrito
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this.applyFormatting('bold');
            }
            
            // Ctrl+I para itálico
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                this.applyFormatting('italic');
            }
            
            // Ctrl+U para sublinhado
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                this.applyFormatting('underline');
            }
            
            // Ctrl+Shift+I para imagem
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
                e.preventDefault();
                this.insertImage();
            }
            
            // Ctrl+Q para citação
            if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
                e.preventDefault();
                this.insertQuote();
            }
            
            // Ctrl+D para divisor
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.insertDivider();
            }
            
            // Ctrl+Space para play/pause música
            if (e.ctrlKey && e.key === ' ') {
                e.preventDefault();
                this.playPause();
            }
            
            // ESC para fechar modais/sidebars
            if (e.key === 'Escape') {
                this.closeAllModals();
                
                if (window.innerWidth <= 992 && sidebar) {
                    sidebar.classList.remove('active');
                    if (mobileOverlay) mobileOverlay.classList.remove('active');
                }
                
                if (this.isMusicVisible) {
                    this.toggleMusicSidebar();
                }
            }
        });

        // Fechar modais clicando fora
        document.querySelectorAll('.modal').forEach(modal => {
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            };
        });

        // ===== INSTALAÇÃO PWA =====
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.onclick = () => {
                if (this.deferredPrompt) {
                    this.installApp();
                } else {
                    this.showInstallInstructions();
                }
            };
        }
    }

    toggleMusicSidebar() {
        const musicSidebar = document.getElementById('musicSidebar');
        const toggleMusicBtn = document.getElementById('toggleMusic');
        
        if (!musicSidebar || !toggleMusicBtn) return;
        
        this.isMusicVisible = !this.isMusicVisible;
        
        if (this.isMusicVisible) {
            musicSidebar.classList.add('active');
            toggleMusicBtn.innerHTML = '<i class="fas fa-times"></i> Fechar';
        } else {
            musicSidebar.classList.remove('active');
            toggleMusicBtn.innerHTML = '<i class="fas fa-headphones"></i> Atmosfera';
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        
        this.selectedBackupKey = null;
    }

    updateCover(coverType, customCover = null) {
        if (!this.currentNotebook) return;
        
        this.currentNotebook.cover = coverType;
        this.currentNotebook.customCover = customCover;
        
        const coverImg = document.getElementById('currentCover');
        if (!coverImg) return;
        
        if (coverType === 'custom' && customCover) {
            coverImg.src = customCover;
            coverImg.style.background = 'none';
            coverImg.style.backgroundImage = 'none';
        } else {
            coverImg.src = 'assets/capas/default.jpg';
            coverImg.style.background = 'none';
            coverImg.style.backgroundImage = 'none';
        }
        
        this.saveData();
    }

    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js');
                console.log('ESCRITY: Service Worker registrado');
            } catch (error) {
                console.error('ESCRITY: Service Worker não registrado:', error);
            }
        }
    }

    setupInstallPrompt() {
        const installBtn = document.getElementById('installBtn');
        if (!installBtn) return;
        
        // Verificar se já está instalado
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           window.navigator.standalone;
        
        if (isStandalone) {
            installBtn.style.display = 'none';
            return;
        }
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            installBtn.style.display = 'flex';
        });
        
        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            installBtn.style.display = 'none';
            this.showNotification('App instalado', 'ESCRITY agora está disponível no seu menu de apps.', 'success');
        });
    }

    async installApp() {
        if (!this.deferredPrompt) {
            this.showInstallInstructions();
            return;
        }
        
        this.deferredPrompt.prompt();
        const choiceResult = await this.deferredPrompt.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
            console.log('ESCRITY: App instalado');
        } else {
            this.showNotification('Instalação cancelada', 'Você ainda pode usar o ESCRITY no navegador.', 'info');
        }
        
        this.deferredPrompt = null;
    }

    showInstallInstructions() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        let instructions = '';
        
        if (isIOS) {
            instructions = 'No Safari, toque no ícone de compartilhar e selecione "Adicionar à Tela de Início".';
        } else if (isAndroid) {
            instructions = 'No Chrome, toque no menu (3 pontos) e selecione "Instalar app".';
        } else {
            instructions = 'No Chrome/Edge, clique no ícone de instalação na barra de endereço.';
        }
        
        this.showNotification('Instalar App', instructions, 'info');
    }

    setupIntervals() {
        // Verificar modificações não salvas a cada 5 segundos
        setInterval(() => this.checkUnsavedChanges(), 5000);
        
        // Criar backup automático a cada 24 horas
        setInterval(() => this.createAutoBackup(), 24 * 60 * 60 * 1000);
    }
}

// Inicializar o app
document.addEventListener('DOMContentLoaded', () => {
    console.log('ESCRITY: Carregando espaço de criação...');
    
    setTimeout(() => {
        try {
            const app = new EscrityApp();
            window.escryApp = app;
            
            // Verificar Service Worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    console.log('ESCRITY: Nova versão disponível');
                    window.location.reload();
                });
            }
        } catch (error) {
            console.error('ESCRITY: Erro crítico ao inicializar:', error);
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.innerHTML = `
                    <div class="loading-content">
                        <h2 style="color: #e74c3c;">ERRO</h2>
                        <p>Não foi possível carregar o ESCRITY</p>
                        <p style="font-size: 0.9rem; margin-top: 1rem;">Por favor, recarregue a página</p>
                        <button onclick="window.location.reload()" style="margin-top: 2rem; padding: 0.75rem 1.5rem; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            Recarregar
                        </button>
                    </div>
                `;
            }
        }
    }, 100);
});