const path = require('node:path')
const ports = require('./host-ports.json')

// Both products supply exactly these capabilities; unknown host imports fail resolution.
exports.createHostBindings = (bindings) => Object.fromEntries(ports.map((port) => {
  if (!bindings[port]) throw new Error(`Missing Amis host capability: ${port}`)
  return [`#ouroboros-host/${port}`, path.resolve(bindings[port])]
}))
