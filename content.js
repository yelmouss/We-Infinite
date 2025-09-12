// content.js

function extractSiteId(element) {
  // Essayer d'abord avec l'attribut id
  const idAttribute = element.id;
  if (idAttribute && idAttribute.startsWith('popover_')) {
    return idAttribute.replace('popover_', '');
  }
  
  // Essayer avec les attributs data-*
  const dataId = element.getAttribute('data-site-id') || element.getAttribute('data-id');
  if (dataId) {
    return dataId;
  }
  
  // Chercher dans les éléments enfants
  const childWithId = element.querySelector('[id^="popover_"]');
  if (childWithId) {
    return childWithId.id.replace('popover_', '');
  }
  
  // Chercher dans les éléments parents
  let parent = element.parentElement;
  while (parent) {
    if (parent.id && parent.id.startsWith('popover_')) {
      return parent.id.replace('popover_', '');
    }
    parent = parent.parentElement;
  }
  
  console.log('Aucun ID trouvé pour l\'élément:', element.outerHTML.substring(0, 100));
  return null;
}

function getSiteInformation() {
  console.log('=== DÉBUT EXTRACTION SITES ===');
  console.log('URL actuelle:', window.location.href);
  
  // Attendre que la page soit complètement chargée
  if (document.readyState !== 'complete') {
    console.log('Page pas encore chargée, attente...');
    window.addEventListener('load', getSiteInformation);
    return;
  }
  
  // Récupérer l'agence actuelle depuis l'URL
  const currentAgency = window.location.hostname;
  console.log('Agence actuelle:', currentAgency);
  
  // Essayer différents sélecteurs pour trouver les sites
  const selectors = [
    '.sidebar-site-list .site-name-wrapper',
    '.site-name-wrapper',
    '[class*="site-name-wrapper"]',
    '.site-list .site-name-wrapper',
    '.sites-list .site-name-wrapper'
  ];
  
  let siteList = [];
  let usedSelector = '';
  
  for (const selector of selectors) {
    siteList = document.querySelectorAll(selector);
    if (siteList.length > 0) {
      usedSelector = selector;
      break;
    }
  }
  
  console.log(`Sélecteur utilisé: ${usedSelector}`);
  console.log(`Nombre d'éléments trouvés: ${siteList.length}`);
  
  if (siteList.length === 0) {
    console.log('Aucun site trouvé. Vérification des éléments présents sur la page...');
    
    // Chercher tous les éléments qui pourraient contenir des sites
    const allDivs = document.querySelectorAll('div');
    console.log('Nombre total de divs:', allDivs.length);
    
    const siteElements = Array.from(allDivs).filter(div => 
      div.className.includes('site') || 
      div.id.includes('site') || 
      div.textContent.includes('.com') || 
      div.textContent.includes('.fr')
    );
    
    console.log('Éléments potentiels trouvés:', siteElements.length);
    siteElements.forEach(el => {
      console.log('- Element:', el.className, el.id, el.textContent.substring(0, 50));
    });
    
    return;
  }
  
  const siteInformation = [];

  siteList.forEach((siteElement, index) => {
    console.log(`\n--- Site ${index + 1} ---`);
    console.log('Element HTML:', siteElement.outerHTML.substring(0, 200));
    
    // Essayer différents sélecteurs pour le nom du site
    const nameSelectors = [
      '.site-name',
      '[class*="site-name"]',
      '.name',
      'span',
      'div'
    ];
    
    let siteName = '';
    for (const nameSelector of nameSelectors) {
      const nameElement = siteElement.querySelector(nameSelector);
      if (nameElement && nameElement.innerText.trim()) {
        siteName = nameElement.innerText.trim();
        console.log(`Nom trouvé avec sélecteur ${nameSelector}:`, siteName);
        break;
      }
    }
    
    if (!siteName) {
      siteName = siteElement.innerText.trim();
      console.log('Nom pris depuis innerText:', siteName);
    }
    
    const siteId = extractSiteId(siteElement);
    console.log('Site ID extraité:', siteId);

    if (siteId !== null && siteName) {
      siteInformation.push({ siteName, siteId, agency: currentAgency });
      console.log(`✅ Site ajouté: ${siteName} (ID: ${siteId})`);
    } else {
      console.log(`❌ Site ignoré: nom="${siteName}", id="${siteId}"`);
    }
  });

  console.log(`\n=== RÉSULTAT ===`);
  console.log(`Sites extraits: ${siteInformation.length}`);
  console.log('Liste des sites:', siteInformation);

  if (siteInformation.length > 0) {
    console.log('Envoi des données au background script...');
    chrome.runtime.sendMessage({ action: 'saveSiteInformation', siteInformation });
  } else {
    console.log('Aucun site à envoyer');
  }
  
  console.log('=== FIN EXTRACTION ===');
}

// Attendre un peu que la page soit complètement chargée
setTimeout(() => {
  getSiteInformation();
}, 2000);

// Écouter aussi les changements de DOM au cas où le contenu se charge dynamiquement
const observer = new MutationObserver((mutations) => {
  const hasNewSites = mutations.some(mutation => 
    Array.from(mutation.addedNodes).some(node => 
      node.nodeType === 1 && (
        node.className && node.className.includes('site') ||
        node.querySelector && node.querySelector('[class*="site"]')
      )
    )
  );
  
  if (hasNewSites) {
    console.log('Nouveau contenu détecté, re-extraction des sites...');
    setTimeout(() => {
      getSiteInformation();
    }, 1000);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
