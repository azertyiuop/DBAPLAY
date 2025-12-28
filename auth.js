// Système d'authentification avec popup native du navigateur
// Utilise window.prompt() pour demander les identifiants

const AUTH_STORAGE_KEY = 'admin_auth';

// Fonction simple de hash (pour sécurité basique)
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
}

// Fonction pour créer un hash combiné username + password
function createAuthHash(username, password) {
    return simpleHash(username + ':' + password);
}

// Fonction pour créer les identifiants (appelée depuis setup.html)
async function setupCredentials(username, password) {
    try {
        const authHash = createAuthHash(username, password);
        const credentials = {
            username: username,
            hash: authHash
        };
        
        // Sauvegarder dans le Gist (synchronisé)
        if (typeof saveAdminCredentials === 'function') {
            await saveAdminCredentials(credentials);
        } else {
            // Fallback sur localStorage si saveAdminCredentials n'est pas encore disponible
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(credentials));
        }
        
        return true;
    } catch (error) {
        console.error('Erreur lors de la création des identifiants:', error);
        // Fallback sur localStorage en cas d'erreur
        try {
            const authHash = createAuthHash(username, password);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
                username: username,
                hash: authHash
            }));
            return true;
        } catch (e) {
            return false;
        }
    }
}

// Fonction pour vérifier si les identifiants existent
async function credentialsExist() {
    // Vérifier d'abord dans le Gist
    if (typeof getAdminCredentials === 'function') {
        try {
            const credentials = await getAdminCredentials();
            if (credentials && credentials.username && credentials.hash) {
                return true;
            }
        } catch (error) {
            console.warn('Erreur lors de la vérification dans le Gist, fallback sur localStorage:', error);
        }
    }
    
    // Fallback sur localStorage
    return localStorage.getItem(AUTH_STORAGE_KEY) !== null;
}

// Fonction pour vérifier les identifiants
async function checkCredentials(username, password) {
    let storedAuth = null;
    
    // Essayer de charger depuis le Gist d'abord
    if (typeof getAdminCredentials === 'function') {
        try {
            storedAuth = await getAdminCredentials();
        } catch (error) {
            console.warn('Erreur lors du chargement depuis le Gist, fallback sur localStorage:', error);
        }
    }
    
    // Fallback sur localStorage si pas trouvé dans le Gist
    if (!storedAuth) {
        const localAuth = localStorage.getItem(AUTH_STORAGE_KEY);
        if (localAuth) {
            try {
                storedAuth = JSON.parse(localAuth);
                // Migrer vers le Gist si trouvé dans localStorage
                if (storedAuth && typeof saveAdminCredentials === 'function') {
                    try {
                        await saveAdminCredentials(storedAuth);
                        console.log('✅ Identifiants migrés vers le Gist');
                    } catch (e) {
                        console.warn('Impossible de migrer vers le Gist:', e);
                    }
                }
            } catch (e) {
                console.error('Erreur lors du parsing localStorage:', e);
            }
        }
    }
    
    if (!storedAuth) {
        return false; // Pas d'identifiants définis
    }
    
    try {
        const providedHash = createAuthHash(username, password);
        return storedAuth.username === username && storedAuth.hash === providedHash;
    } catch (error) {
        console.error('Erreur lors de la vérification:', error);
        return false;
    }
}

// Fonction pour demander les identifiants via popup native
function promptCredentials() {
    // Demander le nom d'utilisateur
    const username = window.prompt('Nom d\'utilisateur:');
    if (username === null) {
        return null; // L'utilisateur a annulé
    }
    
    // Demander le mot de passe
    const password = window.prompt('Mot de passe:');
    if (password === null) {
        return null; // L'utilisateur a annulé
    }
    
    return { username: username.trim(), password: password };
}

// Fonction pour vérifier si l'utilisateur est connecté
function isAuthenticated() {
    const session = localStorage.getItem('admin_session');
    return session === 'authenticated';
}

// Fonction pour définir la session
function setAuthenticated() {
    localStorage.setItem('admin_session', 'authenticated');
}

// Fonction pour déconnecter
function logout() {
    localStorage.removeItem('admin_session');
}

// Fonction pour protéger une page (demande les identifiants via popup)
async function requireAuth() {
    // Vérifier si les identifiants existent
    const exist = await credentialsExist();
    if (!exist) {
        alert('Aucun identifiant configuré. Redirection vers la page de configuration...');
        window.location.href = 'setup.html';
        return false;
    }
    
    if (isAuthenticated()) {
        // Afficher le contenu si déjà authentifié
        const container = document.querySelector('.app-container');
        const loadingMsg = document.getElementById('loadingMessage');
        if (container) {
            container.style.display = 'block';
        }
        if (loadingMsg) {
            loadingMsg.style.display = 'none';
        }
        // Masquer le message de chargement
        if (typeof window.hideLoadingMessage === 'function') {
            window.hideLoadingMessage();
        }
        return true;
    }
    
    // Masquer le contenu pendant l'authentification
    const container = document.querySelector('.app-container');
    if (container) {
        container.style.display = 'none';
    }
    
    // Demander les identifiants jusqu'à ce qu'ils soient corrects ou que l'utilisateur annule
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        const credentials = promptCredentials();
        
        if (credentials === null) {
            // L'utilisateur a annulé
            window.location.href = 'index.html';
            return false;
        }
        
        const isValid = await checkCredentials(credentials.username, credentials.password);
        if (isValid) {
            setAuthenticated();
            // Afficher le contenu après authentification réussie
            const appContainer = document.querySelector('.app-container');
            const loadingMsg = document.getElementById('loadingMessage');
            if (appContainer) {
                appContainer.style.display = 'block';
            }
            if (loadingMsg) {
                loadingMsg.style.display = 'none';
            }
            // Masquer le message de chargement
            if (typeof window.hideLoadingMessage === 'function') {
                window.hideLoadingMessage();
            }
            return true;
        } else {
            attempts++;
            if (attempts < maxAttempts) {
                alert('Nom d\'utilisateur ou mot de passe incorrect. Tentatives restantes: ' + (maxAttempts - attempts));
            } else {
                alert('Nombre maximum de tentatives atteint. Accès refusé.');
                window.location.href = 'index.html';
                return false;
            }
        }
    }
    
    return false;
}
