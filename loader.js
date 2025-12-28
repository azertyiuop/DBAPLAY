// Loader minimal pour déchiffrer decrypt.js
// La clé est construite dynamiquement pour l'obscurcir

(function() {
    'use strict';
    
    // Clé de base pour déchiffrer decrypt.js (obscurcie)
    // Construite à partir de plusieurs parties pour éviter qu'elle soit visible en clair
    // Cette clé sera mise à jour automatiquement par encrypt.js
    const keyParts = [
        '3f5f76ce6efc5479',
        'fb15cd089a059204',
        '1202f613f91650bb',
        '3c90243d11d1bfdd'
    ];
    const LOADER_KEY = keyParts.join('');
    const ENCRYPTED_DIR = 'encrypted';
    
    // Fonction pour convertir hex en ArrayBuffer
    function hexToArrayBuffer(hex) {
        if (hex.length % 2 !== 0) {
            throw new Error('Longueur hex invalide');
        }
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return bytes.buffer;
    }
    
    // Fonction pour déchiffrer decrypt.js
    async function decryptDecryptJs(encryptedData, key) {
        try {
            encryptedData = encryptedData.trim().replace(/\s+/g, '');
            const parts = encryptedData.split(':');
            if (parts.length !== 2) {
                throw new Error('Format invalide');
            }
            
            const ivHex = parts[0].trim();
            const encryptedHex = parts[1].trim();
            
            if (!/^[0-9a-fA-F]+$/.test(ivHex) || !/^[0-9a-fA-F]+$/.test(encryptedHex)) {
                throw new Error('Données invalides');
            }
            
            if (ivHex.length !== 32 || key.length !== 64) {
                throw new Error('Longueur invalide');
            }
            
            const keyBuffer = hexToArrayBuffer(key);
            const ivBuffer = hexToArrayBuffer(ivHex);
            const encryptedBuffer = hexToArrayBuffer(encryptedHex);
            
            if (ivBuffer.byteLength !== 16 || encryptedBuffer.byteLength % 16 !== 0) {
                throw new Error('Taille invalide');
            }
            
            // Vérifier que crypto.subtle est disponible
            if (!crypto || !crypto.subtle) {
                throw new Error('crypto.subtle n\'est pas disponible. Utilisez HTTPS ou localhost.');
            }
            
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'AES-CBC' },
                false,
                ['decrypt']
            );
            
            // Vérifier que la clé a été importée correctement
            if (!cryptoKey) {
                throw new Error('Échec de l\'importation de la clé de chiffrement');
            }
            
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-CBC', iv: ivBuffer },
                cryptoKey,
                encryptedBuffer
            );
            
            // Vérifier que le déchiffrement a réussi
            if (!decryptedBuffer || decryptedBuffer.byteLength === 0) {
                throw new Error('Le déchiffrement a retourné un buffer vide');
            }
            
            const decryptedText = new TextDecoder().decode(decryptedBuffer);
            return decryptedText;
        } catch (error) {
            console.error('Erreur lors du déchiffrement de decrypt.js:', error);
            console.error('Type d\'erreur:', error.name);
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
            
            // Informations de débogage supplémentaires
            if (error.name === 'OperationError') {
                console.error('💡 OperationError indique généralement que:');
                console.error('   - La clé de chiffrement ne correspond pas aux données');
                console.error('   - Les données chiffrées sont corrompues');
                console.error('   - Le format des données ne correspond pas à AES-CBC');
                console.error('   - Vérifiez que decrypt.js.enc.js a été chiffré avec la même clé que dans loader.js');
            } else if (error.name === 'NotSupportedError') {
                console.error('💡 NotSupportedError: crypto.subtle n\'est pas disponible');
                console.error('   - Utilisez HTTPS ou servez depuis localhost');
                console.error('   - Vérifiez que vous n\'êtes pas en mode HTTP non sécurisé');
            }
            
            throw error;
        }
    }
    
    // Charger et déchiffrer decrypt.js
    async function loadDecryptJs() {
        try {
            const filePath = ENCRYPTED_DIR + '/decrypt.js.enc.js';
            console.log('🔍 Chargement de', filePath);
            
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
            }
            
            let encryptedContent = await response.text();
            
            // Vérifier que le contenu n'est pas vide
            if (!encryptedContent || encryptedContent.trim().length === 0) {
                throw new Error('Le fichier decrypt.js.enc.js est vide');
            }
            
            encryptedContent = encryptedContent.trim();
            if (encryptedContent.charCodeAt(0) === 0xFEFF) {
                encryptedContent = encryptedContent.slice(1);
            }
            
            // Vérifier le format (doit contenir un ':')
            if (!encryptedContent.includes(':')) {
                throw new Error('Format invalide: le fichier doit contenir "IV:données_chiffrées"');
            }
            
            console.log('🔑 Déchiffrement avec la clé:', LOADER_KEY.substring(0, 16) + '...');
            const decryptedContent = await decryptDecryptJs(encryptedContent, LOADER_KEY);
            
            // Vérifier que le contenu déchiffré n'est pas vide
            if (!decryptedContent || decryptedContent.trim().length === 0) {
                throw new Error('Le contenu déchiffré est vide');
            }
            
            console.log('✅ decrypt.js déchiffré avec succès');
            
            // Exécuter le decrypt.js déchiffré
            const script = document.createElement('script');
            script.textContent = decryptedContent;
            document.head.appendChild(script);
            
            return true;
        } catch (error) {
            console.error('❌ Erreur lors du chargement de decrypt.js:', error);
            console.error('Type d\'erreur:', error.name);
            console.error('Message:', error.message);
            
            // Afficher un message d'erreur visible à l'utilisateur
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #ef4444; color: white; padding: 20px; z-index: 10000; font-family: monospace;';
            errorDiv.innerHTML = `
                <strong>❌ Erreur de chargement</strong><br>
                ${error.message}<br>
                <small>Vérifiez la console pour plus de détails (F12)</small>
            `;
            document.body.appendChild(errorDiv);
            
            throw error;
        }
    }
    
    // Charger decrypt.js dès que possible
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadDecryptJs);
    } else {
        loadDecryptJs();
    }
})();

