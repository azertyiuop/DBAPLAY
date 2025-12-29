


const AUTH_STORAGE_KEY = 'admin_auth';

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

function createAuthHash(username, password) {
    return simpleHash(username + ':' + password);
}

async function setupCredentials(username, password) {
    try {
        const authHash = createAuthHash(username, password);
        const credentials = {
            username: username,
            hash: authHash
        };

        if (typeof saveAdminCredentials === 'function') {
            await saveAdminCredentials(credentials);
        } else {

            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(credentials));
        }
        
        return true;
    } catch (error) {
        console.error('Erreur lors de la création des identifiants:', error);

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

async function credentialsExist() {
    console.log('🔍 credentialsExist - Vérification des identifiants...');
    
    if (typeof getAdminCredentials === 'function') {
        try {
            const credentials = await getAdminCredentials();
            console.log('📊 credentialsExist - Credentials chargés:', credentials ? 'Oui' : 'Non');
            
            // Vérifier les deux formats possibles (hash ou password)
            if (credentials && credentials.username && (credentials.hash || credentials.password)) {
                console.log('✅ credentialsExist - Identifiants trouvés dans la BDD');
                return true;
            } else {
                console.log('⚠️ credentialsExist - Format invalide ou incomplet');
            }
        } catch (error) {
            console.warn('⚠️ Erreur lors de la vérification dans la BDD, fallback sur localStorage:', error);
        }
    }

    const localAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (localAuth) {
        console.log('✅ credentialsExist - Identifiants trouvés dans localStorage');
        return true;
    }
    
    console.log('❌ credentialsExist - Aucun identifiant trouvé');
    return false;
}

async function checkCredentials(username, password) {
    console.log('🔐 checkCredentials - Vérification des identifiants pour:', username);
    
    let storedAuth = null;

    if (typeof getAdminCredentials === 'function') {
        try {
            console.log('📡 Chargement depuis la BDD...');
            storedAuth = await getAdminCredentials();
            console.log('📊 Identifiants chargés depuis la BDD:', storedAuth ? 'Oui' : 'Non');
        } catch (error) {
            console.warn('⚠️ Erreur lors du chargement depuis la BDD, fallback sur localStorage:', error);
        }
    }

    if (!storedAuth) {
        console.log('📡 Tentative de chargement depuis localStorage...');
        const localAuth = localStorage.getItem(AUTH_STORAGE_KEY);
        if (localAuth) {
            try {
                storedAuth = JSON.parse(localAuth);
                console.log('✅ Identifiants trouvés dans localStorage');

                if (storedAuth && typeof saveAdminCredentials === 'function') {
                    try {
                        await saveAdminCredentials(storedAuth);
                        console.log('✅ Identifiants migrés vers la BDD');
                    } catch (e) {
                        console.warn('⚠️ Impossible de migrer vers la BDD:', e);
                    }
                }
            } catch (e) {
                console.error('❌ Erreur lors du parsing localStorage:', e);
            }
        }
    }
    
    if (!storedAuth) {
        console.log('❌ checkCredentials - Aucun identifiant trouvé');
        return false;
    }
    
    console.log('📊 checkCredentials - Format identifiants:', storedAuth.hash ? 'hash (ancien)' : storedAuth.password ? 'password (nouveau)' : 'inconnu');
    
    try {
        // Vérifier les deux formats possibles
        if (storedAuth.hash) {
            // Format ancien (auth.js) - utilise createAuthHash
            const providedHash = createAuthHash(username, password);
            const isValid = storedAuth.username === username && storedAuth.hash === providedHash;
            console.log('🔐 checkCredentials - Vérification avec hash (createAuthHash):', isValid ? '✅ VALIDE' : '❌ INVALIDE');
            return isValid;
        } else if (storedAuth.password) {
            // Format nouveau (common.js) - utilise hashPassword (SHA-256)
            if (typeof window.hashPassword === 'function') {
                const providedHash = await window.hashPassword(password);
                const isValid = storedAuth.username === username && storedAuth.password === providedHash;
                console.log('🔐 checkCredentials - Vérification avec password (SHA-256):', isValid ? '✅ VALIDE' : '❌ INVALIDE');
                return isValid;
            } else {
                // Fallback sur createAuthHash si hashPassword n'est pas disponible
                console.warn('⚠️ hashPassword non disponible, utilisation de createAuthHash');
                const providedHash = createAuthHash(username, password);
                const isValid = storedAuth.username === username && storedAuth.password === providedHash;
                console.log('🔐 checkCredentials - Vérification avec password (fallback):', isValid ? '✅ VALIDE' : '❌ INVALIDE');
                return isValid;
            }
        } else {
            console.error('❌ checkCredentials - Format d\'identifiants inconnu (ni hash ni password)');
            return false;
        }
    } catch (error) {
        console.error('❌ Erreur lors de la vérification:', error);
        return false;
    }
}

function promptCredentials() {

    const username = window.prompt('Nom d\'utilisateur:');
    if (username === null) {
        return null; // L'utilisateur a annulé
    }

    const password = window.prompt('Mot de passe:');
    if (password === null) {
        return null; // L'utilisateur a annulé
    }
    
    return { username: username.trim(), password: password };
}

function isAuthenticated() {
    const session = localStorage.getItem('admin_session');
    return session === 'authenticated';
}

function setAuthenticated() {
    localStorage.setItem('admin_session', 'authenticated');
}

function logout() {
    localStorage.removeItem('admin_session');
}

async function requireAuth() {

    const exist = await credentialsExist();
    if (!exist) {
        alert('Aucun identifiant configuré. Redirection vers la page de configuration...');
        window.location.href = 'setup.html';
        return false;
    }
    
    if (isAuthenticated()) {

        const container = document.querySelector('.app-container');
        const loadingMsg = document.getElementById('loadingMessage');
        if (container) {
            container.style.display = 'block';
        }
        if (loadingMsg) {
            loadingMsg.style.display = 'none';
        }

        if (typeof window.hideLoadingMessage === 'function') {
            window.hideLoadingMessage();
        }
        return true;
    }

    const container = document.querySelector('.app-container');
    if (container) {
        container.style.display = 'none';
    }

    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        const credentials = promptCredentials();
        
        if (credentials === null) {

            window.location.href = 'index.html';
            return false;
        }
        
        const isValid = await checkCredentials(credentials.username, credentials.password);
        if (isValid) {
            setAuthenticated();

            const appContainer = document.querySelector('.app-container');
            const loadingMsg = document.getElementById('loadingMessage');
            if (appContainer) {
                appContainer.style.display = 'block';
            }
            if (loadingMsg) {
                loadingMsg.style.display = 'none';
            }

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
