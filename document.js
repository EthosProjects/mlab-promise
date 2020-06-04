const { EventEmitter } = require('events')
const baseStructure = require('./baseStructure')
/**
 * @extends {baseStructure}
 */
class document extends baseStructure {
    /**
     * 
     * @param {string} apiKey 
     * @param {string} name 
     * @param {Object} data 
     */
    constructor(apiKey, name, data){
        super(apiKey, name)
        this.data = data
    }
}
module.exports = document