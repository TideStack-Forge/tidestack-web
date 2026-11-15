/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

/** Calls the same governed Action entry for dynamic and generated clients. */
function createBusinessActions(getRequest) {
    function endpoint(identity, operation) {
        return "/api/business-model-behaviors/".concat(encodeURIComponent(identity.modelFullName), "/actions/").concat(encodeURIComponent(identity.actionName), "/").concat(operation);
    }
    function body(identity, input) {
        return __assign({ input: input }, (identity.expectedContractFingerprint === undefined ? {} : { expectedContractFingerprint: identity.expectedContractFingerprint }));
    }
    return {
        invoke: function (identity, input) {
            return __awaiter(this, void 0, void 0, function () {
                var response;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getRequest().post(endpoint(identity, 'invoke'), body(identity, input))];
                        case 1:
                            response = _a.sent();
                            if (response.data.code !== 0) {
                                throw new Error(response.data.msg || 'Business Action failed');
                            }
                            return [2 /*return*/, response.data.data];
                    }
                });
            });
        },
        invokeFile: function (identity, input) {
            return __awaiter(this, void 0, void 0, function () {
                var response, file;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getRequest().post(endpoint(identity, 'invoke'), body(identity, input), {
                                responseType: 'blob', noSave: false, throwOnError: true,
                            })];
                        case 1:
                            response = _a.sent();
                            if (response.data.code !== 0) {
                                throw new Error(response.data.msg || 'Business Action failed');
                            }
                            file = response.data.data;
                            if (!((file === null || file === void 0 ? void 0 : file.fileContent) instanceof Blob)) {
                                throw new Error('Business Action did not return a file');
                            }
                            return [2 /*return*/, file];
                    }
                });
            });
        },
        checkAvailability: function (identity, input) {
            return __awaiter(this, void 0, void 0, function () {
                var response;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getRequest().post(endpoint(identity, 'availability'), body(identity, input))];
                        case 1:
                            response = _a.sent();
                            if (response.data.code !== 0) {
                                throw new Error(response.data.msg || 'Business Action availability failed');
                            }
                            return [2 /*return*/, response.data.data];
                    }
                });
            });
        },
    };
}

/**
 * ============================================================================
 * ES6 模块活绑定（Live Binding）说明
 * ============================================================================
 *
 * 本 SDK 使用 ES6 模块的活绑定特性来实现平台能力的动态注入。
 *
 * 工作原理：
 * 1. SDK 初始化时，导出的对象（toast, EventBus, Stomp 等）是桩对象（stub）
 * 2. 微前端挂载时，平台通过 props 传入真实的实现对象
 * 3. commonPropsFn 中使用直接赋值（如 Stomp = stomp）更新模块变量
 * 4. 由于 ES6 的活绑定特性，所有导入者自动获得更新后的对象引用
 *
 * 示例：
 * ```javascript
 * // SDK 内部
 * let Stomp = createStompStub()  // 初始桩对象
 * export { Stomp }
 *
 * // 挂载时
 * Stomp = props.stomp  // 重新赋值
 *
 * // 使用者代码
 * import { Stomp } from 'ouroboros-sdk'
 * Stomp.connect()  // ✅ 自动调用平台注入的真实对象
 * ```
 *
 * 注意：这种方式要求使用 `export { variable }` 而不是 `export default`
 * ============================================================================
 */
var registeredComponents = [];
/**
 * 平台能力函数（活绑定桩对象）
 * 这些函数在微前端挂载时由平台注入
 */
var openDialog = function (schema, ctx) {
    console.warn('请通过平台加载openDialog方法');
};
var openDrawer = function (schema, ctx) {
    console.warn('请通过平台加载openDrawer方法');
};
var openTab = function (fullPath, tabOption) {
    console.warn('请通过平台加载openTab方法');
};
var closeTab = function (id, result) {
    console.warn('请通过平台加载closeTab方法');
};
var openMenu = function (menu) {
    console.warn('请通过平台加载openMenu方法');
};
var openOrSwitchTab = function (fullPath, switchTabOptions) {
    console.warn('请通过平台加载openOrSwitchTab方法');
};
var sendToOpenerTab = function (id, data) {
    console.warn('请通过平台加载sendToOpenerTab方法');
};
var updateTabTitle = function (id, title) {
    console.warn('请通过平台加载updateTabTitle方法');
};
var renderAmisSchema = function (containerEl, schema, props, env) {
    console.warn('请通过平台加载renderAmisSchema方法');
};
var hasAuth = function (authKey) {
    console.warn('请通过平台加载hasAuth方法');
};
var login = function (params) {
    console.warn('请通过平台加载login方法');
};
var logout = function () {
    console.warn('请通过平台加载logout方法');
};
var onConfirm = function (params, reload) {
    console.warn('请通过平台加载onConfirm方法');
};
var onCancel = function () {
    console.warn('请通过平台加载onCancel方法');
};
var confirm = function (content, title, optionsOrConfirmText, cancelText) {
    console.warn('请通过平台加载confirm方法');
};
var alert = function (content, title, className) {
    console.warn('请通过平台加载alert方法');
};
var prompt = function (controls, defaultValue, title, confirmText) {
    console.warn('请通过平台加载prompt方法');
};
var getUserInfo = function () {
    console.warn('请通过平台加载getUserInfo方法');
};
var getToken = function () {
    console.warn('请通过平台加载getToken方法');
    return Promise.resolve(null);
};
var listExternalProviders = function () {
    console.warn('请通过平台加载listExternalProviders方法');
    return Promise.resolve([]);
};
var isLocalPasswordLoginEnabled = function () {
    console.warn('请通过平台加载isLocalPasswordLoginEnabled方法');
    return false;
};
var startRedirectLogin = function (provider, returnUrl) {
    console.warn('请通过平台加载startRedirectLogin方法');
    return null;
};
var loginWithLdap = function (params) {
    console.warn('请通过平台加载loginWithLdap方法');
    return Promise.resolve(null);
};
var exchangeLoginCode = function (loginCode) {
    console.warn('请通过平台加载exchangeLoginCode方法');
    return Promise.resolve(null);
};
var bindExternalAccount = function (params) {
    console.warn('请通过平台加载bindExternalAccount方法');
    return Promise.resolve(null);
};
var resolveReturnUrl = function (input) {
    console.warn('请通过平台加载resolveReturnUrl方法');
    return typeof input === 'string' ? input : '/';
};
var mapAuthError = function (code) {
    console.warn('请通过平台加载mapAuthError方法');
    return typeof code === 'string' ? code : '';
};
var addRule = function (ruleName, validatorFn, errorMessage) {
    // @ts-ignore
    registeredComponents.push({ type: 'Rule', ruleName: ruleName, validatorFn: validatorFn, errorMessage: errorMessage });
};
var registerIcon = function (key, component) {
    // @ts-ignore
    registeredComponents.push({ type: 'Icon', key: key, component: component });
};
/**
 * amis 注册自定义类型
 * @param {*} renderProps
 * @returns
 */
var FormItem = function (renderProps) {
    return function (component) {
        // @ts-ignore
        registeredComponents.push({ type: 'FormItem', component: component, renderProps: renderProps });
    };
};
/**
 * amis 表单项扩展
 * @param {*} renderProps
 * @returns
 */
var Renderer = function (renderProps) {
    return function (component) {
        // @ts-ignore
        registeredComponents.push({ type: 'Renderer', component: component, renderProps: renderProps });
    };
};
/**
 *自定义动作
 * @param {string} actionType - 动作名
 * @param {Function} action - 动作处理函数
 * @returns
 */
var registerAction = function (actionType, action) {
    // @ts-ignore
    registeredComponents.push({ type: 'Action', actionType: actionType, action: action });
};
/**
 * amis 注册公式
 */
var registerFormula = function (name, fn) {
    // @ts-ignore
    registeredComponents.push({ type: 'Formula', name: name, fn: fn });
};
/**
 * amis 注册验证器
 */
var registerValidator = function (name, fn) {
    // @ts-ignore
    registeredComponents.push({ type: 'Validator', name: name, fn: fn });
};
/**
 * amis 编辑器插件注册
 */
var registerEditorPlugin = function (plugin) {
    // @ts-ignore
    registeredComponents.push({ type: 'EditorPlugin', plugin: plugin });
};
/**
 * amis 动作面板注册
 */
var registerActionPanel = function (panel) {
    // @ts-ignore
    registeredComponents.push({ type: 'ActionPanel', panel: panel });
};
/**
 * amis OptionsControl 组件
 */
var OptionsControl = function (renderProps) {
    return function (component) {
        // @ts-ignore
        registeredComponents.push({ type: 'OptionsControl', component: component, renderProps: renderProps });
    };
};
/**
 * 主题相关
 */
var getTheme = function () {
    console.warn('请通过平台加载getTheme方法');
};
var setTheme = function (theme) {
    console.warn('请通过平台加载setTheme方法');
};
/**
 * 国际化相关
 */
var i18n = {
    getLocale: function () {
        console.warn('请通过平台加载i18n.getLocale方法');
        return 'zh-CN';
    },
    getLanguages: function () {
        console.warn('请通过平台加载i18n.getLanguages方法');
        return [];
    },
    switchLanguage: function (locale) {
        console.warn('请通过平台加载i18n.switchLanguage方法');
        return Promise.resolve();
    },
    t: function (key, defaultText, params) {
        console.warn('请通过平台加载i18n.t方法');
        return defaultText || key;
    },
    tn: function (namespace, key, defaultText, params) {
        console.warn('请通过平台加载i18n.tn方法');
        return defaultText || key;
    },
    tMenu: function (key, defaultText) {
        console.warn('请通过平台加载i18n.tMenu方法');
        return defaultText || key;
    },
    tCommon: function (key, defaultText, params) {
        console.warn('请通过平台加载i18n.tCommon方法');
        return defaultText || key;
    },
    useNamespace: function (namespace) {
        console.warn('请通过平台加载i18n.useNamespace方法');
        return function (key, defaultText, params) { return defaultText || key; };
    },
    getLocaleData: function () {
        console.warn('请通过平台加载i18n.getLocaleData方法');
        return {};
    },
    onLocaleChange: function (callback) {
        console.warn('请通过平台加载i18n.onLocaleChange方法');
        return function () { };
    }
};
var toast = {
    container: null,
    success: function (content, conf) {
        console.warn('请通过平台加载success方法');
    },
    error: function (content, conf) {
        console.warn('请通过平台加载error方法');
    },
    info: function (content, conf) {
        console.warn('请通过平台加载info方法');
    },
    warning: function (content, conf) {
        console.warn('请通过平台加载warning方法');
    },
};
var EventBus = {
    /**
     * 一次性订阅
     * @type{{
     *  (event: string, handler: Function): void
     *  (event: string, handler: Function, filter: Function): void
     * }}
     */
    subscribeOnce: function (event) {
        console.warn('请通过平台加载subscribeOnce方法');
    },
    /**
     * 订阅事件
     * @type{{
     *  (event: string, handler: Function): void
     *  (event: string, handler: Function, filter: Function): void
     * }}
     */
    subscribe: function (event) {
        console.warn('请通过平台加载subscribe方法');
    },
    /**
     * 取消订阅
     * @param {string} event 事件名
     * @param {Function} handler 事件处理函数
     */
    unsubscribe: function (event, handler) {
        console.warn('请通过平台加载unsubscribe方法');
    },
    /**
     * 发布事件
     * @param {string} event 事件名
     * @param {any} data 事件数据
     * @param {{ replayScope?: 'SESSION', replayStage?: string }} options 事件选项
     */
    publish: function (event, data, options) {
        console.warn('请通过平台加载publish方法');
    },
};
var pendingStompSubscriptions = [];
var pendingStompSubscribeWithInitials = [];
var stompSubscriptionId = 0;
var realStomp = null;
// 创建 Stomp 桩对象的工厂函数
function createStompStub() {
    var subscriptionMethods = ['subscribeTopic', 'subscribeQueue', 'subscribeUserTopic', 'subscribe'];
    var unsubscribeMethods = ['unsubscribeTopic', 'unsubscribeQueue', 'unsubscribeUserTopic', 'unsubscribe', 'unsubscribeAll', 'unsubscribeAllTopics', 'unsubscribeAllQueues', 'unsubscribeAllUserTopics'];
    var sendMethods = ['sendBinary', 'sendText', 'sendJson', 'send'];
    var connectionMethods = ['connect', 'disconnect', 'reconnect'];
    var statusMethods = ['isConnected', 'isActive', 'isStompAuthenticated'];
    var eventMethods = ['onStompConnected', 'onStompDisconnected'];
    var stub = {};
    stub.subscribeWithInitial = function (destination, listener, options) {
        if (realStomp) {
            return realStomp.subscribeWithInitial(destination, listener, options);
        }
        var resolveBootstrapDone = null;
        var rejectBootstrapDone = null;
        var bootstrapDone = new Promise(function (resolve, reject) {
            resolveBootstrapDone = resolve;
            rejectBootstrapDone = reject;
        });
        bootstrapDone.catch(function () { return undefined; });
        var pending = {
            cancelled: false,
            options: {
                destination: destination,
                listener: listener,
                options: options,
            },
            handle: {
                bootstrapDone: bootstrapDone,
                unsubscribe: function () {
                    var _a;
                    if (pending.cancelled) {
                        return;
                    }
                    pending.cancelled = true;
                    var index = pendingStompSubscribeWithInitials.indexOf(pending);
                    if (index > -1) {
                        pendingStompSubscribeWithInitials.splice(index, 1);
                    }
                    (_a = pending.realUnsubscribe) === null || _a === void 0 ? void 0 : _a.call(pending);
                    rejectBootstrapDone === null || rejectBootstrapDone === void 0 ? void 0 : rejectBootstrapDone(new Error('subscribeWithInitial 已取消'));
                },
            },
            resolveBootstrapDone: resolveBootstrapDone,
            rejectBootstrapDone: rejectBootstrapDone,
            realUnsubscribe: null,
        };
        pendingStompSubscribeWithInitials.push(pending);
        return pending.handle;
    };
    // 订阅方法：收集订阅信息，返回动态取消订阅函数
    subscriptionMethods.forEach(function (method) {
        stub[method] = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            // 如果已注入真实 Stomp，直接调用
            if (realStomp) {
                return realStomp[method].apply(realStomp, args);
            }
            // 收集待处理订阅
            var subscription = {
                id: ++stompSubscriptionId,
                method: method,
                args: args,
                cancelled: false,
                realUnsubscribe: null,
            };
            pendingStompSubscriptions.push(subscription);
            // 返回动态取消订阅函数
            return function () {
                if (subscription.realUnsubscribe) {
                    // 已注入，调用真实取消订阅
                    subscription.realUnsubscribe();
                }
                else {
                    // 未注入，标记为已取消
                    subscription.cancelled = true;
                    var index = pendingStompSubscriptions.indexOf(subscription);
                    if (index > -1) {
                        pendingStompSubscriptions.splice(index, 1);
                    }
                }
            };
        };
    });
    // 取消订阅方法
    unsubscribeMethods.forEach(function (method) {
        stub[method] = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (realStomp) {
                return realStomp[method].apply(realStomp, args);
            }
            console.warn("Stomp \u5C1A\u672A\u6CE8\u5165\uFF0C".concat(method, " \u8C03\u7528\u88AB\u5FFD\u7565"));
        };
    });
    // 发送方法
    sendMethods.forEach(function (method) {
        stub[method] = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (realStomp) {
                return realStomp[method].apply(realStomp, args);
            }
            console.warn("Stomp \u5C1A\u672A\u6CE8\u5165\uFF0C".concat(method, " \u8C03\u7528\u88AB\u5FFD\u7565"));
        };
    });
    // 连接方法
    connectionMethods.forEach(function (method) {
        stub[method] = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (realStomp) {
                return realStomp[method].apply(realStomp, args);
            }
            console.warn("Stomp \u5C1A\u672A\u6CE8\u5165\uFF0C".concat(method, " \u8C03\u7528\u88AB\u5FFD\u7565"));
        };
    });
    // 状态检查方法（返回 false 作为默认值）
    statusMethods.forEach(function (method) {
        stub[method] = function () {
            if (realStomp) {
                return realStomp[method]();
            }
            return false;
        };
    });
    // 事件订阅方法
    eventMethods.forEach(function (method) {
        stub[method] = function (handler) {
            if (realStomp) {
                return realStomp[method](handler);
            }
            // 收集待处理事件订阅
            var subscription = {
                id: ++stompSubscriptionId,
                method: method,
                args: [handler],
                cancelled: false,
                realUnsubscribe: null,
            };
            pendingStompSubscriptions.push(subscription);
            return function () {
                if (subscription.realUnsubscribe) {
                    subscription.realUnsubscribe();
                }
                else {
                    subscription.cancelled = true;
                    var index = pendingStompSubscriptions.indexOf(subscription);
                    if (index > -1) {
                        pendingStompSubscriptions.splice(index, 1);
                    }
                }
            };
        };
    });
    return stub;
}
// 注入真实 Stomp 对象并处理待处理订阅
function injectRealStomp(stomp) {
    realStomp = stomp;
    // 处理待处理订阅
    var pending = pendingStompSubscriptions;
    pendingStompSubscriptions = [];
    for (var _i = 0, pending_1 = pending; _i < pending_1.length; _i++) {
        var subscription = pending_1[_i];
        if (subscription.cancelled)
            continue;
        var realUnsubscribe = stomp[subscription.method].apply(stomp, subscription.args);
        if (typeof realUnsubscribe === 'function') {
            subscription.realUnsubscribe = realUnsubscribe;
        }
    }
    var pendingInitials = pendingStompSubscribeWithInitials;
    pendingStompSubscribeWithInitials = [];
    var _loop_1 = function (subscription) {
        if (subscription.cancelled) {
            return "continue";
        }
        var _b = subscription.options, destination = _b.destination, listener = _b.listener, options = _b.options;
        var handle = stomp.subscribeWithInitial(destination, listener, options);
        subscription.realUnsubscribe = handle.unsubscribe;
        handle.bootstrapDone.then(function () { var _a; return (_a = subscription.resolveBootstrapDone) === null || _a === void 0 ? void 0 : _a.call(subscription); }, function (error) { var _a; return (_a = subscription.rejectBootstrapDone) === null || _a === void 0 ? void 0 : _a.call(subscription, error); });
    };
    for (var _a = 0, pendingInitials_1 = pendingInitials; _a < pendingInitials_1.length; _a++) {
        var subscription = pendingInitials_1[_a];
        _loop_1(subscription);
    }
}
var Stomp = createStompStub();
/**
 * 创建 request 桩对象
 */
function createRequestStub() {
    var stub = function (config) {
        console.warn('请通过平台加载request方法');
        return Promise.reject(new Error('请通过平台加载request方法'));
    };
    stub.get = function (url, config) {
        console.warn('请通过平台加载request.get方法');
        return Promise.reject(new Error('请通过平台加载request.get方法'));
    };
    stub.post = function (url, data, config) {
        console.warn('请通过平台加载request.post方法');
        return Promise.reject(new Error('请通过平台加载request.post方法'));
    };
    stub.put = function (url, data, config) {
        console.warn('请通过平台加载request.put方法');
        return Promise.reject(new Error('请通过平台加载request.put方法'));
    };
    stub.delete = function (url, config) {
        console.warn('请通过平台加载request.delete方法');
        return Promise.reject(new Error('请通过平台加载request.delete方法'));
    };
    stub.patch = function (url, data, config) {
        console.warn('请通过平台加载request.patch方法');
        return Promise.reject(new Error('请通过平台加载request.patch方法'));
    };
    return stub;
}
/**
 * 请求能力（活绑定桩对象）
 */
var request = createRequestStub();
var businessActions = createBusinessActions(function () { return request; });
/**
 * amis 内部用的常用工具方法（活绑定桩对象）
 */
var amisUtils = {};
// ============================================================================
// 菜单扩展能力（menu / userMenu）—— 活绑定桩 + 注入前 pending 队列
// ============================================================================
// 命令式调用（setMenuBadge / addMenuItem / removeMenuItem / register）在平台能力
// 注入前进入 pending 队列，注入后按调用顺序 flush，避免微应用挂载早于注入时丢失调用。
// 查询类（getMenuBadge / getMenu / getMenus / traverseMenus / getItems）在注入前
// 返回空结果，挂载后（beforeMount/afterMount 之后）方可获得真实数据。
var realMenu = null;
var realUserMenu = null;
var pendingMenuOps = [];
// Calls made before any init lifecycle have no owning unmount hook, so this fallback set is intentionally never auto-cleaned.
var defaultUserMenuItemIds = new Set();
var sdkOwner = 'unknown';
var pendingUserMenuSeq = 0;
function flushPendingMenuOps() {
    if (pendingMenuOps.length === 0) {
        return;
    }
    var ops = pendingMenuOps.splice(0);
    for (var _i = 0, ops_1 = ops; _i < ops_1.length; _i++) {
        var op = ops_1[_i];
        op();
    }
}
function cleanupSdkUserMenuRegistrations(registeredUserMenuItemIds) {
    if (registeredUserMenuItemIds.size === 0) {
        return;
    }
    registeredUserMenuItemIds.forEach(function (id) {
        realUserMenu === null || realUserMenu === void 0 ? void 0 : realUserMenu.unregister(id);
    });
    registeredUserMenuItemIds.clear();
}
function createMenuStub() {
    return {
        setMenuBadge: function (fullName, badge) {
            if (realMenu) {
                realMenu.setMenuBadge(fullName, badge);
                return;
            }
            pendingMenuOps.push(function () { return realMenu === null || realMenu === void 0 ? void 0 : realMenu.setMenuBadge(fullName, badge); });
        },
        getMenuBadge: function (fullName) {
            return realMenu ? realMenu.getMenuBadge(fullName) : undefined;
        },
        getMenu: function (ref) {
            return realMenu ? realMenu.getMenu(ref) : undefined;
        },
        getMenus: function (options) {
            return realMenu ? realMenu.getMenus(options) : [];
        },
        traverseMenus: function (visitor, options) {
            if (realMenu) {
                realMenu.traverseMenus(visitor, options);
            }
        },
        addMenuItem: function (options) {
            if (realMenu) {
                return realMenu.addMenuItem(options);
            }
            pendingMenuOps.push(function () {
                realMenu === null || realMenu === void 0 ? void 0 : realMenu.addMenuItem(options);
            });
            return false;
        },
        removeMenuItem: function (ref) {
            if (realMenu) {
                return realMenu.removeMenuItem(ref);
            }
            pendingMenuOps.push(function () {
                realMenu === null || realMenu === void 0 ? void 0 : realMenu.removeMenuItem(ref);
            });
            return false;
        },
    };
}
function createUserMenuStub(registeredUserMenuItemIds) {
    return {
        register: function (item) {
            if (realUserMenu) {
                var id = realUserMenu.register(item, sdkOwner);
                if (id) {
                    registeredUserMenuItemIds.add(id);
                }
                return id;
            }
            pendingMenuOps.push(function () {
                var id = realUserMenu === null || realUserMenu === void 0 ? void 0 : realUserMenu.register(item, sdkOwner);
                if (id) {
                    registeredUserMenuItemIds.add(id);
                }
            });
            return "__pending-user-menu-".concat(++pendingUserMenuSeq);
        },
        unregister: function (id) {
            registeredUserMenuItemIds.delete(id);
            if (realUserMenu) {
                realUserMenu.unregister(id);
            }
        },
        getItems: function () {
            return realUserMenu ? realUserMenu.getItems() : [];
        },
        unregisterAll: function (owner) {
            if (realUserMenu) {
                realUserMenu.unregisterAll(owner);
            }
        },
    };
}
/**
 * 菜单扩展能力（活绑定桩对象）
 * 微应用挂载时由平台注入真实实现
 */
var menu = createMenuStub();
var userMenu = createUserMenuStub(defaultUserMenuItemIds);
/**
 * 公共props 处理逻辑
 * @param {object} props
 */
function commonPropsFn(props) {
    var _a = props.__utils__, __utils__ = _a === void 0 ? props : _a;
    var _b = __utils__.mainWindow, mainWindow = _b === void 0 ? {} : _b, eventBus = __utils__.eventBus, openDialogFn = __utils__.openDialog, openDrawerFn = __utils__.openDrawer, openTabFn = __utils__.openTab, closeTabFn = __utils__.closeTab, openMenuFn = __utils__.openMenu, openOrSwitchTabFn = __utils__.openOrSwitchTab, sendToOpenerTabFn = __utils__.sendToOpenerTab, updateTabTitleFn = __utils__.updateTabTitle, hasAuthFn = __utils__.hasAuth, FormItemFn = __utils__.FormItem, RendererFn = __utils__.Renderer, OptionsControlFn = __utils__.OptionsControl, registerActionFn = __utils__.registerAction, registerFormulaFn = __utils__.registerFormula, registerValidatorFn = __utils__.registerValidator, registerEditorPluginFn = __utils__.registerEditorPlugin, registerActionPanelFn = __utils__.registerActionPanel, renderAmisSchemaFn = __utils__.renderAmisSchema, addRuleFn = __utils__.addRule, confirmFn = __utils__.confirm, alertFn = __utils__.alert, promptFn = __utils__.prompt, mainToast = __utils__.toast, mainRequest = __utils__.request, utils = __utils__.amisUtils, loginHandler = __utils__.loginHandler, logoutHandler = __utils__.logoutHandler, _c = __utils__.getToken, getTokenFn = _c === void 0 ? getToken : _c, _d = __utils__.listExternalProviders, listExternalProvidersFn = _d === void 0 ? listExternalProviders : _d, _e = __utils__.isLocalPasswordLoginEnabled, isLocalPasswordLoginEnabledFn = _e === void 0 ? isLocalPasswordLoginEnabled : _e, _f = __utils__.startRedirectLogin, startRedirectLoginFn = _f === void 0 ? startRedirectLogin : _f, _g = __utils__.loginWithLdap, loginWithLdapFn = _g === void 0 ? loginWithLdap : _g, _h = __utils__.exchangeLoginCode, exchangeLoginCodeFn = _h === void 0 ? exchangeLoginCode : _h, _j = __utils__.bindExternalAccount, bindExternalAccountFn = _j === void 0 ? bindExternalAccount : _j, _k = __utils__.resolveReturnUrl, resolveReturnUrlFn = _k === void 0 ? resolveReturnUrl : _k, _l = __utils__.mapAuthError, mapAuthErrorFn = _l === void 0 ? mapAuthError : _l, stomp = __utils__.stomp, registerIconFn = __utils__.registerIcon, getUserInfoFn = __utils__.getUserInfo, getThemeFn = __utils__.getTheme, setThemeFn = __utils__.setTheme, menuFn = __utils__.menu, userMenuFn = __utils__.userMenu;
    var _m = props.appInfo, appInfo = _m === void 0 ? {} : _m;
    // 菜单扩展能力注入（先确定 owner、完成全部赋值后再 flush pending，
    // 避免先 flush 时另一能力尚未注入导致排队操作丢失）
    sdkOwner = (appInfo === null || appInfo === void 0 ? void 0 : appInfo.name) || 'unknown';
    if (menuFn) {
        realMenu = menuFn;
    }
    if (userMenuFn) {
        realUserMenu = userMenuFn;
    }
    flushPendingMenuOps();
    // 使用 ES6 活绑定，直接赋值更新所有导出变量
    openDialog = openDialogFn;
    openDrawer = openDrawerFn;
    openTab = openTabFn;
    closeTab = closeTabFn;
    openMenu = openMenuFn;
    openOrSwitchTab = openOrSwitchTabFn;
    sendToOpenerTab = sendToOpenerTabFn;
    updateTabTitle = updateTabTitleFn;
    hasAuth = hasAuthFn;
    FormItem = FormItemFn;
    Renderer = RendererFn;
    OptionsControl = OptionsControlFn;
    registerAction = registerActionFn;
    registerFormula = registerFormulaFn;
    registerValidator = registerValidatorFn;
    registerEditorPlugin = registerEditorPluginFn;
    registerActionPanel = registerActionPanelFn;
    renderAmisSchema = renderAmisSchemaFn;
    addRule = addRuleFn;
    confirm = confirmFn;
    alert = alertFn;
    prompt = promptFn;
    login = loginHandler;
    logout = logoutHandler;
    getToken = getTokenFn;
    listExternalProviders = listExternalProvidersFn;
    isLocalPasswordLoginEnabled = isLocalPasswordLoginEnabledFn;
    startRedirectLogin = startRedirectLoginFn;
    loginWithLdap = loginWithLdapFn;
    exchangeLoginCode = exchangeLoginCodeFn;
    bindExternalAccount = bindExternalAccountFn;
    resolveReturnUrl = resolveReturnUrlFn;
    mapAuthError = mapAuthErrorFn;
    registerIcon = registerIconFn;
    getUserInfo = getUserInfoFn;
    getTheme = getThemeFn;
    setTheme = setThemeFn;
    EventBus = eventBus;
    toast = mainToast;
    request = mainRequest;
    amisUtils = utils;
    // 注入真实 Stomp 并处理待处理订阅
    if (stomp) {
        injectRealStomp(stomp);
    }
    // 注入 i18n
    if (props.i18n) {
        i18n = props.i18n;
    }
    // @ts-ignore
    window.mainWindow = mainWindow;
    // 处理注册的组件
    var componentDefine;
    while ((componentDefine = registeredComponents.pop())) {
        if (componentDefine.type === 'FormItem' && FormItem) {
            FormItem(componentDefine.renderProps)(componentDefine.component);
        }
        if (componentDefine.type === 'Renderer' && Renderer) {
            Renderer(componentDefine.renderProps)(componentDefine.component);
        }
        if (componentDefine.type === 'Action' && registerAction) {
            registerAction(componentDefine.actionType, componentDefine.action);
        }
        if (componentDefine.type === 'Rule' && addRule) {
            addRule(componentDefine.ruleName, componentDefine.validatorFn, componentDefine.errorMessage);
        }
        if (componentDefine.type === 'Icon' && registerIcon) {
            registerIcon(componentDefine.key, componentDefine.component);
        }
        if (componentDefine.type === 'OptionsControl' && OptionsControl) {
            OptionsControl(componentDefine.renderProps)(componentDefine.component);
        }
        if (componentDefine.type === 'Formula' && registerFormula) {
            registerFormula(componentDefine.name, componentDefine.fn);
        }
        if (componentDefine.type === 'Validator' && registerValidator) {
            registerValidator(componentDefine.name, componentDefine.fn);
        }
        if (componentDefine.type === 'EditorPlugin' && registerEditorPlugin) {
            registerEditorPlugin(componentDefine.plugin);
        }
        if (componentDefine.type === 'ActionPanel' && registerActionPanel) {
            registerActionPanel(componentDefine.panel);
        }
    }
}
/**
 * 微前端生命周期函数（活绑定导出）
 * 通过 initMicroApp/initLayoutComponent/initAmisComponentLib 初始化后自动更新
 */
var mount = null;
var unmount = null;
var update = null;
var bootstrap = null;
/**
 * 初始化微前端，返回生命周期函数
 *
 * @param initOptions 微前端初始化参数
 * @returns 生命周期函数对象
 */
function initMicroApp(initOptions) {
    var _this = this;
    var registeredUserMenuItemIds = new Set();
    userMenu = createUserMenuStub(registeredUserMenuItemIds);
    var _a = initOptions.render, render = _a === void 0 ? function (props) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _a, _b = initOptions.beforeMount, beforeMount = _b === void 0 ? function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _b, _c = initOptions.afterMount, afterMount = _c === void 0 ? function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _c, _d = initOptions.afterUnmount, afterUnmount = _d === void 0 ? function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _d, _e = initOptions.afterUpdate, afterUpdate = _e === void 0 ? function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _e, _f = initOptions.onBootstrap, onBootstrap = _f === void 0 ? function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _f;
    var app = null;
    // @ts-ignore
    if (window.__POWERED_BY_QIANKUN__) {
        // @ts-ignore
        __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
    }
    else {
        render({});
    }
    mount = function (props) { return __awaiter(_this, void 0, void 0, function () {
        var onCancelFn, onConfirmFn, commonProps;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, beforeMount(props)];
                case 1:
                    _a.sent();
                    onCancelFn = props.onCancel, onConfirmFn = props.onConfirm, commonProps = __rest(props, ["onCancel", "onConfirm"]);
                    commonPropsFn(commonProps);
                    if (onCancelFn)
                        onCancel = onCancelFn;
                    if (onConfirmFn)
                        onConfirm = onConfirmFn;
                    return [4 /*yield*/, render(props)];
                case 2:
                    app = _a.sent();
                    return [4 /*yield*/, afterMount(props)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    unmount = function (props) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, afterUnmount(props, app)];
                case 1:
                    _a.sent();
                    cleanupSdkUserMenuRegistrations(registeredUserMenuItemIds);
                    return [2 /*return*/];
            }
        });
    }); };
    update = function (props) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, afterUpdate(props)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    bootstrap = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, onBootstrap()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    return {
        mount: mount,
        unmount: unmount,
        update: update,
        bootstrap: bootstrap,
    };
}
/**
 * 初始化业务组件式微前端，返回生命周期函数
 *
 * @param initOptions 微前端初始化参数
 * @returns 生命周期函数对象
 */
function initLayoutComponent(initOptions) {
    var _this = this;
    var registeredUserMenuItemIds = new Set();
    userMenu = createUserMenuStub(registeredUserMenuItemIds);
    var _a = initOptions.render, render = _a === void 0 ? function (props) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _a, _b = initOptions.beforeMount, beforeMount = _b === void 0 ? function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _b, _c = initOptions.afterUpdate, afterUpdate = _c === void 0 ? function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _c, _d = initOptions.afterUnmount, afterUnmount = _d === void 0 ? function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _d, _e = initOptions.onBootstrap, onBootstrap = _e === void 0 ? function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _e;
    var layoutComApp = null;
    // @ts-ignore
    if (window.__POWERED_BY_QIANKUN__) {
        // @ts-ignore
        __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
    }
    else {
        render({});
    }
    mount = function (props) { return __awaiter(_this, void 0, void 0, function () {
        var container, appName, logo, menu, theme, userInfo, breadcrumb, currentPath, sidebarStatus, onThemeChanged, onSidebarWidthChange, themeList, showXsNavbar, commonProps;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, beforeMount(props)];
                case 1:
                    _a.sent();
                    container = props.container, appName = props.appName, logo = props.logo, menu = props.menu, theme = props.theme, userInfo = props.userInfo, breadcrumb = props.breadcrumb, currentPath = props.currentPath, sidebarStatus = props.sidebarStatus, onThemeChanged = props.onThemeChanged, onSidebarWidthChange = props.onSidebarWidthChange, themeList = props.themeList, showXsNavbar = props.showXsNavbar, commonProps = __rest(props, ["container", "appName", "logo", "menu", "theme", "userInfo", "breadcrumb", "currentPath", "sidebarStatus", "onThemeChanged", "onSidebarWidthChange", "themeList", "showXsNavbar"]);
                    commonPropsFn(commonProps);
                    return [4 /*yield*/, render(__assign({ container: container, appName: appName, logo: logo, menu: menu, theme: theme, userInfo: userInfo, breadcrumb: breadcrumb, currentPath: currentPath, sidebarStatus: sidebarStatus, onThemeChanged: onThemeChanged, onSidebarWidthChange: onSidebarWidthChange, themeList: themeList, showXsNavbar: showXsNavbar }, commonProps))];
                case 2:
                    layoutComApp = _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    unmount = function (props) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, afterUnmount(props, layoutComApp)];
                case 1:
                    _a.sent();
                    cleanupSdkUserMenuRegistrations(registeredUserMenuItemIds);
                    return [2 /*return*/];
            }
        });
    }); };
    update = function (props) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, afterUpdate(props)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    bootstrap = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, onBootstrap()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    return {
        mount: mount,
        unmount: unmount,
        update: update,
        bootstrap: bootstrap,
    };
}
/**
 * 初始化微前端amis组件，返回生命周期函数
 *
 * @param initOptions 微前端初始化参数
 * @returns 生命周期函数对象
 */
function initAmisComponentLib(initOptions) {
    var _this = this;
    var registeredUserMenuItemIds = new Set();
    userMenu = createUserMenuStub(registeredUserMenuItemIds);
    var _a = initOptions.beforeMount, beforeMount = _a === void 0 ? function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _a, _b = initOptions.afterUnmount, afterUnmount = _b === void 0 ? function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _b, _c = initOptions.afterUpdate, afterUpdate = _c === void 0 ? function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _c, _d = initOptions.onBootstrap, onBootstrap = _d === void 0 ? function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); } : _d;
    // @ts-ignore
    if (window.__POWERED_BY_QIANKUN__) {
        // @ts-ignore
        __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
    }
    mount = function (props) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, beforeMount(props)];
                case 1:
                    _a.sent();
                    commonPropsFn(props);
                    return [2 /*return*/];
            }
        });
    }); };
    unmount = function (props) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, afterUnmount(props, null)];
                case 1:
                    _a.sent();
                    cleanupSdkUserMenuRegistrations(registeredUserMenuItemIds);
                    return [2 /*return*/];
            }
        });
    }); };
    update = function (props) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, afterUpdate(props)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    bootstrap = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, onBootstrap()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    return {
        mount: mount,
        unmount: unmount,
        update: update,
        bootstrap: bootstrap,
    };
}

export { startRedirectLogin as $, mapAuthError as A, menu as B, onCancel as C, onConfirm as D, EventBus as E, FormItem as F, openDialog as G, openDrawer as H, openMenu as I, openOrSwitchTab as J, openTab as K, prompt as L, registerAction as M, registerActionPanel as N, OptionsControl as O, registerEditorPlugin as P, registerFormula as Q, Renderer as R, Stomp as S, registerIcon as T, registerValidator as U, renderAmisSchema as V, request as W, resolveReturnUrl as X, sendToOpenerTab as Y, setTheme as Z, __awaiter as _, __generator as a, toast as a0, updateTabTitle as a1, userMenu as a2, bootstrap as b, update as c, addRule as d, alert as e, amisUtils as f, bindExternalAccount as g, businessActions as h, closeTab as i, confirm as j, exchangeLoginCode as k, getTheme as l, mount as m, getToken as n, getUserInfo as o, hasAuth as p, i18n as q, initAmisComponentLib as r, initLayoutComponent as s, initMicroApp as t, unmount as u, isLocalPasswordLoginEnabled as v, listExternalProviders as w, login as x, loginWithLdap as y, logout as z };
