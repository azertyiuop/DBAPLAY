// Loader minimal pour déchiffrer decrypt.js
// La clé est construite dynamiquement pour l'obscurcir

(function() {
    'use strict';
    
    // Clé de base pour déchiffrer decrypt.js (obscurcie)
    // Construite à partir de plusieurs parties pour éviter qu'elle soit visible en clair
    // Cette clé sera mise à jour automatiquement par encrypt.js
    const keyParts = [
        'ed8a646633c3c98d',
        '79c0ceda491ef433',
        '1d1df8b7f8de7a1d',
        '8167b99c07719462'
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
            
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'AES-CBC' },
                false,
                ['decrypt']
            );
            
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-CBC', iv: ivBuffer },
                cryptoKey,
                encryptedBuffer
            );
            
            const decryptedText = new TextDecoder().decode(decryptedBuffer);
            return decryptedText;
        } catch (error) {
            console.error('Erreur lors du déchiffrement de decrypt.js:', error);
            throw error;
        }
    }
    
    // Charger et déchiffrer decrypt.js
    async function loadDecryptJs() {
        try {
            const response = await fetch(ENCRYPTED_DIR + '/decrypt.js.enc.js');
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            let encryptedContent = await response.text();
            encryptedContent = encryptedContent.trim();
            if (encryptedContent.charCodeAt(0) === 0xFEFF) {
                encryptedContent = encryptedContent.slice(1);
            }
            
            const decryptedContent = await decryptDecryptJs(encryptedContent, LOADER_KEY);
            
            // Exécuter le decrypt.js déchiffré
            const script = document.createElement('script');
            script.textContent = decryptedContent;
            document.head.appendChild(script);
            
            return true;
        } catch (error) {
            console.error('Erreur lors du chargement de decrypt.js:', error);
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

