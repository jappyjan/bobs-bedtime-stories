/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./apps/backend/api/src/environments/environment.ts":
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.environment = void 0;
const IS_PRODUCTION = process.env.IS_PRODUCTION === 'true';
const IS_LOCAL = process.env.LOCAL_DEVELOPMENT_ENVIRONMENT === 'true';
exports.environment = {
    production: IS_PRODUCTION,
    localDevelopment: IS_LOCAL,
    passCodeSecretId: process.env.SECRET_PASS_CODE_ARN,
    cdnBucket: process.env.S3_BUCKET_CDN,
};


/***/ }),

/***/ "./apps/backend/api/src/handlers/books.get.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getBooks = void 0;
const tslib_1 = __webpack_require__("tslib");
const dynamoose_1 = __webpack_require__("./libs/dynamoose/src/index.ts");
const wrap_api_handler_1 = __webpack_require__("./apps/backend/api/src/utils/wrap-api-handler.ts");
exports.getBooks = (0, wrap_api_handler_1.wrapApiHandler)(() => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    console.log('get books');
    const scanAction = (0, dynamoose_1.makeBookModel)().scan();
    console.log('add "all" option');
    scanAction.all();
    console.log('execute');
    const books = yield scanAction.exec();
    console.log('done', books);
    return books;
}));


/***/ }),

/***/ "./apps/backend/api/src/handlers/books.post.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.postBook = void 0;
const tslib_1 = __webpack_require__("tslib");
const dynamoose_1 = __webpack_require__("./libs/dynamoose/src/index.ts");
const wrap_api_handler_1 = __webpack_require__("./apps/backend/api/src/utils/wrap-api-handler.ts");
const makeSlug = __webpack_require__("slug");
const Condition_1 = __webpack_require__("dynamoose/dist/Condition");
exports.postBook = (0, wrap_api_handler_1.wrapApiHandler)((event) => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    var _a;
    const body = JSON.parse((_a = event.body) !== null && _a !== void 0 ? _a : '{}');
    const slug = makeSlug(body.title);
    return yield (0, dynamoose_1.makeBookModel)().create({
        title: body.title,
        description: body.description,
        slug,
    }, {
        condition: new Condition_1.Condition().attribute('slug').not().eq(slug)
    });
}));


/***/ }),

/***/ "./apps/backend/api/src/handlers/stories.get.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getStoriesOfBook = void 0;
const tslib_1 = __webpack_require__("tslib");
const dynamoose_1 = __webpack_require__("./libs/dynamoose/src/index.ts");
const wrap_api_handler_1 = __webpack_require__("./apps/backend/api/src/utils/wrap-api-handler.ts");
exports.getStoriesOfBook = (0, wrap_api_handler_1.wrapApiHandler)((event) => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    const bookSlug = event.pathParameters.bookSlug;
    return yield (0, dynamoose_1.makeStoryModel)().query()
        .attribute('bookSlug')
        .eq(bookSlug)
        .all()
        .exec();
}));


/***/ }),

/***/ "./apps/backend/api/src/handlers/stories.post.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.postANewEpisode = void 0;
const tslib_1 = __webpack_require__("tslib");
const dynamoose_1 = __webpack_require__("./libs/dynamoose/src/index.ts");
const wrap_api_handler_1 = __webpack_require__("./apps/backend/api/src/utils/wrap-api-handler.ts");
const environment_1 = __webpack_require__("./apps/backend/api/src/environments/environment.ts");
const nanoid_1 = __webpack_require__("nanoid");
const s3_1 = __webpack_require__("./libs/backend/utils/src/lib/s3.ts");
exports.postANewEpisode = (0, wrap_api_handler_1.wrapApiHandler)((event) => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    const bookSlug = event.pathParameters.bookSlug;
    const storiesSortedByEpisode = yield (0, dynamoose_1.makeStoryModel)().query()
        .attribute('bookSlug').eq(bookSlug)
        .sort('descending')
        .limit(1)
        .exec();
    let episode = 1;
    if (storiesSortedByEpisode.length > 0) {
        episode = storiesSortedByEpisode[0].episode + 1;
    }
    const s3Key = `books/${bookSlug}/stories/${episode}/audio/${(0, nanoid_1.nanoid)(5)}`;
    const s3 = new s3_1.BobsS3();
    const preSignedUrlData = s3.createPreSignedPost({
        Bucket: environment_1.environment.cdnBucket,
        Expires: 20,
        Fields: {
            key: s3Key,
        },
        Conditions: [
            ['eq', '$Content-Type', 'audio/wav'],
            ['content-length-range', 0, 100000000],
            ['Cache-Control', `max-age=${365 * 24 * 60 * 60}`], // cache control
        ],
    });
    const story = yield (0, dynamoose_1.makeStoryModel)().create({
        bookSlug,
        episode,
        date: new Date(),
        audioS3Key: s3Key
    });
    return {
        story,
        audioUploadUrlData: preSignedUrlData,
    };
}));


/***/ }),

/***/ "./apps/backend/api/src/handlers/verify.passcode.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.verifyPasscode = void 0;
const tslib_1 = __webpack_require__("tslib");
const wrap_api_handler_1 = __webpack_require__("./apps/backend/api/src/utils/wrap-api-handler.ts");
exports.verifyPasscode = (0, wrap_api_handler_1.wrapApiHandler)((event) => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    return 'OK';
}));


/***/ }),

/***/ "./apps/backend/api/src/utils/authenticate.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.authenticate = void 0;
const tslib_1 = __webpack_require__("tslib");
const backend_api_rest_1 = __webpack_require__("./libs/backend/api/rest/src/index.ts");
const backend_utils_1 = __webpack_require__("./libs/backend/utils/src/index.ts");
const environment_1 = __webpack_require__("./apps/backend/api/src/environments/environment.ts");
function authenticate(event) {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        const { 'pass-code': givenPassCode } = event.headers;
        if (!givenPassCode) {
            throw new backend_api_rest_1.UnauthorizedError('PassCode is missing');
        }
        const secretsManager = new backend_utils_1.BobsSecretsManager();
        const expectedPasscode = yield secretsManager.getValue(environment_1.environment.passCodeSecretId);
        if (expectedPasscode !== givenPassCode) {
            throw new backend_api_rest_1.UnauthorizedError('PassCode is invalid');
        }
    });
}
exports.authenticate = authenticate;


/***/ }),

/***/ "./apps/backend/api/src/utils/wrap-api-handler.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.wrapApiHandler = void 0;
const tslib_1 = __webpack_require__("tslib");
const authenticate_1 = __webpack_require__("./apps/backend/api/src/utils/authenticate.ts");
function wrapApiHandler(handler) {
    return (event, context) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        console.log('authenticating...');
        yield (0, authenticate_1.authenticate)(event);
        console.log('authenticated');
        return handler(event, context);
    });
}
exports.wrapApiHandler = wrapApiHandler;


/***/ }),

/***/ "./libs/backend/api/rest/src/index.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__("tslib");
(0, tslib_1.__exportStar)(__webpack_require__("./libs/backend/api/rest/src/lib/index.ts"), exports);


/***/ }),

/***/ "./libs/backend/api/rest/src/lib/errors/http-error.ts":
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.NotFoundError = exports.AccessDeniedError = exports.UnauthorizedError = exports.HttpError = void 0;
class HttpError extends Error {
    constructor(msg, httpStatusCode) {
        super(msg);
        this.httpStatusCode = httpStatusCode;
    }
}
exports.HttpError = HttpError;
class UnauthorizedError extends HttpError {
    constructor(reason) {
        super(reason !== null && reason !== void 0 ? reason : 'Unauthorized', 401);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class AccessDeniedError extends HttpError {
    constructor(reason) {
        super(`Access denied: ${reason}`, 403);
    }
}
exports.AccessDeniedError = AccessDeniedError;
class NotFoundError extends HttpError {
    constructor(reason) {
        super(`Not found: ${reason}`, 404);
    }
}
exports.NotFoundError = NotFoundError;


/***/ }),

/***/ "./libs/backend/api/rest/src/lib/http-api-router.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HttpApiRouter = exports.wrapHandler = exports.makeObjectSerializable = void 0;
const tslib_1 = __webpack_require__("tslib");
const http_error_1 = __webpack_require__("./libs/backend/api/rest/src/lib/errors/http-error.ts");
function makeObjectSerializable(obj) {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Set) {
        return [...obj];
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => makeObjectSerializable(item));
    }
    if (obj instanceof Date) {
        return obj;
    }
    const serializable = {};
    Object.entries(obj).forEach(([key, val]) => {
        serializable[key] = makeObjectSerializable(val);
    });
    return serializable;
}
exports.makeObjectSerializable = makeObjectSerializable;
function makeResponse(payload, statusCode = 200) {
    payload = makeObjectSerializable(payload);
    return {
        isBase64Encoded: false,
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        multiValueHeaders: {},
        body: JSON.stringify(payload !== null && payload !== void 0 ? payload : { status: statusCode === 200 ? 'ok' : 'error' }),
    };
}
function makeErrorResponse(error, statusCode = 500) {
    return makeResponse({
        error,
    }, statusCode);
}
function wrapHandler(callback) {
    return (event, context, lambdaCallback) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        var _a;
        let response;
        try {
            response = yield callback(event, context);
            const transformedResponse = makeResponse(response);
            if (lambdaCallback) {
                lambdaCallback(null, transformedResponse);
                return;
            }
            return transformedResponse;
        }
        catch (e) {
            let message = e;
            let httpStatusCode = 500;
            if (e instanceof Error) {
                message = e.message;
            }
            if (e instanceof http_error_1.HttpError) {
                httpStatusCode = e.httpStatusCode;
            }
            const errorResponse = makeErrorResponse(message, httpStatusCode);
            console.error({
                errorResponse,
                originalResponse: response,
                originalError: Object.assign(Object.assign({}, e), { name: e.name, message: e.message, stack: e.stack, httpStatusCode: (_a = e.httpStatusCode) !== null && _a !== void 0 ? _a : 'not-given' }),
            });
            if (lambdaCallback) {
                lambdaCallback(null, errorResponse);
                return;
            }
            return errorResponse;
        }
    });
}
exports.wrapHandler = wrapHandler;
class HttpApiRouter {
    constructor(sessionTokenArn) {
        this.routes = [];
        this.sessionTokenArn = sessionTokenArn;
    }
    addRoute(method, path, handler) {
        this.routes.push({
            method,
            path,
            handler,
        });
    }
    addRoutes() {
        const makeAddRouteFunction = (method) => (path, handler) => {
            this.addRoute(method, path, handler);
            return this.addRoutes();
        };
        return {
            get: makeAddRouteFunction('GET'),
            post: makeAddRouteFunction('POST'),
            put: makeAddRouteFunction('PUT'),
            delete: makeAddRouteFunction('DELETE'),
            any: makeAddRouteFunction('ANY'),
            options: makeAddRouteFunction('OPTIONS'),
            patch: makeAddRouteFunction('PATCH'),
            head: makeAddRouteFunction('HEAD'),
        };
    }
    handler(event, context, callback) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            console.log('Router', 'request', 'info', {
                httpMethod: event.httpMethod,
                resource: event.resource,
                path: event.path,
            });
            context.callbackWaitsForEmptyEventLoop = false;
            const route = this.routes.find((r) => r.path === event.resource && r.method === event.httpMethod);
            if (!route) {
                console.log('Router', 'route-not-found', 'error', {
                    event,
                    routes: this.routes,
                });
                return callback(null, makeErrorResponse('404 Route not found', 404));
            }
            const wrappedHandler = wrapHandler(route.handler.bind(this));
            try {
                let isCalled = false;
                const responsePromise = wrappedHandler(event, context, (error, result) => {
                    console.log('Router', 'request', error ? 'error' : 'success', {
                        httpMethod: event.httpMethod,
                        resource: event.resource,
                        path: event.path,
                        error,
                        result,
                    });
                    // eslint-disable-next-line no-console
                    console.log('now calling callback');
                    !isCalled && callback(error, result);
                    isCalled = true;
                });
                if (typeof responsePromise.then === 'function') {
                    // eslint-disable-next-line no-console
                    console.log('handler is promise, awaiting response');
                    const response = yield responsePromise;
                    console.log('Router', 'request', 'success', {
                        httpMethod: event.httpMethod,
                        resource: event.resource,
                        path: event.path,
                        response,
                    });
                    // eslint-disable-next-line no-console
                    console.log('promise done, calling callback');
                    !isCalled && callback(null, response);
                    isCalled = true;
                }
            }
            catch (e) {
                console.log('Router', 'request', 'error', {
                    httpMethod: event.httpMethod,
                    resource: event.resource,
                    path: event.path,
                    error: {
                        name: e.name,
                        message: e.message,
                        stack: e.stack,
                    },
                });
                if (e instanceof http_error_1.HttpError) {
                    callback(null, makeErrorResponse(e.message, e.httpStatusCode));
                }
                else {
                    callback(null, makeErrorResponse('Server Error', 500));
                }
            }
        });
    }
}
exports.HttpApiRouter = HttpApiRouter;


/***/ }),

/***/ "./libs/backend/api/rest/src/lib/index.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__("tslib");
(0, tslib_1.__exportStar)(__webpack_require__("./libs/backend/api/rest/src/lib/errors/http-error.ts"), exports);
(0, tslib_1.__exportStar)(__webpack_require__("./libs/backend/api/rest/src/lib/http-api-router.ts"), exports);


/***/ }),

/***/ "./libs/backend/utils/src/index.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__("tslib");
(0, tslib_1.__exportStar)(__webpack_require__("./libs/backend/utils/src/lib/secrets.ts"), exports);


/***/ }),

/***/ "./libs/backend/utils/src/lib/s3.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BobsS3 = void 0;
const tslib_1 = __webpack_require__("tslib");
const aws_sdk_1 = __webpack_require__("aws-sdk");
class BobsS3 {
    constructor(params) {
        const isLocal = process.env.LOCAL_DEVELOPMENT_ENVIRONMENT === 'true';
        this.s3 = new aws_sdk_1.S3(Object.assign(Object.assign({ endpoint: isLocal ? 'http://localhost:9000' : undefined }, (params !== null && params !== void 0 ? params : {})), { region: isLocal ? 'us-east-1' : params === null || params === void 0 ? void 0 : params.region, s3ForcePathStyle: isLocal ? true : params === null || params === void 0 ? void 0 : params.s3ForcePathStyle, signatureVersion: isLocal ? 'v4' : params === null || params === void 0 ? void 0 : params.signatureVersion, maxRetries: 30 }));
    }
    upload(params) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            return this.s3.upload(params).promise();
        });
    }
    getObject(params) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            return this.s3.getObject(params).promise();
        });
    }
    createPreSignedPost(params) {
        return this.s3.createPresignedPost(params);
    }
}
exports.BobsS3 = BobsS3;


/***/ }),

/***/ "./libs/backend/utils/src/lib/secrets.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BobsSecretsManager = void 0;
const tslib_1 = __webpack_require__("tslib");
const aws_sdk_1 = __webpack_require__("aws-sdk");
class BobsSecretsManager {
    constructor() {
        const isLocal = process.env.LOCAL_DEVELOPMENT_ENVIRONMENT === 'true';
        this.secretsManager = new aws_sdk_1.SecretsManager({
            endpoint: isLocal ? 'http://localhost:3000' : undefined,
            maxRetries: 30,
        });
    }
    getValue(secretId) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            const response = yield this.secretsManager
                .getSecretValue({
                SecretId: secretId,
            })
                .promise();
            let secret;
            if ('SecretString' in response) {
                secret = response.SecretString;
            }
            else {
                const buff = new Buffer(response.SecretBinary, 'base64');
                secret = buff.toString('ascii');
            }
            return secret;
        });
    }
}
exports.BobsSecretsManager = BobsSecretsManager;


/***/ }),

/***/ "./libs/dynamoose/src/index.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__("tslib");
(0, tslib_1.__exportStar)(__webpack_require__("./libs/dynamoose/src/lib/story.model.ts"), exports);
(0, tslib_1.__exportStar)(__webpack_require__("./libs/dynamoose/src/lib/book.model.ts"), exports);
const dynamoose_1 = __webpack_require__("dynamoose");
if (process.env.LOCAL_DEVELOPMENT_ENVIRONMENT === 'true') {
    dynamoose_1.aws.ddb.local();
}


/***/ }),

/***/ "./libs/dynamoose/src/lib/book.model.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.makeBookModel = exports.BookSchema = exports.BookTableName = exports.BookDocument = void 0;
const dynamoose_1 = __webpack_require__("dynamoose");
const Document_1 = __webpack_require__("dynamoose/dist/Document");
class BookDocument extends Document_1.Document {
}
exports.BookDocument = BookDocument;
exports.BookTableName = process.env.DYNAMO_TABLE_BOOKS;
exports.BookSchema = new dynamoose_1.Schema({
    title: {
        type: String,
        required: true,
    },
    slug: {
        type: String,
        required: true,
        hashKey: true,
    },
    description: {
        type: String,
        required: true,
    },
    coverImageUrl: {
        type: String,
        required: false,
    },
});
const makeBookModel = () => (0, dynamoose_1.model)(exports.BookTableName, exports.BookSchema, {
    create: false,
    update: false,
});
exports.makeBookModel = makeBookModel;


/***/ }),

/***/ "./libs/dynamoose/src/lib/story.model.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.makeStoryModel = exports.StorySchema = exports.StoryTableName = exports.StoryDocument = void 0;
const dynamoose_1 = __webpack_require__("dynamoose");
const Document_1 = __webpack_require__("dynamoose/dist/Document");
class StoryDocument extends Document_1.Document {
}
exports.StoryDocument = StoryDocument;
exports.StoryTableName = process.env.DYNAMO_TABLE_STORIES;
exports.StorySchema = new dynamoose_1.Schema({
    bookSlug: {
        type: String,
        required: true,
        hashKey: true,
    },
    episode: {
        type: Number,
        required: true,
        rangeKey: true,
    },
    audioS3Key: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    description: {
        type: String,
        required: false,
    },
    externalLinks: {
        type: [String],
        required: false,
    },
    imageUrls: {
        type: [String],
        required: false,
    },
    videoUrls: {
        type: [String],
        required: false,
    },
});
const makeStoryModel = () => (0, dynamoose_1.model)(exports.StoryTableName, exports.StorySchema, {
    create: false,
    update: false,
});
exports.makeStoryModel = makeStoryModel;


/***/ }),

/***/ "aws-sdk":
/***/ ((module) => {

module.exports = require("aws-sdk");

/***/ }),

/***/ "dynamoose":
/***/ ((module) => {

module.exports = require("dynamoose");

/***/ }),

/***/ "dynamoose/dist/Condition":
/***/ ((module) => {

module.exports = require("dynamoose/dist/Condition");

/***/ }),

/***/ "dynamoose/dist/Document":
/***/ ((module) => {

module.exports = require("dynamoose/dist/Document");

/***/ }),

/***/ "nanoid":
/***/ ((module) => {

module.exports = require("nanoid");

/***/ }),

/***/ "slug":
/***/ ((module) => {

module.exports = require("slug");

/***/ }),

/***/ "source-map-support/register":
/***/ ((module) => {

module.exports = require("source-map-support/register");

/***/ }),

/***/ "tslib":
/***/ ((module) => {

module.exports = require("tslib");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.routes = exports.handler = void 0;
__webpack_require__("source-map-support/register");
const backend_api_rest_1 = __webpack_require__("./libs/backend/api/rest/src/index.ts");
const books_get_1 = __webpack_require__("./apps/backend/api/src/handlers/books.get.ts");
const stories_get_1 = __webpack_require__("./apps/backend/api/src/handlers/stories.get.ts");
const verify_passcode_1 = __webpack_require__("./apps/backend/api/src/handlers/verify.passcode.ts");
const books_post_1 = __webpack_require__("./apps/backend/api/src/handlers/books.post.ts");
const stories_post_1 = __webpack_require__("./apps/backend/api/src/handlers/stories.post.ts");
const router = new backend_api_rest_1.HttpApiRouter();
router.addRoutes()
    .get('/books', books_get_1.getBooks)
    .post('/books', books_post_1.postBook)
    .get('/books/{bookSlug}/stories', stories_get_1.getStoriesOfBook)
    .post('/books/{bookSlug}/stories', stories_post_1.postANewEpisode)
    .post('/auth/verify-passcode', verify_passcode_1.verifyPasscode);
exports.handler = router.handler.bind(router);
exports.routes = router.routes;

})();

var __webpack_export_target__ = exports;
for(var i in __webpack_exports__) __webpack_export_target__[i] = __webpack_exports__[i];
if(__webpack_exports__.__esModule) Object.defineProperty(__webpack_export_target__, "__esModule", { value: true });
/******/ })()
;
//# sourceMappingURL=main.js.map