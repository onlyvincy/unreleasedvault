if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.error('SW failed:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
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
    // Player
    const audioBar = document.getElementById('audio-bar');
    const audioEl = document.getElementById('audio');
    const nowPlaying = document.getElementById('now-playing');
    const playBtn = document.getElementById('play-pause');
    const seekBar = document.getElementById('seek');
    const timerSpan = document.getElementById('timer');

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
        <small>★${b.rating} · ${b.tag} · ${new Date(b.date).toLocaleDateString()}</small>
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
                form['beat-bpm'].value = b.bpm;
                document.getElementById('beat-rating').value = b.rating;
                document.getElementById('beat-tag').value = b.tag;
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

    btnLibrary.addEventListener('click', () => {
        window.location.href = 'library.html';
    });

    // ——— Player init ———
    audioEl.addEventListener('loadedmetadata', () => seekBar.max = audioEl.duration);
    audioEl.addEventListener('timeupdate', () => {
        seekBar.value = audioEl.currentTime;
        timerSpan.textContent = formatTime(audioEl.currentTime);
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
        const name = form['beat-name'].value.trim();
        const bpm = form['beat-bpm'].value.trim();
        const rating = parseInt(document.getElementById('beat-rating').value, 10);
        const tag = document.getElementById('beat-tag').value;
        const notes = form['beat-notes'].value.trim();
        const editId = modal.getAttribute('data-edit-id');

        if (!name || !bpm) return;
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
                bpm: parseInt(bpm, 10),
                rating,
                tag,
                notes
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
                    bpm: parseInt(bpm, 10),
                    rating,
                    tag,
                    notes,
                    date: new Date().toISOString(),
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
});