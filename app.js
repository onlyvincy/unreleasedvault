if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.error('SW failed:', err));
    });
}

async function initApp() {
    // ——— Stato globale ———
    let beats = [];
    let currentPlayingName = null; // Per evidenziare la card in play

    // ——— Selettori ———
    const counterEl = document.getElementById('counter');
    const progressEl = document.getElementById('progress');
    const summaryEl = document.getElementById('summary');
    const listEl = document.getElementById('beat-list');
    const modal = document.getElementById('modal');
    const btnAdd = document.getElementById('add-btn');
    const btnClose = document.getElementById('close-modal');
    const form = document.getElementById('beat-form');
    const btnLibrary = document.getElementById('library-btn');
    const btnSearch = document.getElementById('search-btn');
    // Player
    const audioBar = document.getElementById('audio-bar');
    const audioEl = document.getElementById('audio');
    const nowPlaying = document.getElementById('now-playing');
    const playBtn = document.getElementById('play-pause');
    const seekBar = document.getElementById('seek');
    const timerSpan = document.getElementById('timer');
    

  const fileInput = document.getElementById('beat-file');
  const nameInput = document.getElementById('beat-name');
const titleEl = document.getElementById('beat-title');
  const dateInput = document.getElementById('beat-date');

 // 1) Utente modifica l’H2 → aggiorno automaticamente l’input hidden
    titleEl.addEventListener('input', () => {
    nameInput.value = titleEl.innerText.trim();
  });
   // 2) Se arrivi in init già con un valore (es: drag & drop), ripopolo subito l’H2
  if (nameInput.value) {
    titleEl.innerText = nameInput.value;
  }
    // ——— Helpers ———
    function getLastMonday() {
        const now = new Date(), d = now.getDay();
        const diff = now.getDate() - d + (d === 0 ? -6 : 1);
        return new Date(now.setDate(diff));
    }
    function formatTime(sec) {
        const m = Math.floor(sec / 60), s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    // ——— Render ———
    function renderDashboard() {
        const monday = getLastMonday();
        const thisWeek = beats.filter(b => new Date(b.date) >= monday);
        const count = thisWeek.length;
        const pct = Math.min(100, Math.round((count / 20) * 100));
        counterEl.innerHTML = `
  <span class="count">${count}</span>
  <span class="slash" style="font-weight:100;">/</span>
  <span class="total">20</span>
  <p style="font-family: Inter; font-size:12px; letter-spacing:0px; margin-bottom: 16px;">Beat/Sample Completati</p>
`;
        progressEl.style.width = pct + '%';
        summaryEl.textContent = `${pct}% Done — Ti rimangono ${Math.max(0, 7 - count)} giorni`;
    }

    function renderList() {
        listEl.innerHTML = '';
        beats.slice(0, 5).forEach(b => {
            const li = document.createElement('li');
            li.className = 'beat-item';
            li.setAttribute('role', 'button');
            li.setAttribute('tabindex', '0');
            if (b.name === currentPlayingName) { li.classList.add('playing'); };

            li.innerHTML = `
            <img class="playing-gif" src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWZsbzB3MGhsaW5jdWNwZHJlYjhvdnRrdGt5NHVxamVxMDd3cmVyZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/9VkaGX5OKCjrjjNi98/giphy.gif" alt="In riproduzione" />
      <button class="play-btn">▶</button>
      <div class="info">
        <strong>${b.name}</strong>
        <small>★${b.rating} · ${b.tag} · ${(Array.isArray(b.artists) ? b.artists.join(', ') : b.artists || '')} · ${new Date(b.date).toLocaleDateString()}</small>
      </div>
      
      <div class="menu-container" style="position:relative;display:inline-block;">
        <button class="menu-btn" aria-label="Azioni" style="background:none;border:none;font-size:20px;cursor:pointer;">⋯</button>
        <ul class="menu-list" style="display:none;position:absolute;right:0;top:24px;background:#fff;border:1px solid #ddd;list-style:none;padding:0;margin:0;z-index:10;">
          <li><button class="edit-btn" style="width:100%;border:none;background:none;padding:8px 16px;cursor:pointer;">✏️ Modifica</button></li>
          <li><button class="delete-btn" style="width:100%;border:none;background:none;padding:8px 16px;cursor:pointer;color:#c00;">🗑️ Elimina</button></li>
        </ul>
      </div>
    `;

            // Play function
            const playBeat = () => {
                if (!b.url) return;
                audioEl.src = b.url;
                audioEl.play();
                playBtn.textContent = '❚❚';
                nowPlaying.textContent = b.name;
                audioBar.classList.remove('hidden');
                currentPlayingName = b.name;
                renderList();
            };

            li.addEventListener('click', e => {
                if (e.target.closest('.menu-container')) return;
                playBeat();
                nowPlaying.textContent = b.name;
            });
            li.addEventListener('keypress', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    playBeat();
                }
            });

            // Gestione menu tre pallini
            const menuBtn = li.querySelector('.menu-btn');
            const menuList = li.querySelector('.menu-list');
            menuBtn.addEventListener('click', e => {
                e.stopPropagation();
                document.querySelectorAll('.menu-list').forEach(ml => ml.style.display = 'none');
                menuList.style.display = menuList.style.display === 'block' ? 'none' : 'block';
            });

            // Edit
            li.querySelector('.edit-btn').addEventListener('click', async e => {
                e.stopPropagation();
                form['beat-name'].value = b.name;
                form['beat-date'].value = b.date ? b.date.split('T')[0] : '';
                document.getElementById('beat-rating').value = b.rating;
                document.getElementById('beat-tag').value = b.tag;
                form['beat-artists'].value = Array.isArray(b.artists) ? b.artists.join(', ') : (b.artists || "OnlyVincy");
                form['beat-notes'].value = b.notes || '';
                modal.setAttribute('data-edit-id', b.name);
                modal.classList.remove('hidden');
                menuList.style.display = 'none';
            });

            // Delete
            li.querySelector('.delete-btn').addEventListener('click', async e => {
                e.stopPropagation();
                if (confirm('Sei sicuro di voler eliminare questo beat/sample?')) {
                    const { error } = await supabase.from('beats').delete().eq('name', b.name);
                    if (error) {
                        alert('Errore durante l\'eliminazione: ' + error.message);
                        return;
                    }
                    await loadBeatsFromDB();
                }
                menuList.style.display = 'none';
            });

            listEl.appendChild(li);
        });
    }

    // Chiudi tutti i menu-list cliccando fuori
    document.addEventListener('click', e => {
        document.querySelectorAll('.menu-list').forEach(ml => ml.style.display = 'none');
    });

    // ——— Load da DB ———
    async function loadBeatsFromDB() {
        try {
            const { data, error } = await supabase
                .from('beats')
                .select('*')
                .order('date', { ascending: false });
            if (error) throw error;
            beats = data;
            renderDashboard();
            renderList();
        } catch (err) {
            console.error('❌ Errore caricamento beats da DB:', err);
        }
    }

    fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    nameInput.value = file.name.replace(/\.[^/.]+$/, '');
    titleEl.innerText = nameInput.value;
     // auto-fill date from file.lastModified
  const modDate = new Date(file.lastModified);
  // format as YYYY-MM-DD for input[type=date]
  dateInput.value = modDate.toISOString().split('T')[0];
  });



    btnLibrary.addEventListener('click', () => {
        window.location.href = 'library.html';
    });

    btnSearch.addEventListener('click', () => {
        window.location.href = 'search.html';
    });

    // ——— Player init ———
    audioEl.addEventListener('loadedmetadata', () => seekBar.max = audioEl.duration);
    audioEl.addEventListener('timeupdate', () => {
        seekBar.value = audioEl.currentTime;
    
    });
    seekBar.addEventListener('input', () => audioEl.currentTime = seekBar.value);
    playBtn.addEventListener('click', () => {
        if (audioEl.paused) {
            audioEl.play();
            playBtn.textContent = '❚❚';
        } else {
            audioEl.pause();
            playBtn.textContent = '▶';
        }
    });
    audioEl.addEventListener('ended', () => {
        currentPlayingName = null;
        renderList();
        playBtn.textContent = '▶';
    });

    // ——— Submit handler ———
    form.addEventListener('submit', async e => {
        e.preventDefault();
     
        const text = titleEl.innerText.trim();
        console.log(form['beat-name']);
        const name = form['beat-name'].value.trim();
        const date = form['beat-date'].value;
        const rating = parseInt(document.getElementById('beat-rating').value, 10);
        const tag = document.getElementById('beat-tag').value;
        const notes = form['beat-notes'].value.trim();
        // ARTISTS AS ARRAY
        const artistsRaw = form['beat-artists'] ? form['beat-artists'].value : "OnlyVincy";
        const artists = artistsRaw
            .split(',')
            .map(a => a.trim())
            .filter(a => a.length > 0);
        const editId = modal.getAttribute('data-edit-id');
         // validazione come prima
  if (!text) {
    e.preventDefault();
    titleEl.focus();
    return alert('Devi inserire un titolo!');
  }

   // copia nel tuo input “ufficiale”
  document.getElementById('beat-name').value = text;
        if (!name || !date) return;
        let fileURL = null;
        const file = form['beat-file'].files[0];

        if (file) {
            const path = `${Date.now()}_${file.name}`;
            const { error: upErr } = await supabase.storage.from('mp3s').upload(path, file);
            if (upErr) { console.error(upErr); return; }
            const { data: urlData } = supabase.storage.from('mp3s').getPublicUrl(path);
            fileURL = urlData.publicUrl;
        }

        if (editId) {
            // UPDATE
            const updateData = {
                name,
                date,
                rating,
                tag,
                notes,
                artists
            };
            if (fileURL) updateData.url = fileURL;
            const { error } = await supabase.from('beats').update(updateData).eq('name', editId);
            if (error) {
                alert('Errore durante la modifica: ' + error.message);
                return;
            }
        } else {
            // INSERT
            await supabase
                .from('beats')
                .insert([{
                    name,
                    date,
                    rating,
                    tag,
                    notes,
                    artists,
                    url: fileURL
                }]);
        }

        await loadBeatsFromDB();
        form.reset();
        modal.classList.add('hidden');
        modal.removeAttribute('data-edit-id');
    });

    // ——— Modal & init ———
    btnAdd.addEventListener('click', () => {
        form.reset();
        modal.removeAttribute('data-edit-id');
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        form['beat-date'].value = today;
        form['beat-artists'].value = "OnlyVincy";
        modal.classList.remove('hidden');
    });
    btnClose.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.removeAttribute('data-edit-id');
    });
    modal.addEventListener('click', e => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            modal.removeAttribute('data-edit-id');
        }
    });

    // **avvia tutto**
    loadBeatsFromDB();

    // ...existing code...

// === Refactoring Big Player ===
// Assicurati che esista già:
// const audioEl      = document.getElementById('audio');
// const audioBar     = document.getElementById('audio-bar');
// funzione helper già definita:
// function formatTime(sec) { const m=Math.floor(sec/60), s=Math.floor(sec%60).toString().padStart(2,'0'); return `${m}:${s}`; }
// selettori principali
// selettori
const bpModal       = document.getElementById('big-player-modal');
const bpClose       = document.getElementById('bp-close');

const bpAlbumTitle  = document.getElementById('bp-album-title');
const bpTrackTitle  = document.getElementById('bp-track-title');
const bpArtist      = document.getElementById('bp-artist');
const bpExplicit    = document.getElementById('bp-explicit');

const bpCurrentTime = document.getElementById('bp-current-time');
const bpDuration    = document.getElementById('bp-duration');
const bpSeek        = document.getElementById('bp-seek');

const bpPlay        = document.getElementById('bp-play');



// helper per formattare i tempi
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// quando apro il big player
audioBar.addEventListener('click', (e) => {
    if ( e.target.closest('#play-pause') || e.target.closest('#seek') ) return;
  const beat = beats.find(b => b.name === currentPlayingName);
    
  if (!beat) return;

  // testo dinamico
  bpAlbumTitle.textContent   = beat.album || '—';
  bpTrackTitle.textContent   = beat.name;
  bpArtist.textContent       = Array.isArray(beat.artists)
                                ? beat.artists.join(', ')
                                : beat.artists || '';
  if (beat.explicit) {
    bpExplicit.classList.remove('hidden');
  } else {
    bpExplicit.classList.add('hidden');
  }

  // sync iniziale seek & durata
  bpSeek.max               = audioEl.duration || 0;
  bpSeek.value             = audioEl.currentTime || 0;
  bpCurrentTime.textContent = formatTime(audioEl.currentTime);
  bpDuration.textContent    = formatTime(audioEl.duration || 0);

  bpModal.classList.remove('hidden');
});

// chiudi modal
bpClose.addEventListener('click', () => bpModal.classList.add('hidden'));
bpModal.addEventListener('click', e => {
  if (e.target === bpModal) bpModal.classList.add('hidden');
});

// play / pause
bpPlay.addEventListener('click', () => {
  if (audioEl.paused) {
    audioEl.play();
    bpPlay.textContent = '❚❚';
  } else {
    audioEl.pause();
    bpPlay.textContent = '▶';
  }
});

// aggiorno seek & timer mentre suona
audioEl.addEventListener('timeupdate', () => {
  if (!bpModal.classList.contains('hidden')) {
    bpSeek.value              = audioEl.currentTime;
    bpCurrentTime.textContent = formatTime(audioEl.currentTime);
  }
});

// interazione seek
bpSeek.addEventListener('input', () => {
  audioEl.currentTime = bpSeek.value;
});


//drop dei file mp3
// ——— Drag & Drop con overlay animato ———
let dragCounter = 0;
const dragOverlay        = document.getElementById('drag-overlay');
const dragOverlayContent = document.getElementById('drag-overlay-content');

document.addEventListener('dragenter', e => {
  e.preventDefault();
  dragCounter++;
  // mostro overlay solo se sto trascinando file
  if (Array.from(e.dataTransfer.items).some(i => i.kind === 'file')) {
    dragOverlay.classList.remove('hidden');
    dragOverlayContent.classList.remove('animate__fadeOut');
    dragOverlayContent.classList.add('animate__fadeIn');
  }
});

document.addEventListener('dragleave', e => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) {
    // animazione di uscita
    dragOverlayContent.classList.remove('animate__fadeIn');
    dragOverlayContent.classList.add('animate__fadeOut');
    dragOverlayContent.addEventListener('animationend', () => {
      dragOverlay.classList.add('hidden');
    }, { once: true });
  }
});

document.addEventListener('dragover', e => {
  e.preventDefault();  // necessario per abilitare il drop
});

document.addEventListener('drop', e => {
  e.preventDefault();
  dragCounter = 0;
  dragOverlay.classList.add('hidden');

  // prendo il primo .mp3 e lo inietto nel fileInput
  const files = Array.from(e.dataTransfer.files);
  const mp3 = files.find(f => f.type === 'audio/mpeg' || f.name.endsWith('.mp3'));
  if (!mp3) return;

  const dt = new DataTransfer();
  dt.items.add(mp3);
  fileInput.files = dt.files;

  // scatta il tuo listener di change per name/date
  fileInput.dispatchEvent(new Event('change'));

  // apro il modal in insert-mode
  modal.removeAttribute('data-edit-id');
  modal.classList.remove('hidden');
});



}

initApp();