// content.js

let extractionInProgress = false;
let extractionScheduled = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractSiteId(element) {
  const idAttribute = element.id;
  if (idAttribute && idAttribute.startsWith("popover_")) {
    return idAttribute.replace("popover_", "");
  }

  const dataId = element.getAttribute("data-site-id") || element.getAttribute("data-id");
  if (dataId) {
    return dataId;
  }

  const childWithId = element.querySelector('[id^="popover_"]');
  if (childWithId) {
    return childWithId.id.replace("popover_", "");
  }

  let parent = element.parentElement;
  while (parent) {
    if (parent.id && parent.id.startsWith("popover_")) {
      return parent.id.replace("popover_", "");
    }
    parent = parent.parentElement;
  }

  return null;
}

function getCurrentSiteCount() {
  return document.querySelectorAll(".sidebar-site-list .site-name-wrapper").length;
}

function getExpectedTotalSiteCount(fallbackLoadedCount) {
  const allSitesCountNode = document.querySelector(
    ".site-dropdown .dropdown-menu .default-group, .group-name .default-group"
  );
  if (allSitesCountNode) {
    const parsed = parseInt((allSitesCountNode.textContent || "").replace(/[^0-9]/g, ""), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const loadMoreButton = document.querySelector(".load-more-container button");
  if (loadMoreButton) {
    const text = (loadMoreButton.textContent || "").toLowerCase();
    const match = text.match(/\((\d+)\s+remaining\)/);
    if (match) {
      const remaining = parseInt(match[1], 10);
      if (!Number.isNaN(remaining) && remaining >= 0) {
        return fallbackLoadedCount + remaining;
      }
    }
  }

  return fallbackLoadedCount;
}

function sendSiteProgress(loadedSites) {
  const totalSites = getExpectedTotalSiteCount(loadedSites);
  chrome.runtime.sendMessage({
    action: "siteLoadProgress",
    loadedSites,
    totalSites,
    agency: window.location.hostname
  });
}

function clickVisibleLoadMoreButtons() {
  const selectors = [
    ".load-more-container button",
    "button.btn-outline-secondary.btn-sm",
    "button"
  ];

  let clicked = false;
  for (const selector of selectors) {
    const buttons = document.querySelectorAll(selector);
    for (const button of buttons) {
      const text = (button.textContent || "").toLowerCase();
      if (
        text.includes("load more") &&
        !button.disabled &&
        button.offsetParent !== null
      ) {
        button.click();
        clicked = true;
      }
    }
  }
  return clicked;
}

async function forceLoadAllSites() {
  const containers = [
    document.querySelector("#sidebarcontent"),
    document.querySelector(".sidebar-content"),
    document.querySelector(".sites-wrapper"),
    document.scrollingElement
  ].filter(Boolean);

  if (containers.length === 0) {
    return;
  }

  let stableRounds = 0;
  let previousCount = getCurrentSiteCount();
  sendSiteProgress(previousCount);

  for (let i = 0; i < 80; i += 1) {
    let clicked = false;

    for (const container of containers) {
      container.scrollTop = container.scrollHeight;
    }

    clicked = clickVisibleLoadMoreButtons() || clicked;

    await sleep(clicked ? 600 : 350);

    const currentCount = getCurrentSiteCount();
    sendSiteProgress(currentCount);
    if (currentCount > previousCount) {
      previousCount = currentCount;
      stableRounds = 0;
      continue;
    }

    stableRounds += 1;
    if (stableRounds >= 5 && !clicked) {
      break;
    }
  }

  sendSiteProgress(getCurrentSiteCount());
}

function collectSiteInformation() {
  const currentAgency = window.location.hostname;
  const selectors = [
    ".sidebar-site-list .site-name-wrapper",
    ".site-name-wrapper",
    '[class*="site-name-wrapper"]',
    ".site-list .site-name-wrapper",
    ".sites-list .site-name-wrapper"
  ];

  let siteList = [];
  for (const selector of selectors) {
    siteList = document.querySelectorAll(selector);
    if (siteList.length > 0) {
      break;
    }
  }

  const siteInformation = [];
  for (const siteElement of siteList) {
    const nameElement = siteElement.querySelector(".site-name") || siteElement.querySelector("span");
    const siteName = (nameElement ? nameElement.innerText : siteElement.innerText || "").trim();
    const siteId = extractSiteId(siteElement);

    if (siteName && siteId !== null) {
      siteInformation.push({ siteName, siteId, agency: currentAgency });
    }
  }

  return siteInformation;
}

async function getSiteInformation() {
  if (extractionInProgress) {
    extractionScheduled = true;
    return;
  }

  extractionInProgress = true;
  extractionScheduled = false;

  try {
    if (document.readyState !== "complete") {
      await new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
    }

    await forceLoadAllSites();
    const siteInformation = collectSiteInformation();

    if (siteInformation.length > 0) {
      chrome.runtime.sendMessage({ action: "saveSiteInformation", siteInformation });
      console.log("Sites extraits:", siteInformation.length);
    }
  } finally {
    extractionInProgress = false;
    if (extractionScheduled) {
      setTimeout(() => {
        getSiteInformation();
      }, 500);
    }
  }
}

setTimeout(() => {
  getSiteInformation();
}, 1500);

const observer = new MutationObserver((mutations) => {
  const hasPotentialSiteChanges = mutations.some((mutation) =>
    Array.from(mutation.addedNodes).some((node) => {
      if (node.nodeType !== 1) {
        return false;
      }

      const element = node;
      const className = typeof element.className === "string" ? element.className : "";
      return (
        className.includes("site") ||
        (typeof element.querySelector === "function" &&
          (element.querySelector(".site-name-wrapper") || element.querySelector(".site-item")))
      );
    })
  );

  if (hasPotentialSiteChanges) {
    getSiteInformation();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
