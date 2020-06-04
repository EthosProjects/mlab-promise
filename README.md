# mlab-promise

`mlab-promise` is a node.js module designed to allow you to access [mLab's Data API](http://docs.mlab.com/data-api/#reference) with minimal overhead.

I don't intend to remove the old functions, but I added new cache functions which can be disabled. It effectively polls the database and loads all your information so that there's no wait between each function. `mlab-promise` has all the documentation that you'd need to access your mlab database. Also, this module and this documentation is based off of [mongolab-data-api](https://github.com/gamontal/mongolab-data-api) by [gamontal](https://github.com/gamontal). Their version is no longer being maintained and purely synchronous. If you need a something like that, be sure to check it out their version. 
## Major change
- All old functions except for `runCommand` and `updateDocuments` can now be run normally but will return with cached values for improved performance
- Cacheing values has yet to be properly documented, however it is much faster and uses much less requests, despite it's startup time of a few seconds
- Cacheing requires discord.js to also be installed, because the Maps that are written to are Collections
## Installation

Using [npm](https://www.npmjs.com/):

    $ npm install mlab-promise

If you don't have or don't want to use npm:

    $ cd ~/.node_modules
    $ git clone git://github.com/Logos-King/mlab-promise.git

## Usage

To require the library and initialize it with your account API key:

```javascript
let mlabInteractor = require('mlab-promise')
let mLab = new mlabInteractor('<Your Api Key Here>', "<whether-to-cache>[boolean: true or false]",[ignore='databasenametonotcache']);
```

### Examples

**List databases**

```javascript
mlab.on('ready', () => {
    console.log(mlab.databases.map(database => database.name)) // => [db1, db2, db3, ...]
})
```

```javascript
mLab.listDatabases()
    .then(databases => {
        console.log(data); // => [db1, db2, db3, ...]
    });
```

**List collections**

```javascript
mlab.on('ready', () => {
    console.log(mlab.databases.get('exampledb').collections.map(collection => collection.name))  // => [coll1, coll2, ...]
})
```

```javascript
mLab.listCollections('exampledb')
    .then(collections => {
        console.log(collections); // => [coll1, coll2, ...]
    });
```

**List documents**
```javascript
mlab.on('ready', () => {
    console.log(mlab.databases.get('exampledb').collections.get('examples').documents.map(document => document.data))  //=> [ { _id: 1234, ...  } ]
})
```

```javascript
var opt = {
    database: 'exampledb',
    collectionName: 'examples',
    query: '{ "key": "value" }'
};

mLab.listDocuments(options)
    .then(console.log)
```
### Methods

#### `listDatabases`

Get the databases linked to the authenticated account. Returns an array of strings

`.lastDatabases()`

#### `listCollections`

Get the collections in the specified database. Returns an array.

`.listCollections(databaseName)`

***Parameters:***

Name | Description | Type | Required |
-----|------------ |------|:----------:|
options.databaseName| MongoDB database name | `String` | Yes |

#### `listDocuments`

Get the documents in the specified collection. Returns an array.

`.listDocuments(options)`

***Options:***

Name | Description | Type | Required |
-----|------------ |------|:----------:|
options.databaseName| MongoDB database name | `String` | Yes |
options.collectionName| MongoDB collection name | `String` | Yes |
options.query| List of properties that all results will have | [`Query`](https://logos-king.github.io/mlab-promise/global.html#Query) | No |
options.resultCount| Number of results | `Number` | No |
options.setOfFields| Specifies either the only fields to include(1) or the fields to exclude(0) | `Map<string,number>` | No |
options.findOne| Whether to stop at the first or not | `Boolean` | No |
options.sortOrder| Map containing a property name 1 or -1. 1 means to sort the results in ascending order by that property and vice versa. Default is to order them by when way they were added | `Map<string,number>` | No |
options.skipResults| Number of results to skip. Useful for Paging | `Number` | No |
options.limit| Maximum amount of results | `Number` | No |

#### `insertDocuments`

Create a new document in the specified collection. Returns nothing.

`.insertDocuments(options)`

***Options:***

Name | Description | Type | Required |
-----|------------ |------|:----------:|
databaseName| MongoDB database name | options.databaseName| MongoDB database name | `String` | Yes |
options.collectionName| MongoDB collection name | `String` | Yes |
documents| Documents to insert | `Array` | Yes |

#### `updateDocuments`

Update one or more documents in the specified collection. Returns nothing

`.updateDocuments(options)`

***Options:***

Name | Description | Type | Required |
-----|------------ |------|:----------:|
databaseName| MongoDB database name | `String` | Yes |
collectionName| MongoDB collection name | `String` | Yes |
documents | Documents to insert | `Array.<Object>` | Yes |
query| List of properties that all updated documents will have | [`Query`](]https://logos-king.github.io/mlab-promise/global.html#Query) | No |
allDocuments| Whether or not to update all documents found. | `Boolean` | No |
upsert| Whether to insert document if none is found | `Boolean` | No |

#### `deleteDocuments`

Replace the contents of some or all documents of a collection. Returns nothing

`.deleteDocuments(options)`

***Options:***

Name | Description | Type | Required |
-----|------------ |------|:----------:|
databaseName| MongoDB database name | `String` | Yes |
collectionName| MongoDB collection name | `String` | Yes |
query| List of properties that all deleted documents will have will have | `String` | No |

#### `viewDocument`

View a single document. Returns nothing

`.viewDocument(options)`

***Options:***

Name | Description | Type | Required |
-----|------------ |------|:----------:|
databaseName| MongoDB database name | `String` | Yes |
collectionName| MongoDB collection name | `String` | Yes |
id| ID of the document to manipulate | `String` | Yes |

#### `updateDocument`

Update a single document. Returns nothing

`.updateDocument(options)`

***Options:***

Name | Description | Type | Required |
-----|------------ |------|:----------:|
databaseName| MongoDB database name | `String` | Yes |
collectionName| MongoDB collection name | `String` | Yes |
id| ID of the document to manipulate | `String` | Yes |
updateObject| The document to be used to update | `Object` | Yes |

#### `deleteDocument`

Delete a single document. Returns nothing

`.deleteDocument(options)`

***Options:***

Name | Description | Type | Required |
-----|------------ |------|:----------:|
databaseName| MongoDB database name | `String` | Yes |
collectionName| MongoDB collection name | `String` | Yes |
id| ID of the document to manipulate | `String` | Yes |

#### `runCommand`

Run a MongoDB database command. Returns nothing

`.runCommand(options)`

***Options:***

Name | Description | Type | Required |
-----|------------ |------|:----------:|
databaseName| MongoDB database name | `String` | Yes |
commands| MongoDB database command | `Object` | Yes |

### Notes
- **Creating a new collection**
  - As soon as you POST your first document you should see the collection appear
- **runCommands**
  - Only certain MongoDB commands are exposed through the Data API
  - The available commands are:
    - getLastError
    - getPrevError
    - ping
    - profile
    - repairDatabase
    - resetError
    - whatsmyuri
    - convertToCapped
    - distinct
    - findAndModify
    - geoNear
    - reIndex
    - collStats
    - dbStats
    
## Requirements
- [mlab-promise](https://github.com/Logos-King/mlab-promise/)
- [mLab](https://mlab.com/) account w/API key.
- [node.js](https://nodejs.org/en/download/) v12.16.3+ (This module was made in this version)
## Disclaimer

### [From the official mLab Data API documentation](http://docs.mlab.com/connecting/#methods):

> mLab databases can be accessed by your application code in two ways.
> The first method - the one we strongly recommend - is to connect using one of the MongoDB drivers (as described above). You do not need to use our API if you use the driver. In fact, using a driver provides better performance, better security, and more functionality.

> The second method is to connect via mLab’s RESTful Data API. Use this method only if you cannot connect using a MongoDB driver.

> ***Visit mLab's official documentation if you have any security concerns about using the Data API***

## Contributions

If you want anything added, you can send me an email  [here](mailto:logospiercing@gmail.com). Also, if you want to add anything yourself or see a problem with the module, you can create a pull request or open an issue. I'll try to fix it within a week. Maybe less!

## License

[MIT](https://github.com/Logos-King/mlab-promise/blob/master/LICENSE.md) © Logos King