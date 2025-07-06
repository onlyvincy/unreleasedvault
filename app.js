if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.error('SW failed:', err));
    });
}

// === Netlify Credentials ===
const NETLIFY_TOKEN = "nfp_Qa6ubTtpbTSpPjsmh7ZywJq1BKSzPzKrd314";
const SITE_ID = "4853be8f-7cc0-46bd-b3f2-6b6dd53a247f";
const NETLIFY_URL = "earnest-choux-45b55b.netlify.app";

// === Netlify MP3 Upload Function ===
async function sha1hex(buf){
  const h = await crypto.subtle.digest("SHA-1", buf);
  return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function uploadMp3ViaNetlify(file){
  /* 1️⃣  hash + start a production deploy */
  const buf  = await file.arrayBuffer();
  const hash = await sha1hex(buf);
  const key  = `audio/${file.name}`;               // path inside your site

  const deploy = await fetch(
    `https://api.netlify.com/api/v1/sites/${SITE_ID}/deploys?production=true`,
    {
      method : "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${NETLIFY_TOKEN}`
      },
      body   : JSON.stringify({ files: { [key]: hash } })
    }
  ).then(r => r.ok ? r.json()
                   : r.text().then(t => { throw new Error("Deploy: "+t); }));

  /* 2️⃣  Netlify says which hashes it still needs */
  if (deploy.required && deploy.required.includes(hash)){
    const safePath = `audio/${encodeURIComponent(file.name)}`; // encode filename only
    const putURL   = `https://api.netlify.com/api/v1/deploys/${deploy.id}/files/${safePath}`;

    const put = await fetch(putURL, {
      method : "PUT",
      headers: {
        "Content-Type": "audio/mpeg",
        "Authorization": `Bearer ${NETLIFY_TOKEN}`
      },
      body   : buf
    });
    if (!put.ok) throw new Error("Upload: "+await put.text());
  }

  /* 3️⃣  done — give back the playable URL */
  return `https://${NETLIFY_URL}/audio/${encodeURIComponent(file.name)}`;
}

async function initApp() {
    // ——— Stato globale ———
    let beats = [];
    let currentPlayingName = null;

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

    // H2 → input hidden
    titleEl.addEventListener('input', () => {
        nameInput.value = titleEl.innerText.trim();
    });
    if (nameInput.value) {
        titleEl.innerText = nameInput.value;
    }

    function getLastMonday() {
        const now = new Date(), d = now.getDay();
        const diff = now.getDate() - d + (d === 0 ? -6 : 1);
        return new Date(now.setDate(diff));
    }
    function formatTime(sec) {
        const m = Math.floor(sec / 60), s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

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

            const menuBtn = li.querySelector('.menu-btn');
            const menuList = li.querySelector('.menu-list');
            menuBtn.addEventListener('click', e => {
                e.stopPropagation();
                document.querySelectorAll('.menu-list').forEach(ml => ml.style.display = 'none');
                menuList.style.display = menuList.style.display === 'block' ? 'none' : 'block';
            });

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

    document.addEventListener('click', e => {
        document.querySelectorAll('.menu-list').forEach(ml => ml.style.display = 'none');
    });

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
        dateInput.value = new Date().toISOString().split('T')[0];
    });

    btnLibrary.addEventListener('click', () => {
        window.location.href = 'library.html';
    });

    btnSearch.addEventListener('click', () => {
        window.location.href = 'search.html';
    });

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

    // ——— Submit handler (UPLOAD via NETLIFY, save URL in Supabase DB) ———
    form.addEventListener('submit', async e => {
        e.preventDefault();

        const text = titleEl.innerText.trim();
        const name = form['beat-name'].value.trim();
        const date = form['beat-date'].value;
        const rating = parseInt(document.getElementById('beat-rating').value, 10);
        const tag = document.getElementById('beat-tag').value;
        const notes = form['beat-notes'].value.trim();
        const artistsRaw = form['beat-artists'] ? form['beat-artists'].value : "OnlyVincy";
        const artists = artistsRaw
            .split(',')
            .map(a => a.trim())
            .filter(a => a.length > 0);
        const editId = modal.getAttribute('data-edit-id');

        if (!text) {
            e.preventDefault();
            titleEl.focus();
            return alert('Devi inserire un titolo!');
        }

        document.getElementById('beat-name').value = text;
        if (!name || !date) return;
        let fileURL = null;
        const file = form['beat-file'].files[0];

        if (file) {
            try {
                fileURL = await uploadMp3ViaNetlify(file);
            } catch (err) {
                alert('Errore upload MP3 su Netlify: ' + err.message);
                return;
            }
        }

        if (editId) {
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

    btnAdd.addEventListener('click', () => {
        form.reset();
        modal.removeAttribute('data-edit-id');
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

    loadBeatsFromDB();

    // === Big Player ===
    const bpModal = document.getElementById('big-player-modal');
    
const bpSheet   = document.getElementById('big-player-content'); // the sliding card
    const bpShare = document.getElementById("bp-share");

    const bpClose = document.getElementById('bp-close');
    const bpAlbumTitle = document.getElementById('bp-album-title');
    const bpTrackTitle = document.getElementById('bp-track-title');
    const bpArtist = document.getElementById('bp-artist');
    const bpExplicit = document.getElementById('bp-explicit');
    const bpCurrentTime = document.getElementById('bp-current-time');
    const bpDuration = document.getElementById('bp-duration');
    const bpSeek = document.getElementById('bp-seek');
    const bpPlay = document.getElementById('bp-play');

    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }


    function openBigPlayer() {
    bpModal.classList.remove('hidden');
    // Wait one frame so the browser registers the state change
    requestAnimationFrame(() => {
        bpModal.classList.add('visible');
    });
}

function closeBigPlayer() {
    bpModal.classList.remove('visible');
    setTimeout(() => bpModal.classList.add('hidden'), 350); // Matches CSS duration
}
if (bpShare) {
  bpShare.addEventListener("click", async () => {
    // Trova il beat corrente
    const beat = beats[currentIndex];
    if (!beat || !beat.url) return alert("Nessun file da condividere!");

    try {
      // Scarica il file mp3 come blob
      const resp = await fetch(beat.url);
      if (!resp.ok) throw new Error("Errore nel download MP3");
      const blob = await resp.blob();

      // File oggetto per share API
      const file = new File([blob], beat.name + ".mp3", { type: "audio/mpeg" });

      // Web Share API 2.0
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: beat.name,
          files: [file],
        });
      } else {
        // Fallback: Download diretto
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = beat.name + ".mp3";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(a.href);
        }, 1000);
        alert("La condivisione non è supportata su questo dispositivo. File scaricato.");
      }
    } catch (err) {
      alert("Errore durante la condivisione: " + err.message);
    }
  });
}


    audioBar.addEventListener('click', (e) => {
    if (e.target.closest('#play-pause') || e.target.closest('#seek')) return;
    const beat = beats.find(b => b.name === currentPlayingName);

    if (!beat) return;

    bpAlbumTitle.textContent = beat.album || '—';
    bpTrackTitle.textContent = beat.name;
    bpArtist.textContent = Array.isArray(beat.artists)
        ? beat.artists.join(', ')
        : beat.artists || '';
    if (beat.explicit) {
        bpExplicit.classList.remove('hidden');
    } else {
        bpExplicit.classList.add('hidden');
    }

    bpSeek.max = audioEl.duration || 0;
    bpSeek.value = audioEl.currentTime || 0;
    bpCurrentTime.textContent = formatTime(audioEl.currentTime);
    bpDuration.textContent = formatTime(audioEl.duration || 0);

    openBigPlayer();
});

bpClose.addEventListener('click', () => closeBigPlayer());
bpModal.addEventListener('click', e => {
    if (e.target === bpModal) closeBigPlayer();
});

    bpPlay.addEventListener('click', () => {
        if (audioEl.paused) {
            audioEl.play();
            bpPlay.textContent = '❚❚';
        } else {
            audioEl.pause();
            bpPlay.textContent = '▶';
        }
    });

    audioEl.addEventListener('timeupdate', () => {
        if (!bpModal.classList.contains('hidden')) {
            bpSeek.value = audioEl.currentTime;
            bpCurrentTime.textContent = formatTime(audioEl.currentTime);
        }
    });

    bpSeek.addEventListener('input', () => {
        audioEl.currentTime = bpSeek.value;
    });

    // >>> PASTE THE SWIPE DOWN CODE HERE <<<
/* ----- swipe-down-to-close for the player card ----- */

let startY = 0, deltaY = 0, dragging = false;

/* helper */
function resetSheet() {
  bpSheet.style.transition = '';
  bpSheet.style.transform  = '';
  bpModal.style.opacity    = '';
}

/* pointer + touch start */
function dragStart(clientY){
  startY   = clientY;
  deltaY   = 0;
  dragging = true;
  bpSheet.style.transition = 'none';
}

/* pointer + touch move */
function dragMove(clientY){
  if (!dragging) return;
  deltaY = clientY - startY;
  if (deltaY > 0){                                  // only downward
    bpSheet.style.transform = `translateY(${deltaY}px)`;
    bpModal.style.opacity   = 1 - Math.min(deltaY/250,1);
  }
}

/* pointer + touch end */
function dragEnd(){
  if (!dragging) return;
  bpSheet.style.transition = '';                    // re-enable snap
  if (deltaY > 120){
    closeBigPlayer();
  } else {
    resetSheet();
  }
  dragging = false;
}

/* --- pointer events (desktop + mobile modern browsers) --- */
bpSheet.addEventListener('pointerdown',   e => { if(e.button===0) dragStart(e.clientY); });
bpSheet.addEventListener('pointermove',   e => dragMove(e.clientY));
bpSheet.addEventListener('pointerup',     dragEnd);
bpSheet.addEventListener('pointercancel', dragEnd);

/* --- fallback for older iOS Safari (touch events only) --- */
bpSheet.addEventListener('touchstart', e => dragStart(e.touches[0].clientY), {passive:false});
bpSheet.addEventListener('touchmove',  e => { e.preventDefault(); dragMove(e.touches[0].clientY); }, {passive:false});
bpSheet.addEventListener('touchend',   dragEnd);
    // ——— Drag & Drop Overlay ———
    let dragCounter = 0;
    const dragOverlay = document.getElementById('drag-overlay');
    const dragOverlayContent = document.getElementById('drag-overlay-content');

    document.addEventListener('dragenter', e => {
        e.preventDefault();
        dragCounter++;
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