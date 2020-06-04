const { Collection } = require('discord.js')
const { EventEmitter } = require('events')
const baseStructure = require('./baseStructure')
const document = require('./document')
const https = require('https')
const getAllData = res => {
    return new Promise((resolve, reject) => {
        let buffer = []
        res.on('data', data => buffer.push(data))
        res.on('end', () => resolve(JSON.parse(buffer.join(''))))
    })
}
const getBrokenData = res => {
    return new Promise((resolve, reject) => {
        let buffer = []
        res.on('data', data => buffer.push(data))
        res.on('end', () => resolve(buffer.join('')))
    })
}
/**
 * @extends {baseStructure}
 * This is a cached collection of documents
 */
class collection extends baseStructure {
    /**
     * 
     * @param {string} apiKey Your API key
     * @param {string} name The name of the collection
     * @param {Array} documents 
     * @param {string} databaseName 
     */
    constructor(apiKey, name, documents, databaseName){
        super(apiKey, name)
        /**
         * @type {Collection<string, document>}
         */
        this.documents = new Collection(documents)
        /**
         * @type {String}
         */
        this.databaseName = databaseName
    }
    addDocument(doc){
        if(this.documents.has(doc.id)) return this.updateDocument(doc)
        return new Promise((resolve, reject) => {
            let req = https.request({
                host:'api.mlab.com',
                path:`/api/1/databases/${this.databaseName}/collections/${this.name}?apiKey=${this.apiKey}`,
                headers:{
                    "content-type":'application/json'
                },
                method:'POST'
            })
            .on('response', async res => {
                if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                let data = await getAllData(res)
                this.documents.set(doc.id, new document(this.apiKey, doc.id, doc))
                resolve()
            })
            req.write(JSON.stringify([doc]))
            req.end()

        })
    }
    addDocuments(docs){
        return Promise.all(docs.map(doc => this.addDocument(doc)))
    }
    addDocumentsForce(docs){
        let newDocs = docs.filter(doc => !this.documents.has(doc.id))
        docs.map(doc => this.documents.has(doc.id)).forEach(doc => this.updateDocument(doc))
        return new Promise((resolve, reject) => {
            let req = https.request({
                host:'api.mlab.com',
                path:`/api/1/databases/${this.databaseName}/collections/${this.name}?apiKey=${this.apiKey}`,
                headers:{
                    "content-type":'application/json'
                },
                method:'POST'
            })
            .on('response', async res => {
                if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                let data = await getAllData(res)
                newDocs.forEach(doc => this.documents.set(doc.id, new document(this.apiKey, doc.id, doc)))
                resolve()
            })
            req.write(JSON.stringify(newDocs))
            req.end()

        })
    }
    updateDocument(document){
        return new Promise((resolve, reject) => {
            let newDoc = Object.assign({}, this.documents.get(document.id).data)
            Object.assign(newDoc, document)
            let req = https.request({
                host:'api.mlab.com',
                path:`/api/1/databases/${this.databaseName}/collections/${this.name}/${newDoc._id.$oid}?apiKey=${this.apiKey}`,
                headers:{
                    "content-type":'application/json'
                },
                method:'PUT'
            })
            .on('response', async res => {
                if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                let data = await getAllData(res)
                this.documents.get(newDoc.id).data = data
                resolve()
            })
            req.write(JSON.stringify({$set:newDoc}))
            req.end()

        })
    }
    removeDocument(documentID){
        if(!this.documents.has(documentID)) return
        return new Promise((resolve, reject) => {
            let doc = this.documents.get(document.id).data
            let req = https.request({
                host:'api.mlab.com',
                path:`/api/1/databases/${this.databaseName}/collections/${this.name}/${doc._id.$oid}?apiKey=${this.apiKey}`,
                headers:{
                    "content-type":'application/json'
                },
                method:'DELETE'
            })
            .on('response', async res => {
                if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                let data = await getAllData(res)
                this.documents.delete(doc.id)
                resolve()
            })
            req.end()
        })
    }
    filterDocuments(fn){
        let results = new Collection();
        [...this.documents.entries()].forEach(([key, val]) => {
            if(fn(val, key)) results.set(key, val)
        })
        return results
    }
    findDocument(fn){
        let r;
        [...this.documents.entries()].forEach(([key, val]) => {
            if(!r && fn(val, key)) r = val
        })
        return r
    }
}
module.exports = collection