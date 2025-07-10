// Importieren der benötigten Module
const axios = require('axios');
const { TableClient } = require("@azure/data-tables");
const { isStatusValid, isExpired, getDefaultStatus, loadStatusList } = require("../statusHelpers");

// Konfiguration der Tabelle und Verbindung
const tableName = "StatusTable"; // Name der Azure-Tabelle
const partitionKey = "status"; // Partition-Key für die Tabelle
const rowKey = "singleton"; // Wir speichern nur einen Status
const connectionString = process.env.TableStorageConnectionString; // Verbindung zur Azure-Tabelle

// Funktion zur Verarbeitung von POST-Anfragen
async function handlePostRequest(client, context, req) {
    const { status } = req.body; // Extrahieren des Status aus der Anfrage
    if (!status || !(await isStatusValid(status))) { // Validierung des Status
        context.res = { status: 400, body: "Ungültiger Status." }; // Fehlerantwort
        return;
    }

    // Erstellen des Entity-Objekts für die Tabelle
    const entity = {
        partitionKey,
        rowKey,
        status,
        timestamp: new Date().toISOString() // Zeitstempel hinzufügen
    };

    // Speichern des Status in der Tabelle
    await client.upsertEntity(entity, "Replace");
    context.res = { status: 200, body: { message: "Status gespeichert." } }; // Erfolgsantwort

    // Push an /light, dass es ein Auto-Update macht
    const lightURL = process.env.AZURE_FUNCTION_URL + "/light";
    console.log("Triggering light update at:", lightURL);
    axios.post(lightURL); // Es wird auf keine Antwort gewartet, da es nur ein Trigger ist
}

// Funktion zur Verarbeitung von GET-Anfragen
async function handleGetRequest(client, context) {
    try {
        // Abrufen des gespeicherten Status aus der Tabelle
        const entity = await client.getEntity(partitionKey, rowKey);
        const savedTime = new Date(entity.timestamp); // Zeitstempel des gespeicherten Status

        // Überprüfen, ob der Status abgelaufen ist
        if (!entity || isExpired(savedTime, 6)) { // Ablaufzeit: 6 Stunden
            try {
                const defaultStatus = await getDefaultStatus(); // Standardstatus abrufen
                await client.upsertEntity({
                    partitionKey,
                    rowKey,
                    status: defaultStatus.status,
                    timestamp: new Date().toISOString() // Zeitstempel aktualisieren
                }, "Replace");

                context.res = { status: 200, body: defaultStatus }; // Standardstatus zurückgeben
            } catch (error) {
                console.error("Fehler beim Setzen des Standardstatus:", error); // Fehlerprotokollierung
                context.res = { status: 500, body: "Interner Serverfehler." }; // Fehlerantwort
            }
            return;
        }

        const statusList = await loadStatusList(); // Liste aller gültigen Status laden
        const statusItem = statusList.find(item => item.status === entity.status); // Status suchen

        if (!statusItem) { // Überprüfen, ob der Status gefunden wurde
            context.res = { status: 500, body: "Status nicht gefunden." }; // Fehlerantwort
            return;
        }

        // Erfolgsantwort mit dem gefundenen Status
        context.res = {
            status: 200,
            body: statusItem
        };
    } catch (err) {
        console.error("Fehler beim Abrufen des Status:", err); // Fehlerprotokollierung
        context.res = { status: 500, body: "Interner Serverfehler." }; // Fehlerantwort
    }
}

// Hauptfunktion zur Verarbeitung von HTTP-Anfragen
module.exports = async function (context, req) {
    const client = TableClient.fromConnectionString(connectionString, tableName); // Verbindung zur Tabelle herstellen

    // Tabelle anlegen, falls sie nicht existiert
    try {
        await client.createTable();
    } catch (e) {
        // Fehler ignorieren, falls Tabelle schon existiert
        if (!e.message.includes("TableAlreadyExists")) {
            throw e; // Andere Fehler weitergeben
        }
    }

    // Verarbeiten der Anfrage basierend auf der HTTP-Methode
    if (req.method === "POST") {
        await handlePostRequest(client, context, req); // POST-Anfrage verarbeiten
    } else if (req.method === "GET") {
        await handleGetRequest(client, context); // GET-Anfrage verarbeiten
    } else {
        context.res = { status: 405, body: "Method not allowed." }; // Fehlerantwort für nicht unterstützte Methoden
    }
};
