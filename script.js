class NotesApp {
    constructor() {
        this.currentNotebook = null;
        this.currentSheet = null;
        this.notebooks = [];
        this.deferredPrompt = null;
        this.editingNotebookId = null;
        
        // Variáveis para música
        this.isMusicVisible = false;
        this.currentPlaylist = 'uploaded';
        this.currentTrack = null;
        this.isPlaying = false;
        this.tracks = {
            uploaded: []
        };
        
        this.audio = document.getElementById('audioPlayer');
        this.init();
    }

    async init() {
        this.loadNotebooks();
        this.setupEventListeners();
        await this.setupServiceWorker();
        this.setupInstallPrompt();
        this.loadMusicSettings();
        this.updateCharCount();
        
        // Auto-save a cada 30 segundos
        setInterval(() => this.autoSave(), 30000);
        
        // Verificar modificações não salvas
        setInterval(() => this.checkUnsavedChanges(), 10000);
        
        // Configurar eventos do áudio
        this.setupAudioEvents();
    }

    // ========== GERENCIAMENTO DE NOTAS ==========

    loadNotebooks() {
        const saved = localStorage.getItem('notas-app-data');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.notebooks = data.notebooks || [];
            } catch (e) {
                console.error('Erro ao carregar dados:', e);
                this.notebooks = [];
            }
        }
        
        if (this.notebooks.length === 0) {
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
                    content: '<p>Comece criando novas folhas e organize suas ideias!</p>',
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
            this.saveNotebooks();
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
                this.saveNotebooks();
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

    // ========== MÚSICA ==========

    loadMusicSettings() {
        const saved = localStorage.getItem('notas-app-music');
        if (saved) {
            const data = JSON.parse(saved);
            this.tracks = data.tracks || { uploaded: [] };
            this.currentPlaylist = 'uploaded';
            this.audio.volume = data.volume || 0.5;
            document.getElementById('volumeSlider').value = this.audio.volume;
        } else {
            this.tracks = { uploaded: [] };
            this.currentPlaylist = 'uploaded';
            this.audio.volume = 0.5;
        }
        
        this.renderPlaylist(this.currentPlaylist);
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
            document.getElementById('toggleMusic').innerHTML = '<i class="fas fa-music"></i> Música Ambiente';
        }
    }

    renderPlaylist(playlistName) {
        this.currentPlaylist = playlistName;
        const tracks = this.tracks[playlistName] || [];
        const container = document.getElementById('tracksContainer');
        
        // Atualizar playlist ativa
        document.querySelectorAll('.playlist-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.playlist === playlistName) {
                item.classList.add('active');
            }
        });
        
        container.innerHTML = '';
        
        if (tracks.length === 0) {
            container.innerHTML = `
                <div class="no-tracks">
                    <i class="fas fa-music"></i>
                    <p>Nenhuma música carregada ainda</p>
                    <p class="upload-hint">Arraste ou clique para adicionar músicas</p>
                </div>
            `;
            return;
        }
        
        tracks.forEach((track, index) => {
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

    playTrack(track) {
        this.currentTrack = track;
        this.audio.src = track.url;
        this.audio.play().catch(e => {
            console.error('Erro ao reproduzir:', e);
            this.showNotification('Erro ao reproduzir música. Verifique a conexão.', 'error');
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
        } else {
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.title = 'Reproduzir';
            document.getElementById('musicStatusText').textContent = 'Pausado';
        }
    }

    playPause() {
        if (!this.currentTrack) {
            // Se não há música selecionada, tocar a primeira da playlist atual
            const tracks = this.tracks[this.currentPlaylist];
            if (tracks && tracks.length > 0) {
                this.playTrack(tracks[0]);
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
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const track = {
                    id: 'uploaded-' + Date.now() + Math.random(),
                    title: file.name.replace(/\.[^/.]+$/, ""), // Remove extensão
                    artist: 'Arquivo Local',
                    duration: '--:--',
                    url: e.target.result,
                    type: 'local'
                };
                
                this.tracks.uploaded.push(track);
                this.saveMusicSettings();
                
                // Adicionar à lista de arquivos carregados
                this.renderUploadedFile(file.name, track.id);
                
                // Se for a primeira música carregada, tocar automaticamente
                if (this.tracks.uploaded.length === 1) {
                    this.renderPlaylist('uploaded');
                }
                
                this.showNotification(`"${file.name}" adicionado à biblioteca`);
            };
            reader.readAsDataURL(file);
        });
    }

    renderUploadedFile(filename, trackId) {
        const container = document.getElementById('uploadedFiles');
        const div = document.createElement('div');
        div.className = 'uploaded-file';
        div.innerHTML = `
            <i class="fas fa-music"></i>
            <span class="name">${filename}</span>
            <span class="delete" data-id="${trackId}">
                <i class="fas fa-times"></i>
            </span>
        `;
        
        div.querySelector('.delete').onclick = (e) => {
            e.stopPropagation();
            this.deleteUploadedTrack(trackId, div);
        };
        
        container.appendChild(div);
    }

    deleteUploadedTrack(trackId, element) {
        const trackIndex = this.tracks.uploaded.findIndex(track => track.id === trackId);
        if (trackIndex !== -1) {
            // Se a música que está sendo excluída está tocando atualmente
            if (this.currentTrack && this.currentTrack.id === trackId) {
                const tracks = this.tracks.uploaded;
                if (tracks.length > 1) {
                    // Tocar a próxima música ou a anterior
                    const nextIndex = trackIndex < tracks.length - 1 ? trackIndex + 1 : trackIndex - 1;
                    if (tracks[nextIndex]) {
                        this.playTrack(tracks[nextIndex]);
                    } else {
                        this.audio.pause();
                        this.currentTrack = null;
                        document.getElementById('currentTrackTitle').textContent = 'Nenhuma música selecionada';
                        document.getElementById('currentTrackArtist').textContent = 'Carregue suas músicas';
                        document.getElementById('playPause').innerHTML = '<i class="fas fa-play"></i>';
                        document.getElementById('playPause').title = 'Reproduzir';
                    }
                } else {
                    // Última música sendo removida
                    this.audio.pause();
                    this.currentTrack = null;
                    document.getElementById('currentTrackTitle').textContent = 'Nenhuma música selecionada';
                    document.getElementById('currentTrackArtist').textContent = 'Carregue suas músicas';
                    document.getElementById('playPause').innerHTML = '<i class="fas fa-play"></i>';
                    document.getElementById('playPause').title = 'Reproduzir';
                }
            }
            
            this.tracks.uploaded = this.tracks.uploaded.filter(track => track.id !== trackId);
            this.saveMusicSettings();
            element.remove();
            
            this.renderPlaylist('uploaded');
            this.showNotification('Música removida da biblioteca');
        }
    }

    saveMusicSettings() {
        const data = {
            tracks: this.tracks,
            currentPlaylist: this.currentPlaylist,
            volume: this.audio.volume
        };
        localStorage.setItem('notas-app-music', JSON.stringify(data));
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
        // ===== NOTAS =====
        
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
            } else {
                this.showNotification('Digite um nome para o caderno', 'error');
            }
        };

        // Cancelar criação de caderno
        document.getElementById('cancelNotebookBtn').onclick = () => {
            document.getElementById('notebookModal').classList.remove('active');
        };

        // Enter para criar caderno
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

        // Enter para editar caderno
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

        // Criar folha
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

        // Cancelar criação de folha
        document.getElementById('cancelSheetBtn').onclick = () => {
            document.getElementById('sheetModal').classList.remove('active');
        };

        // Enter para criar folha
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

        // Contador de caracteres e palavras
        const editor = document.getElementById('editor');
        editor.addEventListener('input', () => {
            this.updateCharCount();
            this.updateWordCount();    
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
                        this.saveNotebooks();
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

        // ===== MÚSICA =====
        
        // Toggle música
        document.getElementById('toggleMusic').onclick = () => this.toggleMusicSidebar();
        
        // Fechar música
        document.getElementById('closeMusic').onclick = () => this.toggleMusicSidebar();
        
        // Controles do player
        document.getElementById('playPause').onclick = () => this.playPause();
        document.getElementById('nextTrack').onclick = () => this.playNextTrack();
        document.getElementById('prevTrack').onclick = () => this.playPrevTrack();
        
        // Sliders
        document.getElementById('volumeSlider').addEventListener('input', () => this.updateVolume());
        document.getElementById('progressSlider').addEventListener('input', () => this.updateProgressSlider());
        
        // Playlists
        document.querySelectorAll('.playlist-item').forEach(item => {
            item.addEventListener('click', () => {
                this.renderPlaylist(item.dataset.playlist);
            });
        });
        
        // Upload de música
        const uploadArea = document.getElementById('uploadArea');
        const audioUpload = document.getElementById('audioUpload');
        
        uploadArea.addEventListener('click', () => audioUpload.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#9b59b6';
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
            e.target.value = ''; // Resetar input
        });
        
        // ===== INSTALAÇÃO =====
        
        // Fechar instruções de instalação
        document.getElementById('closeInstallInstructions').onclick = () => {
            document.getElementById('installInstructionsModal').classList.remove('active');
        };

        // ===== GERAL =====
        
        // Fechar modais com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.getElementById('notebookModal').classList.remove('active');
                document.getElementById('editNotebookModal').classList.remove('active');
                document.getElementById('sheetModal').classList.remove('active');
                document.getElementById('confirmModal').classList.remove('active');
                document.getElementById('confirmNotebookModal').classList.remove('active');
                document.getElementById('installInstructionsModal').classList.remove('active');
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
        });

        // Fechar modais clicando fora
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    if (modal.id === 'editNotebookModal') {
                        this.editingNotebookId = null;
                    }
                }
            });
        });

        // Salvar ao sair da página
        window.addEventListener('beforeunload', (e) => {
            if (this.currentSheet) {
                const currentContent = editor.innerHTML;
                if (currentContent !== this.currentSheet.content) {
                    this.saveCurrentContent();
                    this.saveNotebooks();
                    // Em alguns navegadores, podemos mostrar um alerta
                    e.preventDefault();
                    e.returnValue = 'Você tem alterações não salvas. Tem certeza que deseja sair?';
                }
            }
            
            // Salvar configurações de música
            this.saveMusicSettings();
        });

        // Atualizar status da música quando houver erro
        this.audio.addEventListener('error', () => {
            this.showNotification('Erro ao carregar a música. Verifique o arquivo.', 'error');
            document.getElementById('musicStatusText').textContent = 'Erro';
            document.querySelector('#musicStatus i').style.color = '#e74c3c';
        });
    }
}

// Service Worker simplificado
const CACHE_NAME = 'notas-app-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;500;600&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Inicializar o app quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
    const app = new NotesApp();
    window.notesApp = app; // Para debugging
    
    // Verificar se há uma nova versão do service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('Controller changed - new service worker activated');
            window.location.reload();
        });
    }
    
    // Adicionar classes para animações de entrada
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
});