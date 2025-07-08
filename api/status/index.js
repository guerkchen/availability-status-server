const { TableClient } = require("@azure/data-tables");
const { getColorForStatus, isStatusValid, isExpired } = require("../statusHelpers");

const tableName = "StatusTable";
const partitionKey = "status";

const connectionString = process.env.TableStorageConnectionString;

module.exports = async function (context, req) {
    const client = TableClient.fromConnectionString(connectionString, tableName);

    // Tabelle anlegen, falls sie nicht existiert
    try {
        await client.createTable();
    } catch (e) {
        // Fehler ignorieren, falls Tabelle schon existiert
        if (!e.message.includes("TableAlreadyExists")) {
            throw e;
        }
    }

    const rowKey = "singleton"; // Wir speichern nur einen Status

    if (req.method === "POST") {
        const { status } = req.body;
        if (!status || !(await isStatusValid(status))) {
            context.res = { status: 400, body: "Ungültiger Status." };
            return;
        }

        const entity = {
            partitionKey,
            rowKey,
            status,
            timestamp: new Date().toISOString()
        };

        await client.upsertEntity(entity, "Replace");
        context.res = { status: 200, body: { message: "Status gespeichert." } };

    } else if (req.method === "GET") {
        try {
            const entity = await client.getEntity(partitionKey, rowKey);
            const savedTime = new Date(entity.timestamp);

            if (isExpired(savedTime, 6)) {
                await client.deleteEntity(partitionKey, rowKey);
                context.res = { status: 200, body: { status: "Expired", color: "#808080" } };
                return;
            }

            const color = await getColorForStatus(entity.status);
            context.res = {
                status: 200,
                body: {
                    status: entity.status,
                    color: color
                }
            };
        } catch (err) {
            context.res = { status: 404, body: "Kein Status gesetzt." };
        }
    } else {
        context.res = { status: 405, body: "Method not allowed." };
    }
};
