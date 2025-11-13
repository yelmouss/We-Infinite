// Nouveau popup.js avec statistiques, progression et filtrage par agence

document.addEventListener("DOMContentLoaded", () => {
  // Diagnostic width instrumentation & forced resize fallback
  try {
    const desiredWidth = 480; // px
    document.documentElement.style.width = desiredWidth + "px";
    document.body.style.width = desiredWidth + "px";
    document.body.style.minWidth = desiredWidth + "px";
    // Some Chromium builds ignore CSS width for action popups until JS sets size.
    if (window.innerWidth < 300) {
      // Attempt to enlarge the popup window programmatically
      window.resizeTo(desiredWidth, Math.max(520, document.body.scrollHeight + 40));
    }
    setTimeout(() => {
      console.log("[POPUP WIDTH DEBUG] innerWidth=", window.innerWidth,
        "body.offsetWidth=", document.body.offsetWidth,
        "documentElement.offsetWidth=", document.documentElement.offsetWidth);
      if (window.innerWidth < 300) {
        console.warn("[POPUP WIDTH DEBUG] Width still narrow. Applying fallback wrapper.");
        let wrapper = document.getElementById("forceWidthWrapper");
        if (!wrapper) {
          wrapper = document.createElement("div");
          wrapper.id = "forceWidthWrapper";
          wrapper.style.width = desiredWidth + "px";
          wrapper.style.minWidth = desiredWidth + "px";
          wrapper.style.boxSizing = "border-box";
          // Move existing children inside wrapper
          while (document.body.firstChild) {
            wrapper.appendChild(document.body.firstChild);
          }
          document.body.appendChild(wrapper);
        }
      }
    }, 50);
  } catch (e) {
    console.error("[POPUP WIDTH DEBUG] Exception while forcing width", e);
  }
  // Elements
  const openAllAgenciesBtn = document.getElementById("openAllAgencies");
  const openAdminBtn = document.getElementById("openAdmin");
  const openSelectedAgencyBtn = document.getElementById("openSelectedAgency");
  const showSitesBtn = document.getElementById("showSites");
  const closeSitesBtn = document.getElementById("closeSites");
  const agencySelect = document.getElementById("agencySelect");
  const statusDiv = document.getElementById("status");
  const loadingDiv = document.getElementById("loading");
  const progressContainer = document.getElementById("progressContainer");
  const progressBar = document.getElementById("progressBar");
  const progressPercent = document.getElementById("progressPercent");
  const progressText = document.getElementById("progressText");
  const siteListContainer = document.getElementById("siteListContainer");
  const siteList = document.getElementById("siteList");
  const totalSitesEl = document.getElementById("totalSites");
  const loadedAgenciesEl = document.getElementById("loadedAgencies");

  // Local state
  let agenciesCache = [];
  let sitesCache = [];

  // Util functions
  function showStatus(message, type = "info", autoHide = false) {
    statusDiv.innerHTML = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove("hidden");
    if (autoHide) {
      setTimeout(() => statusDiv.classList.add("hidden"), 3500);
    }
  }

  function updateProgress(percentage, text) {
    progressContainer.classList.remove("hidden");
    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${Math.round(percentage)}%`;
    if (text) progressText.textContent = text;
    if (percentage >= 100) {
      setTimeout(() => {
        progressContainer.classList.add("hidden");
      }, 1200);
    }
  }

  function toggleLoading(show) {
    loadingDiv.classList.toggle("hidden", !show);
  }

  function fetchAgencies() {
    chrome.runtime.sendMessage({ action: "getAgencies" }, (response) => {
      if (response && response.success) {
        agenciesCache = response.agencies || [];
        populateAgencySelect();
      }
    });
  }

  function populateAgencySelect() {
    agencySelect.innerHTML = '<option value="">-- Sélectionner une agence --</option>';
    agenciesCache.forEach((ag) => {
      const opt = document.createElement("option");
      opt.value = ag;
      opt.textContent = ag.replace('.weshore-iwp.com','');
      agencySelect.appendChild(opt);
    });
  }

  function updateStats() {
    chrome.storage.local.get(["siteInformation"], (result) => {
      sitesCache = result.siteInformation || [];
      const uniqueAgencies = [...new Set(sitesCache.map((s) => s.agency))];
      totalSitesEl.textContent = sitesCache.length.toString();
      loadedAgenciesEl.textContent = uniqueAgencies.length.toString();
      buildSiteList();
      // Activer agenceSelect options seulement pour agences chargées ? On garde toutes.
    });
  }

  function buildSiteList(filterAgency = null) {
    siteList.innerHTML = "";
    const filtered = filterAgency
      ? sitesCache.filter((s) => s.agency === filterAgency)
      : sitesCache;
    if (filtered.length === 0) {
      const li = document.createElement("li");
      li.textContent = filterAgency
        ? `Aucun site pour ${filterAgency}`
        : "Aucun site chargé pour le moment.";
      siteList.appendChild(li);
      return;
    }
    filtered.forEach((site) => {
      const li = document.createElement("li");
      const badge = document.createElement("span");
      badge.className = "site-badge";
      badge.textContent = site.agency.split(".")[0];
      const nameSpan = document.createElement("span");
      nameSpan.className = "site-name";
      nameSpan.textContent = site.siteName;
      li.appendChild(badge);
      li.appendChild(nameSpan);
      siteList.appendChild(li);
    });
  }

  // Event bindings
  openAllAgenciesBtn.addEventListener("click", () => {
    toggleLoading(true);
    updateProgress(0, "Initialisation...");
    chrome.runtime.sendMessage({ action: "openAllAgencies" }, (response) => {
      toggleLoading(false);
      if (response && response.success) {
        updateProgress(100, "Agences chargées");
        showStatus(`✅ ${response.message}`, "success", true);
        updateStats();
      } else {
        showStatus("❌ Erreur lors de l'ouverture des agences", "error");
      }
    });
  });

  agencySelect.addEventListener("change", () => {
    const val = agencySelect.value;
    openSelectedAgencyBtn.disabled = !val;
    if (val) {
      buildSiteList(val);
      siteListContainer.classList.remove("hidden");
    }
  });

  openSelectedAgencyBtn.addEventListener("click", () => {
    const agency = agencySelect.value;
    if (!agency) return;
    toggleLoading(true);
    updateProgress(0, `Chargement ${agency}`);
    chrome.runtime.sendMessage({ action: "openSelectedAgency", agency }, (response) => {
      toggleLoading(false);
      if (response && response.success) {
        updateProgress(100, "Agence chargée");
        showStatus(`✅ ${response.message}`, "success", true);
        updateStats();
      } else {
        showStatus(`❌ Erreur chargement ${agency}`, "error");
      }
    });
  });

  openAdminBtn.addEventListener("click", () => {
    toggleLoading(true);
    showStatus("Recherche du site en cours...", "info");
    chrome.runtime.sendMessage({ action: "openAdmin" }, (response) => {
      toggleLoading(false);
      if (response && response.success) {
        showStatus(`✅ ${response.message}`, "success", true);
        setTimeout(() => window.close(), 1200);
      } else {
        const errorMessage = response ? response.message : "Erreur inconnue";
        showStatus(`❌ ${errorMessage}`, "error");
        if (response && response.siteNotFound) {
          setTimeout(() => {
            showStatus(
              '💡 Site non trouvé. D\'abord chargez les agences puis réessayez.',
              "warning"
            );
          }, 1600);
        }
      }
    });
  });

  showSitesBtn.addEventListener("click", () => {
    siteListContainer.classList.toggle("hidden");
    buildSiteList(agencySelect.value || null);
  });
  closeSitesBtn.addEventListener("click", () => {
    siteListContainer.classList.add("hidden");
  });

  // Message listener (progress + status)
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "progressUpdate") {
      updateProgress(request.percentage, request.text);
    } else if (request.action === "updatePopupStatus") {
      showStatus(request.message, request.type, request.autoHide);
    } else if (request.action === "sitesUpdated") {
      updateStats();
    }
  });

  // Initial load
  fetchAgencies();
  updateStats();
});
