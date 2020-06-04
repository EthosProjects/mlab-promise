const Collection = require('discord.js').Collection
const baseStructure = require('./baseStructure')
const collection = require('./collection')
/**
 * A database structure
 * @extends {baseStructure}
 */
class database extends baseStructure {
    /**
     * 
     * @param {string} apiKey Your API key
     * @param {string} name 
     * @param {Map.<string, collection>} collections collections to add by default
     */
    constructor(apiKey, name, collections){
        super(apiKey, name)
        /**
         * @type {Collection<string, collection>}
         */
        this.collections = new Collection(collections)
    }
    /**
     * 
     * @param {string} name Name of the collection to create
     */
    addCollection(name){
        this.collections.set(name, new collection(this.apiKey, name, [], this.name))
    }
}
module.exports = database