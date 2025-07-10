const axios = require('axios');

let statusList = null;

async function loadStatusList() {
    if (!statusList) {
        const appUrl = process.env.APP_URL;
        try {
            console.log("Lade Statusliste von:", appUrl + '/data/status.json');
            const statusListResponse = await axios.get(appUrl + '/data/status.json');
            statusList = statusListResponse.data;
        } catch (error) {
            console.error("Fehler beim Laden der Statusliste:", error);
            throw new Error("Statusliste konnte nicht geladen werden.");
        }
    }
    return statusList;
}

async function isStatusValid(status) {
    const list = await loadStatusList();
    return list.some(item => item.status === status);
}

async function getDefaultStatus() {
    const list = await loadStatusList();
    const defaultStatus = list.find(item => item.default === true);
    if (!defaultStatus) {
        console.error("Fehler: Kein Standardstatus gefunden.");
        throw new Error("Kein Standardstatus gefunden.");
    }
    return defaultStatus;
}

function isExpired(timestamp, maxHours) {
    const now = new Date();
    const diffMs = now - timestamp;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > maxHours;
}

function clearStatusList() {
    statusList = null;
}

module.exports = { isStatusValid, isExpired, clearStatusList, getDefaultStatus, loadStatusList };
