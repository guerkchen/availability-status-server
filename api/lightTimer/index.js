const { handleLight } = require('../handleLight');

module.exports = async function (context, req) {
    console.log('Timer trigger function processed a request.');
    await handleLight(context, req);
}
