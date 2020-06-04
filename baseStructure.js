const { Collection } = require('discord.js')
const { EventEmitter } = require('events')
class baseStructure extends EventEmitter {
    /**
     * 
     * @param {string} apiKey Your API key
     * @param {string} name 
     */
    constructor(apiKey, name){
        super()
        this.apiKey = apiKey
        this.name = name
    }
}
module.exports = baseStructure