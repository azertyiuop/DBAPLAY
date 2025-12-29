// Système de stockage Supabase
// Remplace Firebase Realtime Database

let supabaseClient = null;
let isSupabaseInitialized = false;

// Fonction pour initialiser Supabase
async function initSupabase() {
    if (isSupabaseInitialized && supabaseClient) {
        return supabaseClient;
    }
    
    // Vérifier la configuration
    if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
        throw new Error('Configuration Supabase non trouvée. Veuillez configurer config.js');
    }
    
    try {
        // Utiliser l'API REST de Supabase (pas besoin du SDK)
        supabaseClient = {
            url: window.SUPABASE_CONFIG.url,
            key: window.SUPABASE_CONFIG.anonKey
        };
        isSupabaseInitialized = true;
        return supabaseClient;
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de Supabase:', error);
        throw error;
    }
}

// Fonction pour faire des requêtes à Supabase
async function supabaseRequest(method, table, data = null, filters = {}) {
    const client = await initSupabase();
    const url = `${client.url}/rest/v1/${table}`;
    
    const options = {
        method: method,
        headers: {
            'apikey': client.key,
            'Authorization': `Bearer ${client.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    };
    
    // Ajouter les filtres à l'URL
    let queryUrl = url;
    if (Object.keys(filters).length > 0) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            params.append(key, `eq.${value}`);
        });
        queryUrl += '?' + params.toString();
    }
    
    if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(queryUrl, options);
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erreur Supabase (${response.status}): ${error}`);
    }
    
    if (method === 'DELETE' || response.status === 204) {
        return null;
    }
    
    return await response.json();
}

// Fonction pour charger toutes les données depuis Supabase
async function loadDataFromSupabase() {
    try {
        // Charger depuis la table app_data
        const result = await supabaseRequest('GET', 'app_data');
        
        if (!result || result.length === 0) {
            // Initialiser avec des valeurs par défaut
            const defaultData = {
                id: 1,
                links: [],
                social_links: { discord: '', x: '' },
                admin_credentials: null,
                statistics: {
                    clicks: [],
                    visits: [],
                    daily_visits: {}
                },
                admin_messages: [],
                setup_page_enabled: true
            };
            
            await supabaseRequest('POST', 'app_data', defaultData);
            return {
                links: [],
                socialLinks: { discord: '', x: '' },
                adminCredentials: null,
                statistics: { clicks: [], visits: [], dailyVisits: {} },
                adminMessages: [],
                setupPageEnabled: true
            };
        }
        
        const data = result[0];
        
        // Convertir les noms de colonnes (snake_case vers camelCase)
        return {
            links: data.links || [],
            socialLinks: data.social_links || { discord: '', x: '' },
            adminCredentials: data.admin_credentials || null,
            statistics: {
                clicks: data.statistics?.clicks || [],
                visits: data.statistics?.visits || [],
                dailyVisits: data.statistics?.daily_visits || {}
            },
            adminMessages: data.admin_messages || [],
            setupPageEnabled: data.setup_page_enabled !== false
        };
    } catch (error) {
        console.error('❌ Erreur lors du chargement des données Supabase:', error);
        throw error;
    }
}

// Fonction pour sauvegarder toutes les données sur Supabase
async function saveDataToSupabase(data) {
    try {
        const client = await initSupabase();
        
        // Convertir les noms de colonnes (camelCase vers snake_case)
        const supabaseData = {
            id: 1,
            links: data.links || [],
            social_links: data.socialLinks || { discord: '', x: '' },
            admin_credentials: data.adminCredentials || null,
            statistics: {
                clicks: data.statistics?.clicks || [],
                visits: data.statistics?.visits || [],
                daily_visits: data.statistics?.dailyVisits || {}
            },
            admin_messages: data.adminMessages || [],
            setup_page_enabled: data.setupPageEnabled !== false
        };
        
        // Vérifier si les données existent déjà
        const existing = await supabaseRequest('GET', 'app_data', null, { id: 1 });
        
        if (existing && existing.length > 0) {
            // Mettre à jour
            await supabaseRequest('PATCH', 'app_data', supabaseData, { id: 1 });
        } else {
            // Créer
            await supabaseRequest('POST', 'app_data', supabaseData);
        }
        
        if (window.DATA_CACHE) {
            window.DATA_CACHE.data = data;
            window.DATA_CACHE.lastLoad = 0;
            window.DATA_CACHE.lastSuccessfulSave = Date.now();
        }
        
        try {
            const now = Date.now();
            localStorage.setItem('lastDataSave', now.toString());
            localStorage.setItem('cachedData', JSON.stringify(data));
            localStorage.setItem('cachedDataTime', now.toString());
        } catch (e) {}
        
        return true;
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde Supabase:', error);
        throw error;
    }
}

// Fonction pour écouter les nouvelles visites en temps réel (via polling)
function listenToNewVisits(callback) {
    let lastVisitCount = 0;
    
    setInterval(async () => {
        try {
            const data = await loadDataFromSupabase();
            const visits = data.statistics?.visits || [];
            
            if (visits.length > lastVisitCount) {
                const newVisits = visits.slice(lastVisitCount);
                newVisits.forEach(visit => {
                    if (callback) callback(visit);
                });
                lastVisitCount = visits.length;
            }
        } catch (error) {
            console.error('Erreur lors de l\'écoute des visites:', error);
        }
    }, 5000); // Vérifier toutes les 5 secondes
}

// Fonction pour écouter les nouveaux messages admin (via polling)
function listenToAdminMessages(callback) {
    let lastMessageCount = 0;
    
    setInterval(async () => {
        try {
            const data = await loadDataFromSupabase();
            const messages = data.adminMessages || [];
            
            if (messages.length !== lastMessageCount) {
                if (callback) callback(messages);
                lastMessageCount = messages.length;
            }
        } catch (error) {
            console.error('Erreur lors de l\'écoute des messages:', error);
        }
    }, 3000); // Vérifier toutes les 3 secondes
}

// Fonction pour ajouter un message admin
async function addAdminMessage(message) {
    try {
        const data = await loadDataFromSupabase();
        data.adminMessages = data.adminMessages || [];
        
        const newMessage = {
            id: Date.now().toString(),
            text: message.text,
            type: message.type || 'info',
            timestamp: new Date().toISOString(),
            active: message.active !== false
        };
        
        data.adminMessages.push(newMessage);
        
        // Garder seulement les 50 derniers messages
        if (data.adminMessages.length > 50) {
            data.adminMessages = data.adminMessages.slice(-50);
        }
        
        await saveDataToSupabase(data);
        return newMessage;
    } catch (error) {
        console.error('Erreur lors de l\'ajout du message:', error);
        throw error;
    }
}

// Fonction pour supprimer un message admin
async function deleteAdminMessage(messageId) {
    try {
        const data = await loadDataFromSupabase();
        data.adminMessages = data.adminMessages || [];
        data.adminMessages = data.adminMessages.filter(msg => msg.id !== messageId);
        
        await saveDataToSupabase(data);
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression du message:', error);
        throw error;
    }
}

// Exposer les fonctions globalement
window.initSupabase = initSupabase;
window.loadDataFromSupabase = loadDataFromSupabase;
window.saveDataToSupabase = saveDataToSupabase;
// Alias pour compatibilité avec l'ancien code
window.loadDataFromFirebase = loadDataFromSupabase;
window.saveDataToFirebase = saveDataToSupabase;
window.listenToNewVisits = listenToNewVisits;
window.listenToAdminMessages = listenToAdminMessages;
window.addAdminMessage = addAdminMessage;
window.deleteAdminMessage = deleteAdminMessage;
