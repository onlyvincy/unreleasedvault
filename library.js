document.addEventListener('DOMContentLoaded', async () => {
    // Selettori principali
    const grid = document.getElementById('library-grid');
    const audioBar = document.getElementById('audio-bar');
    const audioEl = document.getElementById('audio');
    const nowPlaying = document.getElementById('now-playing');
    const playBtn = document.getElementById('play-pause');
    const seekBar = document.getElementById('seek');
    const timerSpan = document.getElementById('timer');

    // Bottoni nav
    document.getElementById('home-btn-lib').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    document.getElementById('add-btn-lib').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Helper time format
    function formatTime(sec) {
        const m = Math.floor(sec / 60), s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    // Setup player events
    audioEl.addEventListener('loadedmetadata', () => seekBar.max = audioEl.duration);
    audioEl.addEventListener('timeupdate', () => {
        seekBar.value = audioEl.currentTime;
        timerSpan.textContent = formatTime(audioEl.currentTime);
    });
    seekBar.addEventListener('input', () => audioEl.currentTime = seekBar.value);
    playBtn.addEventListener('click', () => {
        if (audioEl.paused) { audioEl.play(); playBtn.textContent = '⏸'; }
        else { audioEl.pause(); playBtn.textContent = '▶'; }
    });

    // Fetch e render di tutte le card
    try {
        const { data, error } = await supabase
            .from('beats')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;

        data.forEach(b => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
  <h2>${b.name}</h2>
  <div class="meta">
    ${b.bpm} bpm • Rating: ${b.rating} ★ • ${b.tag}
  </div>
  <button class="play-card">${b.url ? '▶ Play' : '— Nessun file'}</button>
`;

            const btn = card.querySelector('.play-card');
            if (!b.url) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            }
            btn.addEventListener('click', () => {
                if (!b.url) return;
                audioEl.src = b.url;
                audioEl.play();
                playBtn.textContent = '⏸';
                nowPlaying.textContent = b.name;
                seekBar.value = 0;
                timerSpan.textContent = '0:00';
                audioBar.classList.remove('hidden');
            });
            grid.appendChild(card);
        });

    } catch (err) {
        console.error('Errore caricamento library:', err);
        grid.innerHTML = '<p style="padding:1rem; text-align:center; color:#f55;">Errore caricamento dati.</p>';
    }
});
