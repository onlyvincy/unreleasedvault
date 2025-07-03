document.addEventListener('DOMContentLoaded', () => {
    // ——— Stato globale ———
    let beats = [];

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
    // semantica + focus
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');

    li.innerHTML = `
      <button class="play-btn">▶</button>
      <div class="info">
        <strong>${b.name}</strong>
        <small>★${b.rating} · ${b.tag} · ${new Date(b.date).toLocaleDateString()}</small>
  
      </div>
    `;

    


    // unica funzione di play
    const playBeat = () => {
      if (!b.url) return;
      audioEl.src = b.url;
      audioEl.play();
      playBtn.textContent = '❚❚';
      nowPlaying.textContent = b.name;
      audioBar.classList.remove('hidden');
    };

    // click sul bottone
   

    // click su tutta la riga
    li.addEventListener('click', () => {playBeat(); nowPlaying.textContent = b.name;});
    // supporto tastiera (invio / spazio)
    li.addEventListener('keypress', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        playBeat();
      }
    });

    listEl.appendChild(li);
  });
}


    // ——— Load da DB ———
    async function loadBeatsFromDB() {
        try {
            const { data, error } = await supabase
                .from('beats')
                .select('*')
                .order('date', { ascending: false });
            if (error) throw error;
            beats = data;            // aggiorni il globale
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
        if (audioEl.paused) { audioEl.play(); playBtn.textContent = '❚❚'; }
        else { audioEl.pause(); playBtn.textContent = '▶'; }
    });

    // ——— Submit handler ———
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const name = form['beat-name'].value.trim();
        const bpm = form['beat-bpm'].value.trim();
        const rating = parseInt(document.getElementById('beat-rating').value, 10);
        const tag = document.getElementById('beat-tag').value;
        const notes = form['beat-notes'].value.trim();

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
        const { data: dbData, error: dbErr } = await supabase
            .from('beats')
            .insert([{
                name,
                bpm: parseInt(bpm, 10),
                rating,           // ←
                tag,              // ←
                notes,
                date: new Date().toISOString(),
                url: fileURL
            }]);

        // reinvoca il load per avere tutto aggiornato
        await loadBeatsFromDB();
        form.reset();
        modal.classList.add('hidden');
    });

    // ——— Modal & init ———
    btnAdd.addEventListener('click', () => modal.classList.remove('hidden'));
    btnClose.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

    // **avvia tutto**
    loadBeatsFromDB();


    
});
