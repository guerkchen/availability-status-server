const fs = require('fs');
const path = require('path');
const axios = require('axios');

let statusList = null;

async function loadStatusList() {
    if (!statusList) {
        const appUrl = process.env.APP_URL || 'http://localhost:8080'; // Fallback für lokale Entwicklung
        const statusListResponse = await axios.get(appUrl + '/data/status.json');
        statusList = statusListResponse.data;
    }
    return statusList;
}

async function getColorForStatus(status) {
    const list = await loadStatusList();
    const statusItem = list.find(item => item.status === status);
    return statusItem ? statusItem.color : "#FFFFFF"; // Weiß
}

async function isStatusValid(status) {
    const list = await loadStatusList();
    return list.some(item => item.status === status);
}

function isExpired(timestamp, maxHours) {
    const now = new Date();
    const diffMs = now - timestamp;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > maxHours;
}

module.exports = { getColorForStatus, isStatusValid, isExpired, loadStatusList };
