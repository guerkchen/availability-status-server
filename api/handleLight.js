const axios = require('axios');
const { rgbToXyFromHex } = require('./rgbtoxy');
const { getAccessToken, getApplicationKey } = require('./huetoken');
const { berechneLampenHelligkeit } = require('./brightness');
const { getDefaultStatus } = require('./statusHelpers');

async function handleLight(context, req) {
    const applicationKey = getApplicationKey();
    const access_token = getAccessToken();
    if (!access_token || !applicationKey) {
        return res.send('Kein Access Token oder Application Key. Bitte zuerst /auth aufrufen.');
    }

    try {
        // Lampen abfragen
        const resources = await axios.get('https://api.meethue.com/route/clip/v2/resource/light', {
            headers: {
                Authorization: `Bearer ${access_token}`,
                'hue-application-key': applicationKey
            }
        });

        if (!resources.data.data || resources.data.data.length === 0) {
            if (context.res == undefined) {
                console.error('Keine Lampen gefunden.');
            } else {
                context.res.status(404).send('Keine Lampen gefunden.');
            }
            return;
        }

        // Lampe suchen
        const light = resources.data.data.find(
            l => l.metadata && l.metadata.name === process.env.HUE_LIGHT_NAME
        );
        if (!light) {
            if (context.res == undefined) {
                console.error(`Lampe "${process.env.HUE_LIGHT_NAME}" nicht gefunden.`);
            } else {
                context.res.status(404).send(`Lampe "${process.env.HUE_LIGHT_NAME}" nicht gefunden.`);
            }
            return;
        }
        const lightId = light.id;

        console.log('Steuere Lampe:', lightId);
        // Status abrufen
        const statusURL = process.env.AZURE_FUNCTION_URL + "/status";
        const statusResponse = await axios.get(statusURL);
        const colorRGB = statusResponse.data.color;
        const colorXY = rgbToXyFromHex(colorRGB);
        console.log("Lampenhelligkeit:", await berechneLampenHelligkeit());

        const helligkeit = await berechneLampenHelligkeit();
        const brightness = parseInt(helligkeit.lampenHelligkeit);

        const defaultStatus = await getDefaultStatus();
        console.log(`Neuer Status: ${statusResponse.data.status}, Default Status : ${getDefaultStatus().status}`);

        const on = statusResponse.data.status != defaultStatus.status;
        console.log(`Lampe ${lightId} ("${process.env.HUE_LIGHT_NAME}") soll auf ${colorRGB} gesetzt werden. Helligkeit: ${brightness}, Status: ${on ? 'An' : 'Aus'}`);

        // Lampe anschalten
        await axios.put(
            `https://api.meethue.com/route/clip/v2/resource/light/${lightId}`,
            {
                "on": { "on": on },
                "dimming": { "brightness": brightness },
                "color": { "xy": { "x": colorXY[0], "y": colorXY[1] } }
            },
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    'hue-application-key': applicationKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (context.res == undefined) {
            console.log(`Lampe ${lightId} ("${process.env.HUE_LIGHT_NAME}") auf ${colorRGB} gesetzt.`);
        } else {
            context.res.send(`Lampe ${lightId} ("${process.env.HUE_LIGHT_NAME}") auf ${colorRGB} gesetzt.`);
        }
    } catch (err) {
        // Fehlerausgabe mit genauerer Fehlerbeschreibung
        if (err.response?.data?.errors) {
            console.error('Hue API Fehler:', JSON.stringify(err.response.data.errors, null, 2));
        } else {
            console.error(err.response?.data || err.message);
        }
        if (context.res == undefined) {
            console.error('Fehler beim Setzen der Lampe:', err.message);
        } else {
            context.res.status(500).send(`Fehler beim Setzen der Lampe: ${err.message}`);
        }
    }
};

module.exports = { handleLight };