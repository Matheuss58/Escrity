class NotesApp {
    constructor() {
        this.currentNotebook = null;
        this.currentSheet = null;
        this.notebooks = [];
        this.deferredPrompt = null;
        this.init();
    }

    async init() {
        this.loadNotebooks();
        this.setupEventListeners();
        this.setupServiceWorker();
        this.setupInstallPrompt();
        this.updateCharCount();
        
        // Auto-save a cada 30 segundos
        setInterval(() => this.autoSave(), 30000);
        
        // Verificar modificações não salvas
        setInterval(() => this.checkUnsavedChanges(), 10000);
    }

    loadNotebooks() {
        const saved = localStorage.getItem('notas-app-data');
        if (saved) {
            const data = JSON.parse(saved);
            this.notebooks = data.notebooks || [];
            
            // Migrar cadernos antigos para o novo formato
            if (data.notebooks && !data.notebooks[0]?.sheets) {
                this.notebooks = this.notebooks.map(notebook => ({
                    ...notebook,
                    sheets: notebook.sheets || [{
                        id: 'sheet-1',
                        title: 'Folha 1',
                        content: notebook.content || '',
                        created: notebook.created || new Date().toISOString(),
                        updated: notebook.updated || new Date().toISOString()
                    }]
                }));
            }
        } else {
            // Dados iniciais
            this.notebooks = [{
                id: 'default',
                name: 'Meu Primeiro Caderno',
                cover: 'default',
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                sheets: [{
                    id: 'sheet-1',
                    title: 'Bem-vindo',
                    content: '<p>Bem-vindo ao seu novo caderno digital! ✨</p><p>Comece criando novas folhas e organize suas ideias.</p><p>Use as ferramentas de formatação para deixar seu texto ainda melhor.</p>',
                    created: new Date().toISOString(),
                    updated: new Date().toISOString()
                }]
            }];
        }
        
        this.renderNotebooks();
        
        if (this.notebooks.length > 0) {
            this.selectNotebook(this.notebooks[0].id);
        }
    }

    saveNotebooks() {
        const data = {
            notebooks: this.notebooks,
            lastSave: new Date().toISOString()
        };
        localStorage.setItem('notas-app-data', JSON.stringify(data));
        this.updateLastSaved();
    }

    renderNotebooks() {
        const container = document.getElementById('notebooksList');
        container.innerHTML = '';
        
        this.notebooks.forEach(notebook => {
            const div = document.createElement('div');
            div.className = `notebook-item ${this.currentNotebook?.id === notebook.id ? 'active' : ''}`;
            div.innerHTML = `
                <h3>${notebook.name}</h3>
                <div class="notebook-date">${this.formatDate(notebook.updated)}</div>
            `;
            div.onclick = () => this.selectNotebook(notebook.id);
            container.appendChild(div);
        });
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
        this.saveNotebooks();
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
            updated: new Date().toISOString()
        };
    }

    addSheet(title) {
        if (!this.currentNotebook) return;
        
        const newSheet = this.createNewSheet(title);
        this.currentNotebook.sheets.push(newSheet);
        this.currentNotebook.updated = new Date().toISOString();
        
        this.saveNotebooks();
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
        
        this.saveNotebooks();
        this.renderSheets();
        
        this.showNotification(`Folha "${sheetTitle}" excluída com sucesso!`);
    }

    saveContent() {
        if (!this.currentSheet) return;
        
        const content = document.getElementById('editor').innerHTML;
        this.currentSheet.content = content;
        this.currentSheet.updated = new Date().toISOString();
        
        if (this.currentNotebook) {
            this.currentNotebook.updated = new Date().toISOString();
        }
        
        this.saveNotebooks();
        this.updateLastSaved();
        this.showNotification('Salvo com sucesso!');
        
        console.log('Conteúdo salvo:', {
            notebook: this.currentNotebook?.name,
            sheet: this.currentSheet?.title,
            length: content.length
        });
    }

    autoSave() {
        if (!this.currentSheet) return;
        
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
        }
    }

    updateCover(coverType) {
        if (!this.currentNotebook) return;
        
        this.currentNotebook.cover = coverType;
        const coverImg = document.getElementById('currentCover');
        
        // Cores para as capas
        const coverColors = {
            'default': '#ecf0f1',
            'blue': '#3498db',
            'green': '#2ecc71',
            'red': '#e74c3c',
            'purple': '#9b59b6'
        };
        
        if (coverType === 'custom' && this.currentNotebook.customCover) {
            coverImg.src = this.currentNotebook.customCover;
        } else if (coverColors[coverType]) {
            coverImg.src = '';
            coverImg.style.backgroundColor = coverColors[coverType];
            coverImg.style.backgroundImage = 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.1) 100%)';
        }
        
        this.saveNotebooks();
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

    updateLastSaved() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        document.getElementById('lastSaved').textContent = `Salvo: ${timeStr}`;
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
            return 'Hoje';
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
            // Mostrar indicador de modificações não salvas
            const saveBtn = document.getElementById('saveBtn');
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar *';
            saveBtn.style.background = '#f39c12';
        }
    }

    setupEventListeners() {
        // Novo caderno
        document.getElementById('newNotebook').onclick = () => {
            document.getElementById('notebookModal').classList.add('active');
            document.getElementById('notebookName').focus();
        };

        // Criar caderno
        document.getElementById('createNotebookBtn').onclick = () => {
            const name = document.getElementById('notebookName').value.trim();
            if (name) {
                this.createNotebook(name);
                document.getElementById('notebookModal').classList.remove('active');
                document.getElementById('notebookName').value = '';
            }
        };

        // Cancelar criação de caderno
        document.getElementById('cancelNotebookBtn').onclick = () => {
            document.getElementById('notebookModal').classList.remove('active');
        };

        // Nova folha
        document.getElementById('newSheet').onclick = () => {
            document.getElementById('sheetModal').classList.add('active');
            document.getElementById('sheetName').focus();
        };

        // Criar folha
        document.getElementById('createSheetBtn').onclick = () => {
            const name = document.getElementById('sheetName').value.trim();
            if (name) {
                this.addSheet(name);
                document.getElementById('sheetModal').classList.remove('active');
                document.getElementById('sheetName').value = '';
            }
        };

        // Cancelar criação de folha
        document.getElementById('cancelSheetBtn').onclick = () => {
            document.getElementById('sheetModal').classList.remove('active');
        };

        // Salvar
        document.getElementById('saveBtn').onclick = () => this.saveContent();

        // Ferramentas de formatação
        const formatButtons = {
            'paragraphBtn': () => this.formatParagraph(),
            'boldBtn': () => document.execCommand('bold'),
            'italicBtn': () => document.execCommand('italic'),
            'underlineBtn': () => document.execCommand('underline'),
            'listUlBtn': () => document.execCommand('insertUnorderedList'),
            'listOlBtn': () => document.execCommand('insertOrderedList')
        };

        Object.entries(formatButtons).forEach(([id, command]) => {
            document.getElementById(id).addEventListener('click', command);
        });

        // Contador de caracteres e palavras
        const editor = document.getElementById('editor');
        editor.addEventListener('input', () => {
            this.updateCharCount();
            this.updateWordCount();
            
            // Resetar estilo do botão salvar
            const saveBtn = document.getElementById('saveBtn');
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar';
            saveBtn.style.background = '';
        });

        // Seletor de capa
        document.getElementById('coverSelect').addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                document.getElementById('customCover').click();
            } else {
                this.updateCover(e.target.value);
            }
        });

        // Capa personalizada
        document.getElementById('customCover').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById('currentCover').src = event.target.result;
                    if (this.currentNotebook) {
                        this.currentNotebook.customCover = event.target.result;
                        this.currentNotebook.cover = 'custom';
                        document.getElementById('coverSelect').value = 'custom';
                        this.saveNotebooks();
                    }
                };
                reader.readAsDataURL(file);
            }
        });

        // Excluir folha atual
        document.getElementById('deleteSheetBtn').onclick = () => {
            if (this.currentSheet) {
                this.showDeleteConfirm(this.currentSheet);
            }
        };

        // Fechar modais com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.getElementById('notebookModal').classList.remove('active');
                document.getElementById('sheetModal').classList.remove('active');
                document.getElementById('confirmModal').classList.remove('active');
            }
            
            // Ctrl+S para salvar
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveContent();
            }
        });

        // Salvar ao sair da página
        window.addEventListener('beforeunload', (e) => {
            if (this.currentSheet) {
                const currentContent = editor.innerHTML;
                if (currentContent !== this.currentSheet.content) {
                    this.saveCurrentContent();
                    this.saveNotebooks();
                }
            }
        });
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

    setupServiceWorker() {
        if ('serviceWorker' in navigator && !window.location.hostname.includes('localhost')) {
            navigator.serviceWorker.register('sw.js')
                .then(() => console.log('Service Worker registrado'))
                .catch(err => console.log('Erro no Service Worker:', err));
        }
    }

    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            const installBtn = document.getElementById('installBtn');
            installBtn.style.display = 'flex';
            
            installBtn.onclick = () => {
                installBtn.style.display = 'none';
                this.deferredPrompt.prompt();
                this.deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        this.showNotification('Aplicativo instalado com sucesso!');
                    }
                    this.deferredPrompt = null;
                });
            };
        });
        
        window.addEventListener('appinstalled', () => {
            const installBtn = document.getElementById('installBtn');
            installBtn.style.display = 'none';
            this.deferredPrompt = null;
        });
    }
}

// Inicializar o app quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
    const app = new NotesApp();
    window.notesApp = app; // Para debugging
});