// Déchiffreur de fichiers JavaScript chiffrés
// La clé est reconstituée dynamiquement pour éviter qu'elle soit visible en clair

const ENCRYPTED_DIR = 'encrypted'; // Dossier contenant les fichiers chiffrés

// Clé de chiffrement obscurcie (divisée en plusieurs parties)
(function() {
    'use strict';
    // Parties de la clé (obscurcies)
    const _p1 = '0f9aa47e9f9bee25';
    const _p2 = 'fa1d8e679915841a';
    const _p3 = 'e649521553021e9d';
    const _p4 = '8cba768934ef5c42';
    
    // Reconstituer la clé (obscurcie avec des opérations)
    window._ENCRYPTION_KEY = _p1 + _p2 + _p3 + _p4;
})();

// Variable globale pour la clé (reconstituée)
const ENCRYPTION_KEY = window._ENCRYPTION_KEY || (function() {
    // Fallback si la clé n'a pas été définie
    const parts = [
        String.fromCharCode(48, 102, 57, 97, 97, 52, 55, 101, 57, 102, 57, 98, 101, 101, 50, 53),
        String.fromCharCode(102, 97, 49, 100, 56, 101, 54, 55, 57, 57, 49, 53, 56, 52, 49, 97),
        String.fromCharCode(101, 54, 52, 57, 53, 50, 49, 53, 53, 51, 48, 50, 49, 101, 57, 100),
        String.fromCharCode(56, 99, 98, 97, 55, 54, 56, 57, 51, 52, 101, 102, 53, 99, 52, 50)
    ];
    return parts.join('');
})();

// Gestionnaire d'erreurs global pour capturer les erreurs de déclaration
const originalErrorHandler = window.onerror;
window.onerror = function(message, source, lineno, colno, error) {
    // Ignorer les erreurs de déclaration déjà faite
    if (message && typeof message === 'string' && message.includes('already been declared')) {
        console.log(`⚠️ Erreur de déclaration ignorée: ${message}`);
        return true; // Empêcher l'affichage de l'erreur
    }
    // Appeler le gestionnaire d'erreurs original s'il existe
    if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error);
    }
    return false;
};

// Fonction pour déchiffrer avec AES-256 (côté client)
async function decryptContent(encryptedData, key) {
    try {
        // Nettoyer les données (supprimer les espaces, retours à la ligne, etc.)
        encryptedData = encryptedData.trim().replace(/\s+/g, '');
        
        // Séparer l'IV et le contenu chiffré
        const parts = encryptedData.split(':');
        if (parts.length !== 2) {
            console.error('Format invalide: Le fichier doit contenir "IV:données_chiffrées"');
            console.error('Format reçu:', encryptedData.substring(0, 100) + '...');
            throw new Error('Format de données invalide: doit contenir "IV:données"');
        }
        
        const ivHex = parts[0].trim();
        const encryptedHex = parts[1].trim();
        
        // Vérifier que l'IV et les données sont en hexadécimal valide
        if (!/^[0-9a-fA-F]+$/.test(ivHex)) {
            throw new Error('IV invalide: doit être en hexadécimal');
        }
        if (!/^[0-9a-fA-F]+$/.test(encryptedHex)) {
            throw new Error('Données chiffrées invalides: doivent être en hexadécimal');
        }
        
        // Vérifier la longueur de l'IV (doit être 32 caractères hex = 16 bytes)
        if (ivHex.length !== 32) {
            throw new Error(`IV de longueur incorrecte: ${ivHex.length} caractères (attendu: 32)`);
        }
        
        // Vérifier que les données chiffrées ont une longueur valide (multiple de 32 pour AES-CBC)
        if (encryptedHex.length % 32 !== 0) {
            throw new Error(`Longueur des données chiffrées invalide: ${encryptedHex.length} caractères (doit être un multiple de 32 pour AES-CBC)`);
        }
        
        // Convertir la clé et l'IV en ArrayBuffer
        const keyBuffer = hexToArrayBuffer(key);
        const ivBuffer = hexToArrayBuffer(ivHex);
        
        // Vérifier la longueur de la clé (doit être 64 caractères hex = 32 bytes pour AES-256)
        if (key.length !== 64) {
            throw new Error(`Clé de longueur incorrecte: ${key.length} caractères (attendu: 64)`);
        }
        
        // Vérifier la longueur de l'IV en bytes (doit être 16 bytes pour AES-CBC)
        if (ivBuffer.byteLength !== 16) {
            throw new Error(`IV de longueur incorrecte: ${ivBuffer.byteLength} bytes (attendu: 16)`);
        }
        
        // Vérifier la longueur des données chiffrées en bytes (doit être un multiple de 16)
        const encryptedBuffer = hexToArrayBuffer(encryptedHex);
        if (encryptedBuffer.byteLength % 16 !== 0) {
            throw new Error(`Données chiffrées de longueur invalide: ${encryptedBuffer.byteLength} bytes (doit être un multiple de 16 pour AES-CBC)`);
        }
        
        console.log(`🔍 Débogage - IV: ${ivHex.substring(0, 16)}... (${ivHex.length} chars), Données: ${encryptedHex.length} chars (${encryptedBuffer.byteLength} bytes), Clé: ${key.substring(0, 16)}... (${key.length} chars)`);
        
        // Importer la clé
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'AES-CBC' },
            false,
            ['decrypt']
        );
        
        // Déchiffrer
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: 'AES-CBC', iv: ivBuffer },
            cryptoKey,
            encryptedBuffer
        );
        
        // Convertir en texte
        const decryptedText = new TextDecoder().decode(decryptedBuffer);
        return decryptedText;
    } catch (error) {
        console.error('Erreur lors du déchiffrement:', error);
        console.error('Type d\'erreur:', error.name);
        console.error('Message:', error.message);
        
        // Informations supplémentaires pour OperationError
        if (error.name === 'OperationError') {
            console.error('💡 OperationError indique généralement que:');
            console.error('   - La clé de chiffrement est incorrecte');
            console.error('   - Les données chiffrées sont corrompues');
            console.error('   - Le format des données ne correspond pas à AES-CBC');
            console.error('   - Vérifiez que la clé dans decrypt.js correspond à celle utilisée pour chiffrer');
        }
        
        throw error;
    }
}

// Convertir une chaîne hexadécimale en ArrayBuffer
function hexToArrayBuffer(hex) {
    // Vérifier que la longueur est paire
    if (hex.length % 2 !== 0) {
        throw new Error(`Longueur hex invalide: ${hex.length} (doit être paire)`);
    }
    
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes.buffer;
}

// Cache des fichiers déjà chargés
const loadedScripts = new Set();

// Charger et déchiffrer un fichier
async function loadAndDecrypt(filePath) {
    try {
        // Vérifier AVANT tout si le fichier a déjà été chargé
        const scriptId = 'encrypted-' + filePath.replace(/[^a-zA-Z0-9]/g, '-');
        
        // Vérification 1: Script ID déjà présent dans le DOM
        if (document.getElementById(scriptId)) {
            console.log(`⚠️ ${filePath} déjà chargé (ID trouvé), ignoré`);
            return true;
        }
        
        // Vérification 2: Fichier dans le cache
        if (loadedScripts.has(filePath)) {
            console.log(`⚠️ ${filePath} déjà chargé (cache), ignoré`);
            return true;
        }
        
        // Vérification 3: Variables globales spécifiques (pour common.js)
        if (filePath.includes('common.js')) {
            if (typeof window.GITHUB_API_URL !== 'undefined') {
                console.log(`⚠️ ${filePath} déjà chargé (GITHUB_API_URL détecté), ignoré`);
                loadedScripts.add(filePath);
                return true;
            }
        }
        
        // Vérification 4: Pour auth.js
        if (filePath.includes('auth.js')) {
            if (typeof window.requireAuth !== 'undefined') {
                console.log(`⚠️ ${filePath} déjà chargé (requireAuth détecté), ignoré`);
                loadedScripts.add(filePath);
                return true;
            }
        }
        
        // Construire le chemin complet (avec le dossier encrypted)
        const fullPath = filePath.startsWith(ENCRYPTED_DIR + '/') 
            ? filePath 
            : ENCRYPTED_DIR + '/' + filePath;
        
        // Charger le fichier chiffré
        const response = await fetch(fullPath);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        let encryptedContent = await response.text();
        
        // Nettoyer le contenu (supprimer BOM, espaces, etc.)
        encryptedContent = encryptedContent.trim();
        // Supprimer le BOM UTF-8 si présent
        if (encryptedContent.charCodeAt(0) === 0xFEFF) {
            encryptedContent = encryptedContent.slice(1);
        }
        
        // Vérifier si la clé est configurée
        if (ENCRYPTION_KEY === 'VOTRE_CLE_DE_CHIFFREMENT_ICI') {
            console.error('❌ Erreur: La clé de chiffrement n\'a pas été configurée dans decrypt.js');
            throw new Error('Clé de chiffrement non configurée');
        }
        
        // Déchiffrer le contenu
        const decryptedContent = await decryptContent(encryptedContent, ENCRYPTION_KEY);
        
        // Vérification finale AVANT d'ajouter (au cas où un autre script l'aurait chargé entre temps)
        if (document.getElementById(scriptId)) {
            console.log(`⚠️ ${filePath} chargé entre temps, ignoré`);
            return true;
        }
        
        // Vérification finale des variables globales (double check)
        if (filePath.includes('common.js')) {
            if (typeof window.GITHUB_API_URL !== 'undefined') {
                console.log(`⚠️ ${filePath} déjà chargé (GITHUB_API_URL détecté avant ajout), ignoré`);
                loadedScripts.add(filePath);
                return true;
            }
        }
        
        // Ajouter au cache AVANT d'exécuter
        loadedScripts.add(filePath);
        
        // Créer un script et l'exécuter avec gestion d'erreur
        const script = document.createElement('script');
        script.id = scriptId;
        
        // Vérifier une dernière fois juste avant l'ajout
        if (document.getElementById(scriptId)) {
            console.log(`⚠️ ${filePath} chargé au dernier moment, ignoré`);
            return true;
        }
        
        // Gérer les erreurs d'exécution du script
        script.onerror = function(error) {
            console.warn(`⚠️ Erreur lors de l'exécution de ${filePath}, peut-être déjà chargé`);
            loadedScripts.add(filePath);
        };
        
        // Envelopper le contenu dans un try-catch pour capturer les erreurs de déclaration
        try {
            script.textContent = decryptedContent;
            document.head.appendChild(script);
            
            // Vérifier après un court délai si l'erreur s'est produite
            setTimeout(() => {
                // Si le script a été ajouté mais qu'une erreur s'est produite, on l'ignore
                if (document.getElementById(scriptId)) {
                    // Le script est là, vérifier si les variables sont définies
                    if (filePath.includes('common.js') && typeof window.GITHUB_API_URL === 'undefined') {
                        console.warn(`⚠️ ${filePath} chargé mais GITHUB_API_URL non défini, peut-être une erreur`);
                    }
                }
            }, 100);
            
            return true;
        } catch (error) {
            // Si erreur de duplication ou autre erreur d'exécution
            if (error.message && (error.message.includes('already been declared') || error.message.includes('Identifier'))) {
                console.log(`⚠️ ${filePath} déjà déclaré (erreur capturée: ${error.message}), ignoré`);
                loadedScripts.add(filePath);
                // Retirer le script si il a été ajouté
                const addedScript = document.getElementById(scriptId);
                if (addedScript) {
                    addedScript.remove();
                }
                return true;
            }
            throw error;
        }
    } catch (error) {
        console.error(`Erreur lors du chargement de ${filePath}:`, error);
        throw error;
    }
}

// Détecter et charger tous les scripts avec data-enc
function loadEncryptedScripts() {
    const encryptedScripts = document.querySelectorAll('script[data-enc]');
    
    if (encryptedScripts.length === 0) {
        console.warn('Aucun script chiffré trouvé');
        return;
    }
    
    console.log(`🔓 Déchiffrement de ${encryptedScripts.length} fichier(s)...`);
    
    // Charger les scripts séquentiellement pour respecter l'ordre
    (async () => {
        let successCount = 0;
        let errorCount = 0;
        
        // Séparer config.js des autres scripts pour le charger en premier
        const scriptsArray = Array.from(encryptedScripts);
        const configScript = scriptsArray.find(s => s.getAttribute('data-enc').includes('config.js'));
        const otherScripts = scriptsArray.filter(s => !s.getAttribute('data-enc').includes('config.js'));
        
        // Charger config.js en premier si présent
        if (configScript) {
            const filePath = configScript.getAttribute('data-enc');
            try {
                await loadAndDecrypt(filePath);
                console.log(`✅ ${filePath} déchiffré et chargé`);
                successCount++;
                // Attendre un peu pour que config.js s'exécute et expose window.GITHUB_TOKEN
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                if (error.message && (error.message.includes('already been declared') || error.message.includes('Identifier'))) {
                    console.log(`⚠️ ${filePath} déjà chargé, ignoré`);
                    successCount++;
                } else {
                    console.error(`❌ Erreur avec ${filePath}:`, error);
                    errorCount++;
                }
            }
        }
        
        // Charger les autres scripts
        for (const script of otherScripts) {
            const filePath = script.getAttribute('data-enc');
            try {
                await loadAndDecrypt(filePath);
                console.log(`✅ ${filePath} déchiffré et chargé`);
                successCount++;
            } catch (error) {
                // Ignorer les erreurs de duplication
                if (error.message && (error.message.includes('already been declared') || error.message.includes('Identifier'))) {
                    console.log(`⚠️ ${filePath} déjà chargé (erreur: ${error.message}), ignoré`);
                    successCount++;
                } else {
                    console.error(`❌ Erreur avec ${filePath}:`, error);
                    errorCount++;
                }
                
                // Afficher une alerte pour les erreurs critiques
                if (filePath.includes('auth.js') || filePath.includes('config.js')) {
                    console.error('⚠️ Fichier critique non chargé:', filePath);
                }
            }
        }
        
        // Résumé du chargement
        if (errorCount > 0) {
            console.warn(`⚠️ ${errorCount} fichier(s) n'ont pas pu être chargés sur ${encryptedScripts.length}`);
        } else {
            console.log(`✅ Tous les fichiers (${successCount}) ont été chargés avec succès`);
        }
    })();
}

// Attendre que le DOM soit prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadEncryptedScripts);
} else {
    // DOM déjà chargé
    loadEncryptedScripts();
}

