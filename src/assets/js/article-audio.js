(() => {
  function formatTime(value) {
    const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function spokenTime(value) {
    const seconds = Math.max(0, Math.floor(value));
    return `${Math.floor(seconds / 60)} minutes, ${seconds % 60} seconds`;
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

    // Leave the browser's controls available if enhancement cannot initialize.
    if (!audio || !controls || !play || !seek || !speed || !current || !duration || !status) {
      return;
    }

    function setStatus(message = "") {
      status.textContent = message;
    }

    function syncPlayback() {
      const playing = !audio.paused && !audio.ended;
      root.dataset.playing = String(playing);
      play.setAttribute("aria-label", playing ? "Pause narration" : "Play narration");
      play.setAttribute("aria-pressed", String(playing));
    }

    function syncTimeline() {
      const hasDuration = Number.isFinite(audio.duration) && audio.duration > 0;
      const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      seek.disabled = !hasDuration;
      skips.forEach((button) => { button.disabled = !hasDuration; });
      seek.max = hasDuration ? String(audio.duration) : "0";
      seek.value = hasDuration ? String(position) : "0";
      seek.setAttribute("aria-valuetext", `${spokenTime(position)}${hasDuration ? ` of ${spokenTime(audio.duration)}` : ""}`);
      current.textContent = formatTime(position);
      duration.textContent = hasDuration ? formatTime(audio.duration) : "—:—";
    }

    play.addEventListener("click", async () => {
      if (!audio.paused) {
        audio.pause();
        return;
      }

      setStatus("Loading audio…");
      try {
        await audio.play();
        setStatus();
      } catch (error) {
        // A pause while playback is loading aborts play() normally.
        if (error.name !== "AbortError") {
          setStatus("Audio could not start. Try play again, or download the recording below.");
        } else {
          setStatus();
        }
        syncPlayback();
      }
    });

    seek.addEventListener("input", () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = Math.min(audio.duration, Math.max(0, Number(seek.value)));
        syncTimeline();
      }
    });

    skips.forEach((button) => {
      button.addEventListener("click", () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + Number(button.dataset.audioSkip)));
          syncTimeline();
        }
      });
    });

    speed.addEventListener("change", () => {
      const value = Number(speed.value);
      if (Number.isFinite(value) && value >= 0.75 && value <= 2) {
        audio.playbackRate = value;
      }
    });

    ["play", "pause", "ended"].forEach((event) => audio.addEventListener(event, syncPlayback));
    ["loadedmetadata", "durationchange", "timeupdate", "seeked"].forEach((event) => audio.addEventListener(event, syncTimeline));
    audio.addEventListener("playing", () => setStatus());
    audio.addEventListener("waiting", () => {
      if (!audio.paused) setStatus("Loading audio…");
    });
    audio.addEventListener("pause", () => {
      if (!audio.error) setStatus();
    });
    audio.addEventListener("error", () => {
      setStatus("This recording could not be loaded. You can keep reading or try downloading the audio.");
      // Restore a familiar browser fallback if the recording or custom playback fails.
      controls.hidden = true;
      audio.hidden = false;
      audio.controls = true;
    });

    syncPlayback();
    syncTimeline();
    audio.hidden = true;
    audio.controls = false;
    controls.hidden = false;
    root.dataset.audioEnhanced = "true";
  });
})();
