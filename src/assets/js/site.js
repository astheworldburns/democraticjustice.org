(() => {
  const storageKey = "theme";
  const hapticsStorageKey = "dj-haptics";
  const root = document.documentElement;
  const labelNodes = document.querySelectorAll("[data-theme-label]");
  const themeColorMeta = document.querySelector("[data-theme-color]");
  const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");

  function canUseHaptics() {
    if (typeof navigator.vibrate !== "function") {
      return false;
    }

    if (reduceMotionQuery.matches || !coarsePointerQuery.matches) {
      return false;
    }

    return localStorage.getItem(hapticsStorageKey) !== "off";
  }

  function triggerHaptic(kind = "light") {
    if (!canUseHaptics()) {
      return;
    }

    const patterns = {
      light: 8,
      medium: 12,
      confirm: 18
    };

    navigator.vibrate(patterns[kind] || patterns.light);
  }

  function preferredTheme() {
    const storedTheme = localStorage.getItem(storageKey);

    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    return systemQuery.matches ? "dark" : "light";
  }

  function syncThemeColor() {
    if (!themeColorMeta) {
      return;
    }

    const computed = getComputedStyle(root).getPropertyValue("--color-bg-page").trim();
    if (computed) {
      themeColorMeta.setAttribute("content", computed);
    }
  }

  function syncProofMarks(theme) {
    document.querySelectorAll("[data-proof-mark]").forEach((node) => {
      const nextSrc = theme === "dark"
        ? node.dataset.proofMarkNight || node.dataset.proofMarkDay
        : node.dataset.proofMarkDay;

      if (nextSrc && node.getAttribute("src") !== nextSrc) {
        node.setAttribute("src", nextSrc);
      }
    });
  }

  function syncThemeLabel(theme) {
    labelNodes.forEach((node) => {
      node.textContent = theme === "dark" ? "Day edition" : "Night edition";
    });
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    syncThemeLabel(theme);
    syncThemeColor();
    syncProofMarks(theme);
  }

  applyTheme(preferredTheme());

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem(storageKey, nextTheme);
      applyTheme(nextTheme);
    });
  });

  const editionDateNodes = document.querySelectorAll("[data-edition-date]");

  if (editionDateNodes.length) {
    const editionFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
    const editionText = editionFormatter.format(new Date());

    editionDateNodes.forEach((node) => {
      node.textContent = editionText;
    });
  }

  systemQuery.addEventListener("change", (event) => {
    if (!localStorage.getItem(storageKey)) {
      applyTheme(event.matches ? "dark" : "light");
    }
  });

  window.addEventListener("beforeprint", () => {
    document.querySelectorAll("[data-proof-mark]").forEach((node) => {
      const printSrc = node.dataset.proofMarkPrint;

      if (printSrc) {
        node.setAttribute("src", printSrc);
      }
    });
  });

  window.addEventListener("afterprint", () => {
    applyTheme(preferredTheme());
  });

  const articleRoot = document.querySelector("[data-reading-root]");
  const progressBar = document.querySelector("[data-reading-progress]");

  if (articleRoot && progressBar) {
    const updateProgress = () => {
      const articleTop = articleRoot.offsetTop;
      const articleHeight = articleRoot.offsetHeight;
      const viewportHeight = window.innerHeight;
      const distance = Math.max(articleHeight - viewportHeight, 1);
      const progress = Math.min(Math.max((window.scrollY - articleTop) / distance, 0), 1);
      progressBar.style.width = `${progress * 100}%`;
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
  }

  document.querySelectorAll("[data-copy-link]").forEach((button) => {
    button.addEventListener("click", async () => {
      const defaultLabel = button.dataset.copyLabelDefault || "Copy link";
      const successLabel = button.dataset.copyLabelSuccess || "Link copied";
      const copyValue = button.dataset.copyValue || window.location.href;

      try {
        await navigator.clipboard.writeText(copyValue);
        triggerHaptic("confirm");
        button.textContent = successLabel;
        window.setTimeout(() => {
          button.textContent = defaultLabel;
        }, 1800);
      } catch {
        button.textContent = "Copy failed";
      }
    });
  });

  document.querySelectorAll("[data-print-page]").forEach((button) => {
    button.addEventListener("click", () => window.print());
  });

  document.querySelectorAll("[data-share-page]").forEach((button) => {
    if (!navigator.share) {
      button.hidden = true;
      return;
    }

    button.hidden = false;
    button.addEventListener("click", async () => {
      const shareTitle = button.dataset.shareTitle || document.title;
      const shareUrl = button.dataset.shareUrl || window.location.href;

      try {
        await navigator.share({
          title: shareTitle,
          url: shareUrl
        });
        triggerHaptic("confirm");
      } catch {
        // Ignore cancelled shares.
      }
    });
  });

  document.querySelectorAll("[data-haptic]").forEach((element) => {
    element.addEventListener("click", () => {
      triggerHaptic(element.dataset.haptic || "light");
    });
  });

  document.querySelectorAll("[data-popup-form]").forEach((form) => {
    form.addEventListener("submit", () => {
      const popupUrl = form.dataset.popupUrl;
      const popupName = form.dataset.popupName || form.getAttribute("target") || "popupwindow";

      if (popupUrl) {
        window.open(popupUrl, popupName, "noopener");
      }
    });
  });
})();


// ── Proof Section Navigator ──
(function(){
  var nav=document.querySelector('.proof-nav');
  if(!nav)return;
  var header=document.querySelector('.site-header');
  function updateProofNavOffset(){
    if(!header)return;
    var computedTop=window.getComputedStyle(header).top;
    var stickyTop=Number.parseFloat(computedTop);
    if(Number.isNaN(stickyTop))stickyTop=0;
    nav.style.top=(stickyTop+header.offsetHeight)+'px';
  }
  updateProofNavOffset();
  window.addEventListener('resize',updateProofNavOffset);
  var links=nav.querySelectorAll('.proof-nav__link');
  var sections=[];
  links.forEach(function(l){
    var id=l.getAttribute('href');
    if(id&&id.startsWith('#')){var el=document.querySelector(id);if(el)sections.push({id:id.slice(1),el:el,link:l});}
  });
  if(!sections.length)return;
  function setActive(id){
    links.forEach(function(l){l.getAttribute('data-section')===id?l.setAttribute('aria-current','true'):l.removeAttribute('aria-current');});
  }
  if('IntersectionObserver' in window){
    var obs=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting)setActive(e.target.id);});},{rootMargin:'-20% 0px -60% 0px',threshold:0});
    sections.forEach(function(s){obs.observe(s.el);});
  }
  var reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  links.forEach(function(l){
    l.addEventListener('click',function(e){
      e.preventDefault();
      var t=document.querySelector(l.getAttribute('href'));
      if(t){t.scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'start'});history.pushState(null,'',l.getAttribute('href'));}
    });
  });
  setActive(sections[0].id);
})();
