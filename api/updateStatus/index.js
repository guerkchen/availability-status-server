const { clearStatusList } = require("../statusHelpers");

module.exports = async function (context, req) {
    if (req.method === "POST") {
        clearStatusList();
        context.res = { status: 200, body: { message: "Status list cleared." } };
    } else {
        context.res = { status: 405, body: "Method not allowed." };
    }
};
