// popup.js

document.addEventListener('DOMContentLoaded', function() {
    const openAllAgenciesBtn = document.getElementById('openAllAgencies');
    const openAdminBtn = document.getElementById('openAdmin');
    const debugInfoBtn = document.getElementById('debugInfo');
    const statusDiv = document.getElementById('status');
    const loadingDiv = document.getElementById('loading');
    const mainContent = document.getElementById('main-content');

    // Fonction pour afficher un message de statut
    function showStatus(message, type = 'info') {
        statusDiv.innerHTML = message;
        statusDiv.className = `status ${type}`;
        statusDiv.classList.remove('hidden');
        
        // Cacher automatiquement les messages de succès après 3 secondes
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 3000);
        }
    }

    // Fonction pour afficher/cacher le loading
    function showLoading(show = true) {
        if (show) {
            loadingDiv.style.display = 'block';
            mainContent.style.display = 'none';
        } else {
            loadingDiv.style.display = 'none';
            mainContent.style.display = 'block';
        }
    }

    // Bouton "Ouvrir toutes les agences"
    openAllAgenciesBtn.addEventListener('click', function() {
        showLoading(true);
        showStatus('Ouverture des agences en cours...', 'info');
        
        // Envoyer un message au background script pour ouvrir toutes les agences
        chrome.runtime.sendMessage({ action: 'openAllAgencies' }, function(response) {
            showLoading(false);
            if (response && response.success) {
                showStatus(`✅ ${response.message}`, 'success');
            } else {
                showStatus('❌ Erreur lors de l\'ouverture des agences', 'error');
            }
        });
    });

    // Bouton "Ouvrir l'administration"
    openAdminBtn.addEventListener('click', function() {
        showLoading(true);
        showStatus('Recherche du site en cours...', 'info');
        
        // Envoyer un message au background script pour ouvrir l'admin
        chrome.runtime.sendMessage({ action: 'openAdmin' }, function(response) {
            showLoading(false);
            if (response && response.success) {
                showStatus(`✅ ${response.message}`, 'success');
                // Fermer le popup après succès
                setTimeout(() => {
                    window.close();
                }, 1000);
            } else {
                const errorMessage = response ? response.message : 'Erreur inconnue';
                showStatus(`❌ ${errorMessage}`, 'error');
                
                // Si le site n'est pas trouvé, afficher le message d'aide
                if (response && response.siteNotFound) {
                    setTimeout(() => {
                        showStatus('💡 Site non trouvé. Veuillez utiliser "Ouvrir toutes les agences" puis réessayer. Si le problème persiste, contactez l\'administrateur.', 'warning');
                    }, 2000);
                }
            }
        });
    });

    // Bouton debug pour afficher les sites stockés
    debugInfoBtn.addEventListener('click', function() {
        chrome.storage.local.get(['siteInformation'], function(result) {
            const sites = result.siteInformation || [];
            
            // Obtenir l'URL de l'onglet actuel
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                const currentUrl = tabs[0] ? new URL(tabs[0].url).hostname.replace('www.', '') : 'N/A';
                
                let message = `🔍 DEBUG INFO:\n`;
                message += `Onglet actuel: ${currentUrl}\n`;
                message += `Sites stockés: ${sites.length}\n\n`;
                
                if (sites.length > 0) {
                    sites.forEach(site => {
                        message += `• ${site.siteName} (${site.agency})\n`;
                    });
                } else {
                    message += 'Aucun site trouvé. Cliquez sur "Ouvrir toutes les agences" d\'abord.';
                }
                
                showStatus(message.replace(/\n/g, '<br>'), 'info');
            });
        });
    });

    // Écouter les messages du background script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updatePopupStatus') {
            showStatus(request.message, request.type);
        }
    });
});
