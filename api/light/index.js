const { handleLight } = require('../handleLight');

module.exports = async function (context, req) {
    console.log('HTTP trigger function processed a request.');
    if (req.method != "POST") {
        context.res = { status: 405, body: "Method not allowed." };
    }

    await handleLight(context, req);
};