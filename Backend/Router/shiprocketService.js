const axios = require('axios');

const SHIPROCKET_API_BASE = process.env.SHIPROCKET_API_BASE || 'https://apiv2.shiprocket.in';
let shiprocketToken = null;
let tokenExpiry = null;
// After a failed login, wait before trying again. Every checkout/order asks for a token, and
// retrying a rejected login on each one keeps adding failed attempts, which gets (and keeps)
// the Shiprocket account blocked.
const LOGIN_RETRY_COOLDOWN_MS = 10 * 60 * 1000;
let loginRetryAfter = null;

const getShiprocketToken = async () => {
    try {
        if (shiprocketToken && tokenExpiry && new Date() < tokenExpiry) {
            return shiprocketToken;
        }
        if (loginRetryAfter && new Date() < loginRetryAfter) {
            return null;
        }

        const email = process.env.SHIPROCKET_EMAIL;
        const password = process.env.SHIPROCKET_PASSWORD;

        if (!email || !password) {
            console.error('Shiprocket credentials not found in environment variables.');
            return null;
        }

        const response = await axios.post(`${SHIPROCKET_API_BASE}/v1/external/auth/login`, {
            email,
            password
        });

        if (response.data && response.data.token) {
            shiprocketToken = response.data.token;
            // Token is usually valid for 10 days, setting it to 9 days to be safe
            tokenExpiry = new Date(new Date().getTime() + 9 * 24 * 60 * 60 * 1000);
            loginRetryAfter = null;
            return shiprocketToken;
        }
        return null;
    } catch (error) {
        console.error('Error fetching Shiprocket token:', error.response?.data || error.message);
        // Rejected credentials / blocked account: don't retry on every request.
        if (error.response && [400, 401, 403].includes(error.response.status)) {
            loginRetryAfter = new Date(Date.now() + LOGIN_RETRY_COOLDOWN_MS);
        }
        return null;
    }
};

/**
 * Runs a Shiprocket API call with the cached login token. If Shiprocket rejects the token
 * (401 — it expired early, or the password was changed), the cached token is dropped and the
 * call is retried once with a fresh login, instead of failing every call until it expires.
 */
const withToken = async (send) => {
    const token = await getShiprocketToken();
    if (!token) throw new Error('Shiprocket authentication failed');
    try {
        return await send(token);
    } catch (error) {
        if (error.response?.status !== 401) throw error;
        if (shiprocketToken === token) {
            shiprocketToken = null;
            tokenExpiry = null;
        }
        const freshToken = await getShiprocketToken();
        if (!freshToken) throw error;
        return send(freshToken);
    }
};

const createShiprocketOrder = async (orderData) => {
    try {
        const response = await withToken((token) => axios.post(`${SHIPROCKET_API_BASE}/v1/external/orders/create/adhoc`, orderData, {
                headers: { Authorization: `Bearer ${token}` }
            }));
        return response.data;
    } catch (error) {
        console.error('Error creating Shiprocket order:', error.response?.data || error.message);
        throw error;
    }
};

const checkServiceability = async (pickupPincode, deliveryPincode, weight, cod = 0) => {
    try {
        const response = await withToken((token) => axios.get(`${SHIPROCKET_API_BASE}/v1/external/courier/serviceability`, {
                params: {
                    pickup_postcode: pickupPincode,
                    delivery_postcode: deliveryPincode,
                    weight: weight,
                    cod: cod
                },
                headers: { Authorization: `Bearer ${token}` }
            }));
        return response.data;
    } catch (error) {
         console.error('Error checking serviceability:', error.response?.data || error.message);
         throw error;
    }
};

const assignAWB = async (shipmentId, courierId = null) => {
    try {
        const payload = {
            shipment_id: shipmentId
        };

        if (courierId) {
            payload.courier_id = courierId;
        }

        const response = await withToken((token) => axios.post(`${SHIPROCKET_API_BASE}/v1/external/courier/assign/awb`, payload, {
            headers: { Authorization: `Bearer ${token}` }
        }));
        return response.data;
    } catch (error) {
        console.error('Error assigning AWB:', error.response?.data || error.message);
        throw error;
    }
};

const requestPickup = async (shipmentId) => {
    try {
        const response = await withToken((token) => axios.post(`${SHIPROCKET_API_BASE}/v1/external/courier/generate/pickup`, {
                shipment_id: [shipmentId]
            }, {
                headers: { Authorization: `Bearer ${token}` }
            }));
        return response.data;
    } catch (error) {
        console.error('Error requesting pickup:', error.response?.data || error.message);
        throw error;
    }
};

const generateLabel = async (shipmentId) => {
    try {
        const response = await withToken((token) => axios.post(`${SHIPROCKET_API_BASE}/v1/external/courier/generate/label`, {
                shipment_id: [shipmentId]
            }, {
                headers: { Authorization: `Bearer ${token}` }
            }));
        return response.data;
    } catch (error) {
        console.error('Error generating label:', error.response?.data || error.message);
        throw error;
    }
};

const trackAWB = async (awbCode) => {
    try {
        const response = await withToken((token) => axios.get(`${SHIPROCKET_API_BASE}/v1/external/courier/track/awb/${awbCode}`, {
                headers: { Authorization: `Bearer ${token}` }
            }));
        return response.data;
    } catch (error) {
        console.error('Error tracking AWB:', error.response?.data || error.message);
        throw error;
    }
};

const parseCityState = (address) => {
    let city = 'City';
    let state = 'State';
    if (address && typeof address === 'string') {
        const cleanAddress = address.replace(/[-\s,]*\d{6}\s*$/, '').trim();
        // Try splitting by comma first
        let parts = cleanAddress.split(',').map(p => p.trim()).filter(Boolean);
        
        // Fallback to splitting by space if comma splitting yields a single part
        if (parts.length < 2) {
            const spaceParts = cleanAddress.split(/\s+/).map(p => p.trim()).filter(Boolean);
            if (spaceParts.length >= 2) {
                parts = [
                    spaceParts.slice(0, spaceParts.length - 2).join(' '),
                    spaceParts[spaceParts.length - 2],
                    spaceParts[spaceParts.length - 1]
                ].filter(Boolean);
            }
        }
        
        if (parts.length >= 2) {
            state = parts[parts.length - 1];
            city = parts[parts.length - 2];
        } else if (parts.length === 1) {
            city = parts[0];
        }
    }

    // Map common Indian state abbreviations to full names
    const stateMap = {
        'up': 'Uttar Pradesh',
        'mp': 'Madhya Pradesh',
        'ap': 'Andhra Pradesh',
        'hp': 'Himachal Pradesh',
        'jk': 'Jammu and Kashmir',
        'dl': 'Delhi',
        'hr': 'Haryana',
        'pb': 'Punjab',
        'rj': 'Rajasthan',
        'mh': 'Maharashtra',
        'ka': 'Karnataka',
        'tn': 'Tamil Nadu',
        'kl': 'Kerala',
        'wb': 'West Bengal',
        'gj': 'Gujarat'
    };

    const cleanState = state.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (stateMap[cleanState]) {
        state = stateMap[cleanState];
    }

    return {
        city: city.substring(0, 30).trim() || 'City',
        state: state.substring(0, 30).trim() || 'State'
    };
};

const createShiprocketReturnOrder = async (returnData) => {
    try {
        const response = await withToken((token) => axios.post(`${SHIPROCKET_API_BASE}/v1/external/orders/create/return`, returnData, {
                headers: { Authorization: `Bearer ${token}` }
            }));
        return response.data;
    } catch (error) {
        console.error('Error creating Shiprocket return order:', error.response?.data || error.message);
        throw error;
    }
};

const createExchangeForwardOrder = async (orderData) => {
    try {
        const response = await withToken((token) => axios.post(`${SHIPROCKET_API_BASE}/v1/external/orders/create/adhoc`, orderData, {
                headers: { Authorization: `Bearer ${token}` }
            }));
        return response.data;
    } catch (error) {
        console.error('Error creating Shiprocket exchange forward order:', error.response?.data || error.message);
        throw error;
    }
};

const cancelShiprocketOrder = async (shiprocketOrderId) => {
    try {
        const response = await withToken((token) => axios.post(`${SHIPROCKET_API_BASE}/v1/external/orders/cancel`, {
                ids: [shiprocketOrderId]
            }, {
                headers: { Authorization: `Bearer ${token}` }
            }));
        return response.data;
    } catch (error) {
        console.error('Error cancelling Shiprocket order:', error.response?.data || error.message);
        // Best-effort, don't throw
        return null;
    }
};

// Webhook status mapping for exchange legs
const EXCHANGE_WEBHOOK_MAP = {
    reverse: {
        'Pickup Scheduled': 'Pickup Scheduled',
        'Out for Pickup': 'Pickup Scheduled',
        'Pickup Generated': 'Pickup Scheduled',
        'Picked Up': 'Old Item Picked Up',
        'In Transit': 'Old Item Picked Up',
        'Cancelled': 'Failed',
        'RTO': 'Failed',
        'RTO Initiated': 'Manual Review',
        'NDR': 'Manual Review',
        'Lost': 'Failed',
        'Undelivered': 'Manual Review'
    },
    forward: {
        'In Transit': 'Replacement Dispatched',
        'Out for Delivery': 'Replacement Dispatched',
        'Delivered': 'Completed',
        'Cancelled': 'Manual Review',
        'RTO': 'Manual Review',
        'RTO Initiated': 'Manual Review',
        'NDR': 'Manual Review',
        'Lost': 'Failed',
        'Undelivered': 'Manual Review'
    }
};

module.exports = {
    getShiprocketToken,
    createShiprocketOrder,
    checkServiceability,
    assignAWB,
    requestPickup,
    generateLabel,
    trackAWB,
    parseCityState,
    createShiprocketReturnOrder,
    createExchangeForwardOrder,
    cancelShiprocketOrder,
    EXCHANGE_WEBHOOK_MAP
};
