// background.js

// Liste des agences disponibles
const agencies = [
  "nantes.weshore-iwp.com",
  "rennes2.weshore-iwp.com",
  "bordeaux.weshore-iwp.com",
  "mandataires.weshore-iwp.com",
  "prismo.weshore-iwp.com",
  "comon.weshore-iwp.com",
  "rennes1.weshore-iwp.com",
];

chrome.action.onClicked.addListener(function (tab) {
  // Rechercher les onglets correspondants pour toutes les agences
  chrome.tabs.query({}, function (tabs) {
    const processedAgencies = [];

    // Chercher les onglets déjà ouverts pour chaque agence
    agencies.forEach((agency) => {
      const matchingTabs = tabs.filter((tab) =>
        tab.url.includes(`${agency}/v3/`)
      );

      if (matchingTabs.length > 0) {
        // Exécuter le script sur le premier onglet trouvé pour cette agence
        chrome.scripting.executeScript({
          target: { tabId: matchingTabs[0].id },
          files: ["content.js"],
        });
        processedAgencies.push(agency);
        console.log(`Script exécuté sur ${agency} (onglet existant)`);
      }
    });

    // Ouvrir les agences manquantes dans de nouveaux onglets
    const missingAgencies = agencies.filter(
      (agency) => !processedAgencies.includes(agency)
    );

    let openedTabs = 0;
    missingAgencies.forEach((agency) => {
      chrome.tabs.create({ url: `https://${agency}/v3/` }, function (newTab) {
        // Attendre que la page soit chargée avant d'exécuter le script
        chrome.tabs.onUpdated.addListener(function listener(
          tabId,
          changeInfo,
          tab
        ) {
          if (tabId === newTab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            chrome.scripting.executeScript({
              target: { tabId: newTab.id },
              files: ["content.js"],
            });
            console.log(`Script exécuté sur ${agency} (nouvel onglet)`);

            openedTabs++;
            if (openedTabs === missingAgencies.length) {
              console.log(
                `Tous les onglets manquants ont été ouverts et traités`
              );
            }
          }
        });
      });
    });

    if (missingAgencies.length === 0) {
      console.log("Tous les onglets des agences étaient déjà ouverts");
    } else {
      console.log(
        `Ouverture de ${missingAgencies.length} onglets manquants:`,
        missingAgencies
      );
    }
  });
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("Message received:", request);

  if (request.action === "openAllAgencies") {
    // Ouvrir toutes les agences
    chrome.tabs.query({}, function (tabs) {
      const processedAgencies = [];

      // Chercher les onglets déjà ouverts pour chaque agence
      agencies.forEach((agency) => {
        const matchingTabs = tabs.filter((tab) =>
          tab.url.includes(`${agency}/v3/`)
        );

        if (matchingTabs.length > 0) {
          // Exécuter le script sur le premier onglet trouvé pour cette agence
          chrome.scripting.executeScript({
            target: { tabId: matchingTabs[0].id },
            files: ["content.js"],
          });
          processedAgencies.push(agency);
          console.log(`Script exécuté sur ${agency} (onglet existant)`);
        }
      });

      // Ouvrir les agences manquantes dans de nouveaux onglets
      const missingAgencies = agencies.filter(
        (agency) => !processedAgencies.includes(agency)
      );

      let openedTabs = 0;
      const totalMissing = missingAgencies.length;

      if (totalMissing === 0) {
        sendResponse({
          success: true,
          message: "Toutes les agences étaient déjà ouvertes",
        });
        return;
      }

      missingAgencies.forEach((agency) => {
        chrome.tabs.create({ url: `https://${agency}/v3/` }, function (newTab) {
          // Attendre que la page soit chargée avant d'exécuter le script
          chrome.tabs.onUpdated.addListener(function listener(
            tabId,
            changeInfo,
            tab
          ) {
            if (tabId === newTab.id && changeInfo.status === "complete") {
              chrome.tabs.onUpdated.removeListener(listener);
              chrome.scripting.executeScript({
                target: { tabId: newTab.id },
                files: ["content.js"],
              });

              openedTabs++;
              if (openedTabs === totalMissing) {
                sendResponse({
                  success: true,
                  message: `${totalMissing} agences ouvertes avec succès`,
                });
              }
            }
          });
        });
      });
    });

    return true; // Indique que la réponse sera asynchrone
  } else if (request.action === "openAdmin") {
    // Ouvrir l'administration pour le site actuel
    chrome.tabs.query(
      { active: true, currentWindow: true },
      function (activeTabs) {
        if (activeTabs && activeTabs.length > 0) {
          const activeTabUrl = new URL(activeTabs[0].url);
          const siteUrl = activeTabUrl.hostname.replace("www.", "");

          console.log("Recherche du site:", siteUrl);

          chrome.storage.local.get(["siteInformation"], function (result) {
            const siteInformation = result.siteInformation || [];

            console.log(
              "Sites disponibles dans le storage:",
              siteInformation.map((s) => s.siteName)
            );

            // Essayer plusieurs méthodes de recherche pour être plus flexible
            let currentSite = siteInformation.find(
              (site) => site.siteName.toLowerCase() === siteUrl.toLowerCase()
            );

            // Si pas trouvé, essayer sans le TLD
            if (!currentSite) {
              const siteWithoutTLD = siteUrl.split(".")[0];
              currentSite = siteInformation.find((site) =>
                site.siteName
                  .toLowerCase()
                  .includes(siteWithoutTLD.toLowerCase())
              );
              console.log(
                "Recherche sans TLD:",
                siteWithoutTLD,
                "Résultat:",
                currentSite
              );
            }

            // Si pas trouvé, essayer avec une recherche partielle
            if (!currentSite) {
              currentSite = siteInformation.find(
                (site) =>
                  siteUrl.toLowerCase().includes(site.siteName.toLowerCase()) ||
                  site.siteName.toLowerCase().includes(siteUrl.toLowerCase())
              );
              console.log("Recherche partielle, Résultat:", currentSite);
            }

            if (currentSite) {
              // Utiliser l'agence appropriée trouvée pour ce site
              const apiUrl = `https://${currentSite.agency}/v3/ajax.php?action=loadSite&siteID=${currentSite.siteId}`;

              console.log(
                `Site trouvé: ${currentSite.siteName} sur ${currentSite.agency}`
              );
              console.log("URL de redirection:", apiUrl);

              chrome.tabs.update(
                activeTabs[0].id,
                { url: apiUrl },
                function () {
                  console.log(
                    `Site trouvé sur ${currentSite.agency} - Redirection vers l'admin`
                  );
                  sendResponse({
                    success: true,
                    message: `Administration ouverte pour ${currentSite.siteName} (Agence: ${currentSite.agency})`,
                  });
                }
              );
            } else {
              console.error("Site ID not found for:", siteUrl);
              console.error(
                "Available sites:",
                siteInformation.map((s) => s.siteName)
              );
              sendResponse({
                success: false,
                message: `Site "${siteUrl}" non trouvé`,
                siteNotFound: true,
              });
            }
          });
        } else {
          sendResponse({
            success: false,
            message: "Aucun onglet actif trouvé",
          });
        }
      }
    );

    return true; // Indique que la réponse sera asynchrone
  } else if (request.action === "saveSiteInformation") {
    // Récupérer les informations existantes
    chrome.storage.local.get(["siteInformation"], function (result) {
      let allSiteInformation = result.siteInformation || [];

      // Ajouter les nouvelles informations (éviter les doublons)
      request.siteInformation.forEach((newSite) => {
        const existingIndex = allSiteInformation.findIndex(
          (site) =>
            site.siteName.toLowerCase() === newSite.siteName.toLowerCase()
        );

        if (existingIndex !== -1) {
          // Mettre à jour le site existant
          allSiteInformation[existingIndex] = newSite;
        } else {
          // Ajouter le nouveau site
          allSiteInformation.push(newSite);
        }
      });

      // Sauvegarder les informations mises à jour
      chrome.storage.local.set(
        { siteInformation: allSiteInformation },
        function () {
          console.log(
            `Informations mises à jour: ${allSiteInformation.length} sites au total`
          );
          console.log(
            "Sites disponibles:",
            allSiteInformation.map((s) => s.siteName)
          );
        }
      );
    });
  } else if (request.action === "findSiteIdForCurrentTab") {
    // Rechercher directement le site dans toutes les agences
    chrome.tabs.query(
      { active: true, currentWindow: true },
      function (activeTabs) {
        if (activeTabs && activeTabs.length > 0) {
          const activeTabUrl = new URL(activeTabs[0].url);
          const siteUrl = activeTabUrl.hostname.replace("www.", "");

          chrome.storage.local.get(["siteInformation"], function (result) {
            const siteInformation = result.siteInformation || [];
            const currentSite = siteInformation.find(
              (site) => site.siteName.toLowerCase() === siteUrl.toLowerCase()
            );

            if (currentSite) {
              // Utiliser l'agence appropriée trouvée pour ce site
              const apiUrl = `https://${currentSite.agency}/v3/ajax.php?action=loadSite&siteID=${currentSite.siteId}`;

              chrome.tabs.update(
                activeTabs[0].id,
                { url: apiUrl },
                function () {
                  console.log(
                    `Site trouvé sur ${currentSite.agency} - Redirection vers l'admin`
                  );
                }
              );
            } else {
              console.error("Site ID not found in any agency.");
            }
          });
        }
      }
    );
  }
});
