// Vercel funksiyası: /api/* sorğuları vercel.json-dakı rewrite ilə bura gəlir
const { handleApi } = require('../lib/core');

module.exports = (req, res) => handleApi(req, res);
module.exports.config = { api: { bodyParser: false } };
