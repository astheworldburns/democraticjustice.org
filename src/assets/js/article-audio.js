(() => {
  const allowedRates = [0.75, 1, 1.25, 1.5, 1.75, 2];
  const statePrefix = "dj-audio-state:";
  const miniPrefix = "dj-audio-mini-dismiss:";

  function formatTime(value) {
    const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function spokenTime(value) {
    const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    return `${Math.floor(seconds / 60)} minutes, ${seconds % 60} seconds`;
  }

  function readState(key) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      return {
        position: saved?.version === 1 && Number.isFinite(saved.position) && saved.position > 0 ? saved.position : 0,
        rate: saved?.version === 1 && allowedRates.includes(saved.rate) ? saved.rate : 1
      };
    } catch {
      return { position: 0, rate: 1 };
    }
  }

  document.querySelectorAll("[data-article-audio]").forEach((root) => {
    const audio = root.querySelector("[data-audio-media]");
    const controls = root.querySelector("[data-audio-controls]");
    const play = root.querySelector("[data-audio-play]");
    const seek = root.querySelector("[data-audio-seek]");
    const speed = root.querySelector("[data-audio-speed]");
    const current = root.querySelector("[data-audio-current]");
    const duration = root.querySelector("[data-audio-duration]");
    const status = root.querySelector("[data-audio-status]");
    const skips = root.querySelectorAll("[data-audio-skip]");
    const resume = root.querySelector("[data-audio-resume]");
    const resumeTime = root.querySelector("[data-audio-resume-time]");
    const mini = root.querySelector("[data-audio-mini]");
    const miniPlay = root.querySelector("[data-audio-mini-play]");
    const miniTime = root.querySelector("[data-audio-mini-time]");
    const miniReturn = root.querySelector("[data-audio-mini-return]");
    const miniDismiss = root.querySelector("[data-audio-mini-dismiss]");

    // Retain the browser's controls if enhancement cannot initialize.
    if (!audio || !controls || !play || !seek || !speed || !current || !duration || !status) return;

    // A new uploaded recording has a new URL and therefore its own saved state.
    const source = audio.src;
    const stateKey = statePrefix + source;
    const miniKey = miniPrefix + source;
    const saved = readState(stateKey);
    let resumePosition = saved.position;
    let resumeApplied = false;
    let hasStarted = false;
    let playerVisible = true;
    let playIntent = false;
    let playEpoch = 0;
    let lastSavedAt = 0;
    let mediaSessionInstalled = false;
    let miniDismissed = false;
    try { miniDismissed = sessionStorage.getItem(miniKey) === "true"; } catch { /* Storage can be disabled. */ }

    speed.value = String(saved.rate);
    audio.playbackRate = saved.rate;
    if (resume && resumeTime && resumePosition > 0) {
      resumeTime.textContent = formatTime(resumePosition);
      resume.hidden = false;
    }

    function setStatus(message = "") {
      status.textContent = message;
    }

    function hasDuration() {
      return Number.isFinite(audio.duration) && audio.duration > 0;
    }

    function persist(force = false) {
      const now = Date.now();
      if (!force && now - lastSavedAt < 5000) return;
      lastSavedAt = now;
      let position = resumeApplied ? audio.currentTime : resumePosition;
      if (!Number.isFinite(position) || position < 0 || audio.ended || (hasDuration() && position >= Math.max(0, audio.duration - 5))) position = 0;
      try {
        localStorage.setItem(stateKey, JSON.stringify({ version: 1, position, rate: audio.playbackRate }));
      } catch { /* Listening still works when storage is blocked or full. */ }
    }

    function updateMediaPosition() {
      if (!mediaSessionInstalled || !hasDuration() || typeof navigator.mediaSession?.setPositionState !== "function") return;
      try {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate,
          position: Math.min(audio.duration, Math.max(0, audio.currentTime || 0))
        });
      } catch { /* Position reporting is optional across browsers. */ }
    }

    function syncMini() {
      if (!mini) return;
      mini.hidden = !hasStarted || playerVisible || audio.ended || Boolean(audio.error) || miniDismissed;
      document.body.classList.toggle("has-audio-mini", Boolean(document.querySelector("[data-audio-mini]:not([hidden])")));
    }

    function syncPlayback() {
      const playing = !audio.paused && !audio.ended;
      root.dataset.playing = String(playing);
      [play, miniPlay].filter(Boolean).forEach((button) => {
        button.setAttribute("aria-label", playing ? "Pause narration" : "Play narration");
        button.setAttribute("aria-pressed", String(playing));
      });
      if (mediaSessionInstalled) {
        try { navigator.mediaSession.playbackState = audio.ended || audio.error ? "none" : playing ? "playing" : "paused"; } catch { /* Optional API. */ }
      }
      syncMini();
    }

    function syncTimeline() {
      const available = hasDuration();
      const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      seek.disabled = !available;
      skips.forEach((button) => { button.disabled = !available; });
      seek.max = available ? String(audio.duration) : "0";
      seek.value = available ? String(position) : "0";
      seek.setAttribute("aria-valuetext", `${spokenTime(position)}${available ? ` of ${spokenTime(audio.duration)}` : ""}`);
      current.textContent = formatTime(position);
      duration.textContent = available ? formatTime(audio.duration) : "—:—";
      if (miniTime) miniTime.textContent = `${formatTime(position)}${available ? ` / ${formatTime(audio.duration)}` : ""}`;
      updateMediaPosition();
    }

    function applyResume() {
      if (resumeApplied || !playIntent || !hasDuration() || audio.readyState < 1) return;
      resumeApplied = true;
      const position = resumePosition < Math.max(0, audio.duration - 5) ? resumePosition : 0;
      if (position > 0) audio.currentTime = position;
      resumePosition = 0;
      if (resume) resume.hidden = true;
      syncTimeline();
    }

    function seekTo(value, fast = false) {
      if (!hasDuration() || !Number.isFinite(value)) return;
      const position = Math.min(audio.duration, Math.max(0, value));
      if (fast && typeof audio.fastSeek === "function") audio.fastSeek(position);
      else audio.currentTime = position;
      syncTimeline();
      persist(true);
    }

    function installMediaSession() {
      if (mediaSessionInstalled || !("mediaSession" in navigator)) return;
      mediaSessionInstalled = true;
      if (typeof window.MediaMetadata === "function") {
        try {
          const artwork = new URL(root.dataset.audioArtwork || "", window.location.href);
          navigator.mediaSession.metadata = new window.MediaMetadata({
            title: root.dataset.audioTitle || document.title,
            artist: root.dataset.audioAuthor || root.dataset.audioPublication || "Democratic Justice",
            album: `${root.dataset.audioPublication || "Democratic Justice"} · Audio edition`,
            artwork: ["http:", "https:"].includes(artwork.protocol) ? [{ src: artwork.href }] : []
          });
        } catch { /* Missing artwork or an unsupported metadata API must not block playback. */ }
      }
      const actions = {
        play: () => startPlayback(),
        pause: () => pausePlayback(),
        seekbackward: (details = {}) => seekTo(audio.currentTime - (Number.isFinite(details.seekOffset) && details.seekOffset > 0 ? details.seekOffset : 15)),
        seekforward: (details = {}) => seekTo(audio.currentTime + (Number.isFinite(details.seekOffset) && details.seekOffset > 0 ? details.seekOffset : 15)),
        seekto: (details = {}) => seekTo(details.seekTime, details.fastSeek)
      };
      Object.entries(actions).forEach(([action, handler]) => {
        try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Individual actions may be unsupported. */ }
      });
    }

    function pausePlayback() {
      playIntent = false;
      playEpoch += 1;
      audio.pause();
      setStatus();
      persist(true);
      syncPlayback();
    }

    async function startPlayback() {
      if (!audio.paused || playIntent) return;
      playIntent = true;
      const epoch = ++playEpoch;
      setStatus("Loading audio…");
      installMediaSession();
      applyResume();
      try {
        await audio.play();
        if (epoch === playEpoch) setStatus();
      } catch (error) {
        if (epoch !== playEpoch) return;
        playIntent = false;
        setStatus(error.name === "AbortError" ? "" : "Audio could not start. Try play again, or download the recording below.");
      }
      syncPlayback();
    }

    function togglePlayback() {
      if (!audio.paused || playIntent) pausePlayback();
      else startPlayback();
    }

    play.addEventListener("click", togglePlayback);
    miniPlay?.addEventListener("click", togglePlayback);
    resume?.addEventListener("click", () => startPlayback());
    seek.addEventListener("input", () => seekTo(Number(seek.value)));
    skips.forEach((button) => button.addEventListener("click", () => seekTo(audio.currentTime + Number(button.dataset.audioSkip))));
    speed.addEventListener("change", () => {
      if (allowedRates.includes(Number(speed.value))) {
        audio.playbackRate = Number(speed.value);
        updateMediaPosition();
        persist(true);
      }
    });

    miniReturn?.addEventListener("click", () => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      root.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      play.focus({ preventScroll: true });
    });
    miniDismiss?.addEventListener("click", () => {
      miniDismissed = true;
      try { sessionStorage.setItem(miniKey, "true"); } catch { /* Session storage can be disabled. */ }
      syncMini();
    });

    if (mini && typeof IntersectionObserver === "function") {
      new IntersectionObserver(([entry]) => {
        playerVisible = entry.isIntersecting;
        syncMini();
      }).observe(root);
    }

    audio.addEventListener("play", () => {
      playIntent = true;
      installMediaSession();
      applyResume();
      syncPlayback();
    });
    audio.addEventListener("playing", () => {
      hasStarted = true;
      setStatus();
      syncPlayback();
    });
    audio.addEventListener("pause", () => {
      playIntent = false;
      playEpoch += 1;
      if (!audio.error) setStatus();
      persist(true);
      syncPlayback();
    });
    audio.addEventListener("ended", () => {
      playIntent = false;
      playEpoch += 1;
      persist(true);
      syncPlayback();
    });
    ["loadedmetadata", "durationchange"].forEach((event) => audio.addEventListener(event, () => {
      applyResume();
      syncTimeline();
    }));
    audio.addEventListener("timeupdate", () => {
      syncTimeline();
      if (hasStarted) persist();
    });
    audio.addEventListener("seeked", () => {
      syncTimeline();
      persist(true);
    });
    audio.addEventListener("ratechange", () => {
      if (allowedRates.includes(audio.playbackRate)) speed.value = String(audio.playbackRate);
      updateMediaPosition();
      persist(true);
    });
    audio.addEventListener("waiting", () => {
      if (!audio.paused) setStatus("Loading audio…");
    });
    audio.addEventListener("error", () => {
      playIntent = false;
      playEpoch += 1;
      setStatus("This recording could not be loaded. You can keep reading or try downloading the audio.");
      controls.hidden = true;
      audio.hidden = false;
      audio.controls = true;
      syncPlayback();
    });
    window.addEventListener("pagehide", () => persist(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") persist(true);
    });

    syncPlayback();
    syncTimeline();
    audio.hidden = true;
    audio.controls = false;
    controls.hidden = false;
    root.dataset.audioEnhanced = "true";
  });
})();
