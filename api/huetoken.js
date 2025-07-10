const express = require('express');
const axios = require('axios');
const qs = require('querystring');
const { TableClient } = require('@azure/data-tables');


const CLIENT_ID = process.env.HUE_CLIENT_ID;
const CLIENT_SECRET = process.env.HUE_CLIENT_SECRET;

const TABLE_NAME = process.env.HUE_TABLE_NAME;
const PARTITION_KEY = process.env.HUE_PARTITION_KEY;
const ROW_KEY = process.env.HUE_ROW_KEY;
const connectionString = process.env.TableStorageConnectionString;

let applicationKey = null; // hue-application-key (Bridge-Token)
let access_token = null;
let refresh_token = null;

const app = express();

// Beim Start: Refresh Token laden und ggf. Access Token + AppKey holen
(async () => {
    refresh_token = await loadRefreshToken();
    if (refresh_token) {
        console.log("Gefundener Refresh Token, versuche Access Token zu holen...");
        await refreshTokensAndAppKey();
    }
})();

// Azure Table Helper
async function saveRefreshToken(token) {
    const client = TableClient.fromConnectionString(connectionString, TABLE_NAME);
    try { await client.createTable(); } catch (e) { }
    await client.upsertEntity({
        partitionKey: PARTITION_KEY,
        rowKey: ROW_KEY,
        refresh_token: token
    }, "Replace");
}

async function loadRefreshToken() {
    const client = TableClient.fromConnectionString(connectionString, TABLE_NAME);
    try {
        const entity = await client.getEntity(PARTITION_KEY, ROW_KEY);
        return entity.refresh_token;
    } catch (e) {
        return null;
    }
}

function getAccessToken() {
    if (!access_token) {
        throw new Error("Access Token ist nicht gesetzt. Bitte zuerst /auth aufrufen.");
    }
    return access_token;
}

function getApplicationKey() {
    if (!applicationKey) {
        throw new Error("Application Key ist nicht gesetzt. Bitte zuerst /auth aufrufen.");
    }
    return applicationKey;
}

async function loadApplicationKey(access_token, refresh_token) {
    try {
        await axios.put(
            'https://api.meethue.com/route/api/0/config',
            { linkbutton: true },
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        // Application Key erzeugen
        const appKeyResp = await axios.post(
            'https://api.meethue.com/route/api',
            { devicetype: "Availability Light" },
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        applicationKey = appKeyResp.data[0]?.success?.username;
        console.log("Application Key *** aktualisiert");
    } catch (e) {
        console.error("Fehler beim Ermitteln des Application Keys:", e.response?.data || e.message);
    }
}

// Hole Access Token und Application Key mit Refresh Token
async function refreshTokensAndAppKey() {
    if (!refresh_token) return;

    // 1. Access Token holen
    const response = await axios.post(
        'https://api.meethue.com/v2/oauth2/token',
        qs.stringify({
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        }),
        {
            auth: {
                username: CLIENT_ID,
                password: CLIENT_SECRET
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );

    access_token = response.data.access_token;
    refresh_token = response.data.refresh_token;
    await saveRefreshToken(refresh_token);

    loadApplicationKey(access_token, refresh_token);
}

module.exports = { refreshTokensAndAppKey, loadApplicationKey, loadRefreshToken, getAccessToken, getApplicationKey };