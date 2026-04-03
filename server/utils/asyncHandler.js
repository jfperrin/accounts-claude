// Wrapper pour les handlers Express async.
// Sans ce wrapper, une exception lancée dans un handler async ne serait pas
// capturée par Express et ferait planter le process sans réponse au client.
// Ici, on enveloppe fn() dans Promise.resolve() pour uniformiser sync/async,
// puis .catch(next) transmet l'erreur au gestionnaire global dans app.js.
//
// Usage : router.get('/', wrap(async (req, res) => { ... }))

module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
