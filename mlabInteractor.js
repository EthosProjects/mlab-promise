'use strict';
const https = require('https')
const { EventEmitter } = require('events')
const database = require('./database')
const collection = require('./collection')
const document = require('./document')
const Collection = require('discord.js').Collection
/**
 * @typedef changeResult
 * @property {number} n 
 * @property {removed} number
 */
/**
 * 
 * @typedef Query
 * @type {Map<string,string|number|boolean>}
 */
const parseMap = map => {
    map = JSON.parse(`{${Array.from(map).map(([key, value]) => `"${key}":${value}`).join(',')}}`)
    return map
}
let formFormat = data => {
    return Object.keys(data).map(k => {
        if(!data[k]) return ''
        if(data[k] instanceof Map){
            data[k] = parseMap(data[k])
        }
        if(data[k].toString() == '[object Object]') data[k] = JSON.stringify(data[k])
        return `${k}=${encodeURIComponent(data[k])}`
    }).filter(d => d).join('&')
}
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
 * The main hub for communicating with mLab
 */
class mlabInteractor extends EventEmitter {
    /**
     * @param {string} apiKey 
     * @param {Array.<string>} ignore
     * 
     */
    constructor(apiKey, cache, ignore = []){
        super()
        this.apiKey = apiKey;
        /**
         * @type {Collection<string, database>}
         */
        this.databases = new Collection()

        https.request({
            host:'api.mongolab.com',
            path:`/api/1/databases?apiKey=${apiKey}`,
            method:"GET"
        })
        .on('response', async res => {
            if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
            if(!cache) return
            let data = await getAllData(res)
            data = data.filter(d => !ignore.includes(d))
            let dataPromise = data.map(async databaseName => {
                return new Promise(resolve => {
                    https.get(`https://api.mongolab.com/api/1/databases/${databaseName}/collections?apiKey=${apiKey}`)
                    .on('response', async res => {
                        if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                        let data = await getAllData(res)
                        let skip = ['objectlabs-system', 'objectlabs-system.admin.collections', 'system.indexes']
                        data = data.filter(d => !skip.includes(d))
                        /**
                         * @type {Array.<Promise<collection>>}
                         */
                        let dataPromise = data.map(async collectionName => {
                            return new Promise(resolve => {
                                https.get(`https://api.mongolab.com/api/1/databases/${databaseName}/collections/${collectionName}?apiKey=${apiKey}`)
                                .on('response', async res => {
                                    if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                                    let data = await getAllData(res)
                                    resolve(new collection(apiKey, collectionName, data.map(d => [d.id ? d.id : d._id.$oid, new document(apiKey, d.id ? d.id : d._id.$oid, d)]), databaseName))
                                })
                            })
                        })
                        Promise.all(dataPromise)
                            .then(c => {
                                resolve(data.map((d, i) => [d, c[i]]))
                            })
                    })
                })
            })
            Promise.all(dataPromise)
                .then(d => {
                    d.forEach((d, i) => {
                        this.databases.set(data[i], new database(apiKey, data[i], d))
                    })
                    this.emit('ready')
                    console.log('Ready')
                })
        })
        .end()
    }
    /**
     * Lists all databases on an account
     * @param {boolean} cache Whether or not to use cached values
     * @returns {Promise<Array.<string>>} contains the names of the databases
     */
    async listDatabases(cache){
        if(!cache){ 
            return new Promise(resolve => {
                https.get({
                    host:'api.mongolab.com',
                    path:`/api/1/databases?apiKey=${this.apiKey}`,
                    method:"GET"
                })
                .on('response', async res => {
                    if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                    let data = await getAllData(res)
                    resolve(data)
                })
            })
        }else return new Promise(resolve => {
            resolve(this.databases.map(d => d.name))
        })
    }
    /**
     * Lists all collections in a given database
     * Accepts databaseName as a property of an object also for ease of access
     * @param {String} options MongoDB database name 
     * @param {boolean} cache Whether or not to use cached values
     * @returns {Array.<string>} contains the names of the collections
     */
    async listCollections(options, cache){
        let db = options.databaseName || options
        if(!db || (typeof db != 'string')) return this.emit('error', 'Invalid database name')
        if(!cache) return new Promise(resolve => {
            https.get({
                host:'api.mongolab.com',
                path:`/api/1/databases/${db}/collections?apiKey=${this.apiKey}`,
                method:"GET"
            })
            .on('response', async res => {
                if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                let data = await getAllData(res)
                resolve(data)
            })
        })
        else return new Promise(resolve => {
            resolve([...this.databases.get(db).collections.keys()])
        }) 
    }
    /**
     * @typedef documentListOptions
     * @property {string} databaseName MongoDB database name 
     * @property {string} collectionName MongoDB collection name
     * @property {Query=} query List of properties that all results will have
     * @property {number=} resultCount Number of results
     * @property {Map<string,number>=} setOfFields Specifies either the only fields to include(1) or the fields to exclude(0)
     * @property {boolean=} findOne Whether to stop at the first or not
     * @property {Map<string,number>=} sortOrder Map containing a property name 1 or -1. 1 means to sort the results in ascending order by that property and vice versa. Default is to order them by when way they were added
     * @property {number=} skipResults Number of results to skip. Useful for Paging
     * @property {number=} limit Maximum amount of results
     */
    /**
     * 
     * @param {documentListOptions} options 
     * @param {boolean} cache Whether or not to use cached values
     */
    listDocuments(options, cache){
        if(!options.databaseName || !options.collectionName) throw new Error('Database Name and Collection Name are required')
        let op = {
            q: options.query,
            c: options.resultCount,
            f: options.setOfFields,
            fo: options.findOne,
            s: options.sortOrder,
            sk: options.skipResults,
            l: options.limit
        };
        let query = formFormat(op)
        if(!cache){ return new Promise(resolve => {
            https.get({
                host:'api.mongolab.com',
                path:`/api/1/databases/${options.databaseName}/collections/${options.collectionName}?apiKey=${this.apiKey}${query.length ? '&' : ''}${query}`,
                method:"GET"
            })
            .on('response', async res => {
                if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                let data = await getAllData(res)
                resolve(data)
            })
        })}
        else {
            let queryFilter = options.query ? this.databases.get(options.databaseName).collections.get(options.collectionName).filterDocuments(d => [...options.query.keys()].every(d.data[key] == options.query.get(key))) :  this.databases.get(options.databaseName).collections.get(options.collectionName).documents
            
            if(options.setOfFields){
                if([...options.setOfFields.keys()].some(v => !v)){
                    queryFilter = [...queryFilter.values()].map(doc => doc.data)
                    queryFilter.forEach(doc => {
                        for(const prop in doc){
                            if([...options.setOfFields.keys()].includes(prop)) doc[prop] = undefined
                        }
                    })
                }else {
                    queryFilter = [...queryFilter.values()].map(doc => doc.data)
                    queryFilter.forEach(doc => {
                        for(const prop in doc){
                            if(![...options.setOfFields.keys()].includes(prop)) doc[prop] = undefined
                        }
                    })
                }
            }else {
                queryFilter = [...queryFilter.values()].map(doc => doc.data)
            }
            if(options.sortOrder){
                let sort = [...options.sortOrder.entries()][0]
                queryFilter = queryFilter.sort((a, b) => (sort[1] > 0 ? 1 : -1) * (a[sort[0]] - b[sort[0]]))
            }
            if(options.skipResults) queryFilter.splice(0, options.skipResults)
            if(queryFilter.length > options.limit) queryFilter.splice(options.limit)
            if(options.findOne) queryFilter = queryFilter.shift()
            return new Promise(resolve => resolve(queryFilter))
        }
    }
    /**
     * 
     * @param {object} options 
     * @param {string} options.databaseName MongoDB database name 
     * @param {string} options.collectionName MongoDB collection name
     * @param {Array.<object>} options.documents Documents to insert
     * @param {boolean} cache Whether or not to use cached values
     */
    insertDocuments(options, cache){
        if(!options.databaseName || !options.collectionName || ! options.documents) throw new Error('Invalid options')
        if(!cache){ 
            return new Promise(resolve => {
                let req = https.request({
                    host:'api.mongolab.com',
                    path:`/api/1/databases/${options.databaseName}/collections/${options.collectionName}?apiKey=${this.apiKey}`,
                    headers:{
                        "content-type":'application/json'
                    },
                    method:"POST"
                })
                .on('response', async res => {
                    if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                    let data = await getAllData(res)
                    resolve(data)
                })
                req.write(JSON.stringify(options.documents))
                req.end()
            })
        }else {
            return new Promise(resolve => 
                this.databases.get(options.databaseName).collections.get(options.collectionName).addDocuments(options.documents)
            )
        }
    }
    /**
     * 
     * @param {object} options 
     * @param {string} options.databaseName MongoDB database name 
     * @param {string} options.collectionName MongoDB collection name
     * @param {Query=} options.query List of properties that all updated documents will have
     * @param {boolean=} options.allDocuments Whether or not to update all documents found.
     * @param {boolean=} options.upsert Whether to insert document if none is found
     * @param {Array.<object>} options.documents Documents to insert
     * @param {boolean} cache Whether or not to use cached values
     */
    updateDocuments(options, cache){
        if(!options.databaseName || !options.collectionName || !options.documents) throw new Error('Invalid Options')
        let op = {
            q: options.query,
            m: options.allDocuments,
            u: options.upsert
        };
        let query = formFormat(op)
        if(!cache){ 
            console.log(`/api/1/databases/${options.databaseName}/collections/${options.collectionName}?apiKey=${this.apiKey}${query.length ? '&' : ''}${query}`)
            return new Promise(resolve => {
                let req = https.request({
                    host:'api.mongolab.com',
                    path:`/api/1/databases/${options.databaseName}/collections/${options.collectionName}?apiKey=${this.apiKey}${query.length ? '&' : ''}${query}`,
                    headers:{
                        "content-type":'application/json'
                    },
                    method:"PUT"
                })
                .on('response', async res => {
                    if(res.statusCode >= 400) return this.emit('error', await getBrokenData(res).message)
                    let data = await getBrokenData(res)
                    resolve(data)
                })
                options.documents = options.documents.map(doc => parseMap(doc))
                console.log(JSON.stringify(options.documents))
                req.write(
                    JSON.stringify(options.documents)
                )
                req.end()
            })
        }else {
            return new Promise(resolve =>
                this.databases.get(options.databaseName).collections.get(options.collectionName).addDocumentsForce(options.documents)
            )
        }
    }
    /**
     * Deletes documents from database
     * @param {object} options 
     * @param {string} options.databaseName MongoDB database name 
     * @param {string} options.collectionName MongoDB collection name
     * @param {Query=} options.query List of properties that all deleted documents will have will have
     * @param {boolean} cache Whether or not to use cached values
     * @returns {changeResult}
     */
    deleteDocuments(options, cache){
        if(!options.databaseName || !options.collectionName || !options.query) throw new Error('Invalid Options')
        let op = {
            q:options.query
        }
        let query = formFormat(op)
        if(!cache){
            return new Promise(resolve => {
                let req = https.request({
                    host:'api.mongolab.com',
                    path:`/api/1/databases/${options.databaseName}/collections/${options.collectionName}?apiKey=${this.apiKey}${query.length ? '&' : ''}${query}`,
                    headers:{
                        "content-type":'application/json'
                    },
                    method:"PUT"
                })
                .on('response', async res => {
                    if(res.statusCode >= 400) return this.emit('error', await getBrokenData(res).message)
                    let data = await getAllData(res)
                    resolve(data)
                })
                req.write(JSON.stringify([]))
                req.end()
            })
        }else {
            return this.emit('error', "This function does not have a cached form")
        }
    }
    /**
     * @typedef singleDocumentOptions
     * @property {string} databaseName MongoDB database name 
     * @property {string} collectionName MongoDB collection name
     * @property {string} id ID of the document to manipulate
     */
    /**
     * Views one single document. You need to pass the ._id.$oid property as the ID
     * @param {singleDocumentOptions} options Options for viewing
     * @param {boolean} cache Whether or not to use cached values
     * @returns {Promise}
     */
    viewDocument(options, cache){
        if(!options.databaseName || !options.collectionName || !options.id) throw new Error('Invalid Options')
        if(!cache){
            return new Promise(resolve => {
                let req = https.request({
                    host:'api.mongolab.com',
                    path:`/api/1/databases/${options.databaseName}/collections/${options.collectionName}/${options.id}?apiKey=${this.apiKey}`,
                    headers:{
                        "content-type":'application/json'
                    },
                    method:"GET"
                })
                .on('response', async res => {
                    if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                    let data = await getAllData(res)
                    resolve(data)
                })
                req.end()
            })
        }else {
            return this.databases.get(options.databaseName).collections.get(options.collectionName).findDocument(doc => doc._id.$oid == options.id).data
        }
    }
    /**
     * Updates one single document. You need to pass the ._id.$oid property as the ID
     * @param {singleDocumentOptions} options Options for updating
     * @param {Object} updateObject The document to be used to update
     * @param {boolean} cache Whether or not to use cached values
     * @returns {PromiseS}
     */
    updateDocument(options, updateObject, cache){
        if(!options.databaseName || !options.collectionName || !options.id || !updateObject) throw new Error('Invalid Options')
        if(!cache){
            return new Promise(resolve => {
                let req = https.request({
                    host:'api.mongolab.com',
                    path:`/api/1/databases/${options.databaseName}/collections/${options.collectionName}/${options.id}?apiKey=${this.apiKey}`,
                    headers:{
                        "content-type":'application/json'
                    },
                    method:"PUT"
                })
                .on('response', async res => {
                    if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                    let data = await getAllData(res)
                    resolve(data)
                })
                req.write(JSON.stringify(updateObject))
                req.end()
            })
        }else {
            return new Promise(resolve => {
                let collection = this.databases.get(options.databaseName).collections.get(options.collectionName)
                resolve(collection.updateDocument({
                    ...collection.findDocument(fn => fn.data._id.$oid == options.id).data,
                    ...updateObject
                }))
            })
        }
    }
    /**
     * Deletes one single document. You need to pass the ._id.$oid property as the ID
     * @param {singleDocumentOptions} options Options for deletion
     * @returns {Promise}
     */
    deleteDocument(options, cache){
        if(!options.databaseName || !options.collectionName || !options.id) throw new Error('Invalid Options')
        if(!cache){
            return new Promise(resolve => {
                let req = https.request({
                    host:'api.mongolab.com',
                    path:`/api/1/databases/${options.databaseName}/collections/${options.collectionName}/${options.id}?apiKey=${this.apiKey}`,
                    headers:{
                        "content-type":'application/json'
                    },
                    method:"DELETE"
                })
                .on('response', async res => {
                    if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                    let data = await getAllData(res)
                    resolve(data)
                })
                req.end()
            })
        }else {
            return new Promise(resolve => {
                let collection = this.databases.get(options.databaseName).collections.get(options.collectionName)
                resolve(collection.removeDocument(collection.findDocument(fn => fn.data._id.$oid == options.id).name))
            })
        }
    }
    /**
     * Runs commands on a database. Check out the docs for more info on it
     * @param {object} options The options for the commands to run
     * @param {string} options.databaseName MongoDB database name 
     * @param {object} options.commands MongoDB database command
     * @returns {Promise}
     */
    runCommand(options, cache){
        if(!options.databaseName || !options.commands) throw new Error('Invalid Options')
        if(!cache){
            return new Promise(resolve => {
                let req = https.request({
                    host:'api.mongolab.com',
                    path:`/api/1/databases/${options.databaseName}/runCommand?apiKey=${this.apiKey}`,
                    headers:{
                        "content-type":'application/json'
                    },
                    method:"POST"
                })
                .on('response', async res => {
                    if(res.statusCode >= 400) return this.emit('error', JSON.parse(await getBrokenData(res)).message)
                    let data = await getAllData(res)
                    resolve(data)
                })
                req.write(JSON.stringify(option.commands))
                req.end()
            })
        }else return this.emit('error', "This function does not have a cached form")
    }
}
module.exports = mlabInteractor