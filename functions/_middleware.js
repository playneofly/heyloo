// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = (arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      // Normalize the media type (case-insensitive) while keeping parameters like the boundary
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
};

// node_modules/hono/dist/utils/body.js
var isRawRequest = (request) => "headers" in request;
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) {
    return convertFormDataToBodyData(
      await request.bodyCache.formData,
      options
    );
  }
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) {
    request.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var tryDecodeURIComponent = (str) => str.indexOf("%") !== -1 ? tryDecode(str, decodeURIComponent_) : str;
var _decodeURI = (value) => {
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return tryDecodeURIComponent(value);
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = tryDecodeURIComponent(value);
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    for (const anyCachedKey in bodyCache) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    ;
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) {
        if (key === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) {
          if (++count > 1 || typeof headers[k] !== "string") {
            responseHeaders = new Headers();
            break;
          }
        }
      }
      if (responseHeaders) {
        for (const k in headers) {
          const v = headers[k];
          if (typeof v === "string") {
            responseHeaders.set(k, v);
          } else {
            responseHeaders.delete(k);
            for (const v2 of v) {
              responseHeaders.append(k, v2);
            }
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch", "query"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} env - env Object
   * @param {ExecutionContext} executionCtx - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path);
}

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return b === TAIL_WILDCARD_REG_EXP_STR ? -1 : 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  // handler index of a dynamic path, or -1 for a static path terminal
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : null : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
        if (name && pattern[2]) {
          if (regexpStr === ".*") {
            throw PATH_ERROR;
          }
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) {
            throw PATH_ERROR;
          }
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) {
            throw PATH_ERROR;
          }
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ONLY_WILDCARD_REG_EXP_STR && regexpStr !== TAIL_WILDCARD_REG_EXP_STR) {
            for (const k in node.#children) {
              if (
                // a single-char pattern coexists with single-char literals as a literal does
                (regexpStr.length > 1 || k.length > 1) && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
              ) {
                throw PATH_ERROR;
              }
            }
          }
          nextNode = node.#children[regexpStr] = new _Node();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) {
            if (k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR) {
              throw PATH_ERROR;
            }
          }
          nextNode = node.#children[token] = new _Node();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) {
      throw PATH_ERROR;
    }
    node.#index = isStatic ? -1 : index;
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  // dynamic path -> [handler index, param assoc]; static paths are not registered
  paths = /* @__PURE__ */ Object.create(null);
  insert(path, isStatic) {
    if (isStatic) {
      this.#root.insert(path.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#tries = { [METHOD_NAME_ALL]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
          this.#insertPath(method, p);
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      Object.keys(middleware).forEach((m) => {
        if ((method === METHOD_NAME_ALL || method === m) && !middleware[m][path]) {
          this.#insertPath(m, path);
          middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        }
      });
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          if (!routes[m][path2]) {
            this.#insertPath(m, path2);
            routes[m][path2] = [
              ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
            ];
          }
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = this.#tries = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = /* @__PURE__ */ Object.create(null);
    const handlerData = [];
    [middleware, routes].forEach((r) => {
      for (const path in r) {
        const handlers = r[path];
        const pathData = trie.paths[path];
        if (!pathData) {
          staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
          continue;
        }
        const paramAssoc = pathData[1];
        handlerData[pathData[0]] = handlers.map(([h, paramCount]) => {
          const paramIndexMap = /* @__PURE__ */ Object.create(null);
          paramCount -= 1;
          for (; paramCount >= 0; paramCount--) {
            const [key, value] = paramAssoc[paramCount];
            paramIndexMap[key] = value;
          }
          return [h, paramIndexMap];
        });
      }
    });
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (let i = 0, len = handlerData.length; i < len; i++) {
      for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
        const map = handlerData[i][j]?.[1];
        if (!map) {
          continue;
        }
        const keys = Object.keys(map);
        for (let k = 0, len3 = keys.length; k < len3; k++) {
          map[keys[k]] = paramReplacementMap[map[keys[k]]];
        }
      }
    }
    const handlerMap = [];
    for (const i in indexReplacementMap) {
      handlerMap[i] = handlerData[indexReplacementMap[i]];
    }
    return [regexp, handlerMap, staticMap];
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _ in children) {
    return true;
  }
  return false;
};
var Node2 = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  node.#params,
                  params
                );
              }
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/utils/cookie.js
var validCookieNameRegEx = /^[\w!#$%&'*.^`|~+-]+$/;
var relaxedCookieNameRegEx = /^[!#-:<>-[\]-~]+$/;
var validCookieValueRegEx = /^[ !#-:<-[\]-~]*$/;
var trimCookieWhitespace = (value) => {
  let start = 0;
  let end = value.length;
  while (start < end) {
    const charCode = value.charCodeAt(start);
    if (charCode !== 32 && charCode !== 9) {
      break;
    }
    start++;
  }
  while (end > start) {
    const charCode = value.charCodeAt(end - 1);
    if (charCode !== 32 && charCode !== 9) {
      break;
    }
    end--;
  }
  return start === 0 && end === value.length ? value : value.slice(start, end);
};
var parse = (cookie, name) => {
  if (name && cookie.indexOf(name) === -1) {
    return {};
  }
  const pairs = cookie.split(";");
  const parsedCookie = /* @__PURE__ */ Object.create(null);
  for (const pairStr of pairs) {
    const valueStartPos = pairStr.indexOf("=");
    if (valueStartPos === -1) {
      continue;
    }
    const cookieName = trimCookieWhitespace(pairStr.substring(0, valueStartPos));
    if (name && name !== cookieName || !relaxedCookieNameRegEx.test(cookieName) || cookieName in parsedCookie) {
      continue;
    }
    let cookieValue = trimCookieWhitespace(pairStr.substring(valueStartPos + 1));
    if (cookieValue.startsWith('"') && cookieValue.endsWith('"')) {
      cookieValue = cookieValue.slice(1, -1);
    }
    if (validCookieValueRegEx.test(cookieValue)) {
      parsedCookie[cookieName] = tryDecodeURIComponent(cookieValue);
      if (name) {
        break;
      }
    }
  }
  return parsedCookie;
};
var _serialize = (name, value, opt = {}) => {
  if (!validCookieNameRegEx.test(name)) {
    throw new Error("Invalid cookie name");
  }
  let cookie = `${name}=${value}`;
  if (name.startsWith("__Secure-") && !opt.secure) {
    throw new Error("__Secure- Cookie must have Secure attributes");
  }
  if (name.startsWith("__Host-")) {
    if (!opt.secure) {
      throw new Error("__Host- Cookie must have Secure attributes");
    }
    if (opt.path !== "/") {
      throw new Error('__Host- Cookie must have Path attributes with "/"');
    }
    if (opt.domain) {
      throw new Error("__Host- Cookie must not have Domain attributes");
    }
  }
  for (const key of ["domain", "path", "sameSite", "priority"]) {
    if (opt[key] && /[;\r\n]/.test(opt[key])) {
      throw new Error(`${key} must not contain ";", "\\r", or "\\n"`);
    }
  }
  if (opt && typeof opt.maxAge === "number" && opt.maxAge >= 0) {
    if (opt.maxAge > 3456e4) {
      throw new Error(
        "Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration."
      );
    }
    cookie += `; Max-Age=${opt.maxAge | 0}`;
  }
  if (opt.domain && opt.prefix !== "host") {
    cookie += `; Domain=${opt.domain}`;
  }
  if (opt.path) {
    cookie += `; Path=${opt.path}`;
  }
  if (opt.expires) {
    if (opt.expires.getTime() - Date.now() > 3456e7) {
      throw new Error(
        "Cookies Expires SHOULD NOT be greater than 400 days (34560000 seconds) in the future."
      );
    }
    cookie += `; Expires=${opt.expires.toUTCString()}`;
  }
  if (opt.httpOnly) {
    cookie += "; HttpOnly";
  }
  if (opt.secure) {
    cookie += "; Secure";
  }
  if (opt.sameSite) {
    cookie += `; SameSite=${opt.sameSite.charAt(0).toUpperCase() + opt.sameSite.slice(1)}`;
  }
  if (opt.priority) {
    cookie += `; Priority=${opt.priority.charAt(0).toUpperCase() + opt.priority.slice(1)}`;
  }
  if (opt.partitioned) {
    if (!opt.secure) {
      throw new Error("Partitioned Cookie must have Secure attributes");
    }
    cookie += "; Partitioned";
  }
  return cookie;
};
var serialize = (name, value, opt) => {
  value = encodeURIComponent(value);
  return _serialize(name, value, opt);
};

// node_modules/hono/dist/helper/cookie/index.js
var getCookie = (c, key, prefix) => {
  const cookie = c.req.raw.headers.get("Cookie");
  if (typeof key === "string") {
    if (!cookie) {
      return void 0;
    }
    let finalKey = key;
    if (prefix === "secure") {
      finalKey = "__Secure-" + key;
    } else if (prefix === "host") {
      finalKey = "__Host-" + key;
    }
    const obj2 = parse(cookie, finalKey);
    return obj2[finalKey];
  }
  if (!cookie) {
    return {};
  }
  const obj = parse(cookie);
  return obj;
};
var generateCookie = (name, value, opt) => {
  let cookie;
  if (opt?.prefix === "secure") {
    cookie = serialize("__Secure-" + name, value, { path: "/", ...opt, secure: true });
  } else if (opt?.prefix === "host") {
    cookie = serialize("__Host-" + name, value, {
      ...opt,
      path: "/",
      secure: true,
      domain: void 0
    });
  } else {
    cookie = serialize(name, value, { path: "/", ...opt });
  }
  return cookie;
};
var setCookie = (c, name, value, opt) => {
  const cookie = generateCookie(name, value, opt);
  c.header("Set-Cookie", cookie, { append: true });
};
var deleteCookie = (c, name, opt) => {
  const deletedCookie = getCookie(c, name, opt?.prefix);
  setCookie(c, name, "", { ...opt, maxAge: 0 });
  return deletedCookie;
};

// src/api/schema.ts
var SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  username_lc TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  hue INTEGER NOT NULL DEFAULT 40,
  avatar TEXT,
  badge TEXT,
  last_seen INTEGER NOT NULL,
  last_seen_vis TEXT NOT NULL DEFAULT 'everyone',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT,
  description TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL,
  dm_key TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL,
  last_message_preview TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS members (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  muted INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL,
  last_read_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  author_id TEXT,
  type TEXT NOT NULL DEFAULT 'text',
  body TEXT NOT NULL,
  reply_to_id TEXT,
  forwarded_from TEXT,
  edited_at INTEGER,
  deleted_at INTEGER,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  media_id TEXT,
  duration_ms INTEGER
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  mime TEXT NOT NULL,
  data TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reactions (
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS story_views (
  story_id TEXT NOT NULL,
  viewer_id TEXT NOT NULL,
  viewed_at INTEGER NOT NULL,
  PRIMARY KEY (story_id, viewer_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS typing (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  until_ts INTEGER NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  conversation_id TEXT,
  actor_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username_lc);
`;

// src/api/db.ts
async function one(db, sql, ...params) {
  return db.prepare(sql).bind(...params).first();
}
async function many(db, sql, ...params) {
  const res = await db.prepare(sql).bind(...params).all();
  return res.results ?? [];
}
async function run(db, sql, ...params) {
  await db.prepare(sql).bind(...params).run();
}
var booted = false;
async function ensureSchema(db, schema) {
  if (booted) return;
  const parts = schema.split(";").map((s) => s.trim()).filter(Boolean);
  for (const sql of parts) {
    await db.prepare(sql).bind().run();
  }
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN avatar TEXT").bind().run();
  } catch {
  }
  try {
    await db.prepare("ALTER TABLE messages ADD COLUMN media_id TEXT").bind().run();
  } catch {
  }
  try {
    await db.prepare("ALTER TABLE messages ADD COLUMN duration_ms INTEGER").bind().run();
  } catch {
  }
  booted = true;
}
var ONLINE_MS = 35e3;
function publicUser(u, viewerId, isContact) {
  const now = Date.now();
  const online = now - u.last_seen < ONLINE_MS;
  let lastSeen = u.last_seen;
  if (u.id === viewerId) {
    lastSeen = u.last_seen;
  } else if (u.last_seen_vis === "nobody") {
    lastSeen = null;
  } else if (u.last_seen_vis === "contacts" && !isContact) {
    lastSeen = null;
  }
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    bio: u.bio,
    hue: u.hue,
    avatar: u.avatar || null,
    badge: u.badge,
    lastSeen,
    online: lastSeen !== null && online,
    createdAt: u.created_at
  };
}

// src/api/crypto.ts
var enc = new TextEncoder();
function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomId() {
  return crypto.randomUUID();
}
function randomToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}
async function sha256Hex(value) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return toHex(new Uint8Array(buf));
}
async function hashPassword(password) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const digest = await sha256Hex(`${salt}:${password}`);
  return `${salt}.${digest}`;
}
async function verifyPassword(password, stored) {
  const [salt, digest] = stored.split(".");
  if (!salt || !digest) return false;
  const next = await sha256Hex(`${salt}:${password}`);
  if (next.length !== digest.length) return false;
  let diff = 0;
  for (let i = 0; i < next.length; i++) diff |= next.charCodeAt(i) ^ digest.charCodeAt(i);
  return diff === 0;
}
function hueFrom(input) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = h * 33 + input.charCodeAt(i) >>> 0;
  return h % 360;
}

// src/api/app.ts
var USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
var EMOJIS = ["\u2764", "\u{1F525}", "\u2728", "\u{1F602}", "\u{1F44D}", "\u26A1", "\u{1F5A4}"];
var COOKIE = "t_session";
var SESSION_MS = 1e3 * 60 * 60 * 24 * 30;
var app = new Hono2().basePath("/api");
app.use("*", async (c, next) => {
  if (!c.env?.DB) {
    return jsonError(c, "\u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0648\u0635\u0644 \u0646\u06CC\u0633\u062A. \u062F\u0631 Pages \u06CC\u06A9 D1 \u0628\u0647 \u0627\u0633\u0645 DB \u0628\u0628\u0646\u062F.", 503);
  }
  try {
    await ensureSchema(c.env.DB, SCHEMA);
  } catch (e) {
    return jsonError(c, `\u0627\u0633\u06A9\u06CC\u0645\u0627 \u0633\u0627\u062E\u062A\u0647 \u0646\u0634\u062F: ${e instanceof Error ? e.message : String(e)}`, 500);
  }
  await next();
});
app.get("/health", async (c) => {
  try {
    const row = await one(c.env.DB, "SELECT 1 as n");
    return c.json({ ok: true, db: row?.n === 1 });
  } catch (e) {
    return jsonError(c, `\u0633\u0644\u0627\u0645\u062A \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633: ${e instanceof Error ? e.message : String(e)}`, 500);
  }
});
function jsonError(c, message, status = 400) {
  return c.json({ error: message }, status);
}
function isHttps(c) {
  return new URL(c.req.url).protocol === "https:";
}
function cookieOpts(c, maxAge) {
  return {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge,
    secure: isHttps(c)
  };
}
async function emit(db, kind, conversationId, actorId, payload = {}) {
  await run(
    db,
    `INSERT INTO events (ts, kind, conversation_id, actor_id, payload) VALUES (?, ?, ?, ?, ?)`,
    Date.now(),
    kind,
    conversationId,
    actorId,
    JSON.stringify(payload)
  );
}
async function userByToken(db, token) {
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await one(
    db,
    `SELECT user_id, expires_at FROM sessions WHERE token_hash = ?`,
    hash
  );
  if (!row || row.expires_at < Date.now()) return null;
  return one(db, `SELECT * FROM users WHERE id = ?`, row.user_id);
}
async function auth(c, optional = false) {
  const token = getCookie(c, COOKIE);
  const user = await userByToken(c.env.DB, token);
  if (!user) {
    if (optional) return null;
    return jsonError(c, "\u0646\u06CC\u0627\u0632 \u0628\u0647 \u0648\u0631\u0648\u062F \u062F\u0627\u0631\u06CC", 401);
  }
  c.set("user", user);
  return user;
}
function cleanUsername(raw2) {
  if (typeof raw2 !== "string") return null;
  const u = raw2.trim();
  if (!USERNAME_RE.test(u)) return null;
  return u;
}
function cleanText(raw2, min, max) {
  if (typeof raw2 !== "string") return null;
  const t = raw2.replace(/\s+/g, " ").trim();
  if (t.length < min || t.length > max) return null;
  return t;
}
var AVATAR_RE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;
var AVATAR_MAX = 12e4;
function parseAvatar(raw2) {
  if (raw2 === void 0) return void 0;
  if (raw2 === null || raw2 === "") return null;
  if (typeof raw2 !== "string") return false;
  const t = raw2.replace(/\s+/g, "");
  if (t.length > AVATAR_MAX) return false;
  if (!AVATAR_RE.test(t)) return false;
  return t;
}
function previewOf(body) {
  return body.length > 80 ? body.slice(0, 79) + "\u2026" : body;
}
function previewFor(type, body) {
  if (type === "photo") return body ? previewOf(body) : "\u{1F4F7} \u0639\u06A9\u0633";
  if (type === "video") return body ? previewOf(body) : "\u{1F3AC} \u0641\u06CC\u0644\u0645";
  if (type === "voice") return "\u{1F3A4} \u0648\u06CC\u0633";
  return previewOf(body);
}
var MEDIA_MAX = 12e5;
var MEDIA_RE = /^data:(image|video|audio)\/[a-z0-9.+-]+(;[^,]*)?;base64,[A-Za-z0-9+/=]+$/i;
function parseMedia(raw2, kind) {
  if (!raw2 || typeof raw2 !== "object") return null;
  const rec = raw2;
  if (typeof rec.data !== "string") return null;
  const data = rec.data.replace(/\s+/g, "");
  if (data.length < 32 || data.length > MEDIA_MAX) return null;
  if (!MEDIA_RE.test(data)) return null;
  const mimeMatch = /^data:([^;,]+)/i.exec(data);
  const mime = typeof rec.mime === "string" && rec.mime || mimeMatch?.[1] || "";
  if (kind === "photo" && !mime.startsWith("image/")) return null;
  if (kind === "video" && !mime.startsWith("video/")) return null;
  if (kind === "voice" && !mime.startsWith("audio/")) return null;
  const b64 = data.slice(data.indexOf(",") + 1);
  const bytes = Math.floor(b64.length * 3 / 4);
  const durationMs = typeof rec.durationMs === "number" && rec.durationMs >= 0 && rec.durationMs <= 12e4 ? Math.round(rec.durationMs) : 0;
  return { mime, data, durationMs, bytes };
}
function decodeDataUrl(data) {
  const m = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.+)$/i.exec(data);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { mime: m[1] || "application/octet-stream", bytes: out };
  } catch {
    return null;
  }
}
async function areContacts(db, a, b) {
  const row = await one(
    db,
    `SELECT COUNT(*) as n FROM conversations c
     JOIN members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
     JOIN members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
     WHERE c.type = 'dm'`,
    a,
    b
  );
  return (row?.n ?? 0) > 0;
}
async function memberOf(db, convId, userId) {
  return one(db, `SELECT * FROM members WHERE conversation_id = ? AND user_id = ?`, convId, userId);
}
async function blocked(db, a, b) {
  const row = await one(
    db,
    `SELECT COUNT(*) as n FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
    a,
    b,
    b,
    a
  );
  return (row?.n ?? 0) > 0;
}
function pub(u, viewerId, contact) {
  return publicUser(u, viewerId, contact);
}
async function hydrateUsers(db, users, viewer) {
  const out = [];
  for (const u of users) {
    const contact = viewer ? await areContacts(db, viewer.id, u.id) : false;
    out.push(pub(u, viewer?.id ?? null, contact));
  }
  return out;
}
async function conversationPayload(db, conv, user) {
  const mem = await memberOf(db, conv.id, user.id);
  const members = await many(
    db,
    `SELECT m.conversation_id, m.user_id, m.role, m.muted, m.pinned, m.joined_at, m.last_read_at,
            u.id, u.username, u.username_lc, u.password_hash, u.display_name, u.bio, u.hue, u.badge,
            u.last_seen, u.last_seen_vis, u.created_at, u.avatar
     FROM members m JOIN users u ON u.id = m.user_id
     WHERE m.conversation_id = ?`,
    conv.id
  );
  const people = [];
  for (const m of members) {
    const uid = String(m.id || m.user_id);
    const contact = await areContacts(db, user.id, m.user_id);
    people.push({
      ...pub({ ...m, id: uid }, user.id, contact),
      id: uid,
      role: m.role,
      muted: !!m.muted,
      pinned: !!m.pinned,
      lastReadAt: m.last_read_at
    });
  }
  let title = conv.title;
  let peer = null;
  let peerName = null;
  if (conv.type === "dm") {
    const otherRow = await one(
      db,
      `SELECT u.* FROM members m
       JOIN users u ON u.id = m.user_id
       WHERE m.conversation_id = ? AND m.user_id != ?
       LIMIT 1`,
      conv.id,
      user.id
    );
    if (otherRow) {
      const contact = await areContacts(db, user.id, otherRow.id);
      peer = {
        ...pub(otherRow, user.id, contact),
        role: "member",
        muted: false,
        pinned: false,
        lastReadAt: 0
      };
      peerName = otherRow.display_name;
      title = otherRow.display_name;
    } else {
      title = "\u067E\u06CC\u0648\u06CC";
      peerName = "\u067E\u06CC\u0648\u06CC";
    }
  }
  const unreadRow = await one(
    db,
    `SELECT COUNT(*) as n FROM messages
     WHERE conversation_id = ? AND created_at > ? AND (author_id IS NULL OR author_id != ?) AND deleted_at IS NULL`,
    conv.id,
    mem?.last_read_at ?? 0,
    user.id
  );
  const pinned = await many(
    db,
    `SELECT * FROM messages WHERE conversation_id = ? AND pinned = 1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`,
    conv.id
  );
  const last = await one(
    db,
    `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`,
    conv.id
  );
  return {
    id: conv.id,
    type: conv.type,
    title,
    description: conv.description,
    ownerId: conv.owner_id,
    createdAt: conv.created_at,
    lastMessageAt: conv.last_message_at,
    lastMessagePreview: conv.last_message_preview,
    lastAuthorId: last?.author_id ?? null,
    peerName,
    muted: !!mem?.muted,
    pinned: !!mem?.pinned,
    role: mem?.role ?? "member",
    unread: unreadRow?.n ?? 0,
    members: people,
    peer,
    pinnedMessages: pinned.map((m) => serializeMessage(m, user.id))
  };
}
function rowAuthorId(m) {
  const raw2 = m.author_id ?? m.authorId ?? null;
  if (raw2 == null || raw2 === "") return null;
  return String(raw2);
}
function serializeMessage(m, viewerId) {
  const authorId = rowAuthorId(m);
  const vid = viewerId == null ? "" : String(viewerId);
  return {
    id: m.id,
    conversationId: m.conversation_id,
    authorId,
    mine: !!(vid && authorId && authorId === vid),
    type: m.type,
    body: m.deleted_at ? "" : m.body,
    replyToId: m.reply_to_id,
    forwardedFrom: m.forwarded_from,
    editedAt: m.edited_at,
    deleted: !!m.deleted_at,
    pinned: !!m.pinned,
    createdAt: m.created_at,
    mediaId: m.deleted_at ? null : m.media_id ?? null,
    durationMs: m.duration_ms ?? null
  };
}
async function messagesWithExtras(db, rows, viewerId) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const reacts = await many(
    db,
    `SELECT message_id, user_id, emoji FROM reactions WHERE message_id IN (${placeholders})`,
    ...ids
  );
  const byMsg = {};
  for (const r of reacts) {
    (byMsg[r.message_id] ||= []).push({ emoji: r.emoji, userId: r.user_id });
  }
  const replyIds = [...new Set(rows.map((r) => r.reply_to_id).filter(Boolean))];
  let replies = {};
  if (replyIds.length) {
    const ph = replyIds.map(() => "?").join(",");
    const rr = await many(db, `SELECT * FROM messages WHERE id IN (${ph})`, ...replyIds);
    replies = Object.fromEntries(rr.map((x) => [x.id, x]));
  }
  return rows.map((m) => ({
    ...serializeMessage(m, viewerId),
    reactions: byMsg[m.id] || [],
    replyTo: m.reply_to_id && replies[m.reply_to_id] ? serializeMessage(replies[m.reply_to_id], viewerId) : null
  }));
}
async function touchConv(db, id, preview, at) {
  await run(
    db,
    `UPDATE conversations SET last_message_at = ?, last_message_preview = ? WHERE id = ?`,
    at,
    preview,
    id
  );
}
async function addSystem(db, convId, body) {
  const id = randomId();
  const now = Date.now();
  await run(
    db,
    `INSERT INTO messages (id, conversation_id, author_id, type, body, created_at) VALUES (?, ?, NULL, 'system', ?, ?)`,
    id,
    convId,
    body,
    now
  );
  await touchConv(db, convId, body, now);
  await emit(db, "message", convId, null, { id });
  return id;
}
async function canPost(mem, conv) {
  if (conv.type === "channel") return mem.role === "owner" || mem.role === "admin";
  return true;
}
async function requireOwnerLike(user, db) {
  const owner = await one(db, `SELECT id FROM users WHERE badge = 'owner' LIMIT 1`);
  if (!owner) return "bootstrap";
  if (user.badge === "owner") return "owner";
  if (user.badge === "admin") return "admin";
  return null;
}
app.post("/auth/register", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = cleanUsername(body.username);
  const password = typeof body.password === "string" ? body.password : "";
  const displayName = cleanText(body.displayName ?? body.username, 1, 40);
  const avatar = parseAvatar(body.avatar);
  if (!username) return jsonError(c, "\u06CC\u0648\u0632\u0631\u0646\u06CC\u0645 \u0628\u0627\u06CC\u062F \u0628\u0627 \u062D\u0631\u0641 \u0634\u0631\u0648\u0639 \u0628\u0634\u0647 \u0648 \u06F3 \u062A\u0627 \u06F2\u06F0 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0644\u0627\u062A\u06CC\u0646 \u0628\u0627\u0634\u0647");
  if (password.length < 6 || password.length > 72) return jsonError(c, "\u0631\u0645\u0632 \u062D\u062F\u0627\u0642\u0644 \u06F6 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631");
  if (!displayName) return jsonError(c, "\u0627\u0633\u0645 \u0646\u0645\u0627\u06CC\u0634\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631\u0647");
  if (avatar === false) return jsonError(c, "\u0639\u06A9\u0633 \u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A");
  const exists = await one(c.env.DB, `SELECT id FROM users WHERE username_lc = ?`, username.toLowerCase());
  if (exists) return jsonError(c, "\u0627\u06CC\u0646 \u06CC\u0648\u0632\u0631\u0646\u06CC\u0645 \u06AF\u0631\u0641\u062A\u0647 \u0634\u062F\u0647", 409);
  const now = Date.now();
  const id = randomId();
  await run(
    c.env.DB,
    `INSERT INTO users (id, username, username_lc, password_hash, display_name, bio, hue, avatar, badge, last_seen, last_seen_vis, created_at)
     VALUES (?, ?, ?, ?, ?, '', ?, ?, NULL, ?, 'everyone', ?)`,
    id,
    username,
    username.toLowerCase(),
    await hashPassword(password),
    displayName,
    hueFrom(username.toLowerCase()),
    avatar ?? null,
    now,
    now
  );
  const token = randomToken();
  await run(
    c.env.DB,
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
    randomId(),
    id,
    await sha256Hex(token),
    now + SESSION_MS,
    now
  );
  setCookie(c, COOKIE, token, cookieOpts(c, SESSION_MS / 1e3));
  const user = await one(c.env.DB, `SELECT * FROM users WHERE id = ?`, id);
  return c.json({ user: pub(user, id, true) });
});
app.post("/auth/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const user = await one(c.env.DB, `SELECT * FROM users WHERE username_lc = ?`, username);
  if (!user || !await verifyPassword(password, user.password_hash)) {
    return jsonError(c, "\u06CC\u0648\u0632\u0631\u0646\u06CC\u0645 \u06CC\u0627 \u0631\u0645\u0632 \u0627\u0634\u062A\u0628\u0627\u0647\u0647", 401);
  }
  const now = Date.now();
  const token = randomToken();
  await run(
    c.env.DB,
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
    randomId(),
    user.id,
    await sha256Hex(token),
    now + SESSION_MS,
    now
  );
  await run(c.env.DB, `UPDATE users SET last_seen = ? WHERE id = ?`, now, user.id);
  setCookie(c, COOKIE, token, cookieOpts(c, SESSION_MS / 1e3));
  return c.json({ user: pub(user, user.id, true) });
});
app.post("/auth/logout", async (c) => {
  const token = getCookie(c, COOKIE);
  if (token) {
    await run(c.env.DB, `DELETE FROM sessions WHERE token_hash = ?`, await sha256Hex(token));
  }
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});
app.get("/me", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  return c.json({ user: pub(user, user.id, true) });
});
app.patch("/me", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  let display = user.display_name;
  let bio = user.bio;
  let vis = user.last_seen_vis;
  let avatar = user.avatar ?? null;
  if (body.displayName !== void 0) {
    const d = cleanText(body.displayName, 1, 40);
    if (!d) return jsonError(c, "\u0627\u0633\u0645 \u0646\u0645\u0627\u06CC\u0634\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631\u0647");
    display = d;
  }
  if (body.bio !== void 0) {
    if (typeof body.bio !== "string" || body.bio.length > 180) return jsonError(c, "\u0628\u0627\u06CC\u0648 \u062D\u062F\u0627\u06A9\u062B\u0631 \u06F1\u06F8\u06F0 \u062D\u0631\u0641");
    bio = body.bio.trim();
  }
  if (body.lastSeenVis !== void 0) {
    if (!["everyone", "contacts", "nobody"].includes(body.lastSeenVis)) return jsonError(c, "\u062D\u0631\u06CC\u0645 \u0646\u0627\u0645\u0639\u062A\u0628\u0631");
    vis = body.lastSeenVis;
  }
  if (body.avatar !== void 0) {
    const parsed = parseAvatar(body.avatar);
    if (parsed === false) return jsonError(c, "\u0639\u06A9\u0633 \u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A");
    if (parsed !== void 0) avatar = parsed;
  }
  await run(
    c.env.DB,
    `UPDATE users SET display_name = ?, bio = ?, last_seen_vis = ?, avatar = ? WHERE id = ?`,
    display,
    bio,
    vis,
    avatar,
    user.id
  );
  const fresh = await one(c.env.DB, `SELECT * FROM users WHERE id = ?`, user.id);
  return c.json({ user: pub(fresh, user.id, true) });
});
app.patch("/me/password", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  if (!await verifyPassword(String(body.oldPassword || ""), user.password_hash)) {
    return jsonError(c, "\u0631\u0645\u0632 \u0641\u0639\u0644\u06CC \u0627\u0634\u062A\u0628\u0627\u0647\u0647", 403);
  }
  const next = String(body.newPassword || "");
  if (next.length < 6 || next.length > 72) return jsonError(c, "\u0631\u0645\u0632 \u062C\u062F\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F6 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631");
  await run(c.env.DB, `UPDATE users SET password_hash = ? WHERE id = ?`, await hashPassword(next), user.id);
  return c.json({ ok: true });
});
app.get("/users/search", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const q = (c.req.query("q") || "").trim().toLowerCase();
  if (q.length < 1) return c.json({ users: [] });
  const rows = await many(
    c.env.DB,
    `SELECT * FROM users
     WHERE id != ? AND (username_lc LIKE ? OR lower(display_name) LIKE ?)
     ORDER BY username_lc LIMIT 20`,
    user.id,
    `%${q}%`,
    `%${q}%`
  );
  const blockedIds = new Set(
    (await many(c.env.DB, `SELECT blocked_id FROM blocks WHERE blocker_id = ?`, user.id)).map((b) => b.blocked_id)
  );
  const filtered = rows.filter((r) => !blockedIds.has(r.id));
  return c.json({ users: await hydrateUsers(c.env.DB, filtered, user) });
});
app.get("/users/:username", async (c) => {
  const user = await auth(c, true);
  if (user instanceof Response) return user;
  const target = await one(
    c.env.DB,
    `SELECT * FROM users WHERE username_lc = ?`,
    c.req.param("username").toLowerCase()
  );
  if (!target) return jsonError(c, "\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F", 404);
  const contact = user ? await areContacts(c.env.DB, user.id, target.id) : false;
  const isBlocked = user ? await blocked(c.env.DB, user.id, target.id) : false;
  return c.json({ user: pub(target, user?.id ?? null, contact), blocked: isBlocked });
});
app.get("/conversations", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const rows = await many(
    c.env.DB,
    `SELECT c.* FROM conversations c
     JOIN members m ON m.conversation_id = c.id AND m.user_id = ?
     ORDER BY m.pinned DESC, c.last_message_at DESC`,
    user.id
  );
  const items = [];
  for (const row of rows) items.push(await conversationPayload(c.env.DB, row, user));
  return c.json({ conversations: items });
});
app.get("/conversations/:id", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const conv = await one(c.env.DB, `SELECT * FROM conversations WHERE id = ?`, c.req.param("id"));
  if (!conv) return jsonError(c, "\u06AF\u0641\u062A\u06AF\u0648 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F", 404);
  const mem = await memberOf(c.env.DB, conv.id, user.id);
  if (!mem) return jsonError(c, "\u0639\u0636\u0648 \u0627\u06CC\u0646 \u06AF\u0641\u062A\u06AF\u0648 \u0646\u06CC\u0633\u062A\u06CC", 403);
  return c.json({ conversation: await conversationPayload(c.env.DB, conv, user) });
});
app.post("/conversations/dm", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  const uname = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const other = await one(c.env.DB, `SELECT * FROM users WHERE username_lc = ?`, uname);
  if (!other) return jsonError(c, "\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F", 404);
  if (other.id === user.id) return jsonError(c, "\u0646\u0645\u06CC\u200C\u062A\u0648\u0646\u06CC \u0628\u0627 \u062E\u0648\u062F\u062A \u0686\u062A \u06A9\u0646\u06CC");
  if (await blocked(c.env.DB, user.id, other.id)) return jsonError(c, "\u0627\u06CC\u0646 \u06AF\u0641\u062A\u06AF\u0648 \u0645\u0633\u062F\u0648\u062F\u0647", 403);
  const key = [user.id, other.id].sort().join(":");
  let conv = await one(c.env.DB, `SELECT * FROM conversations WHERE dm_key = ?`, key);
  if (!conv) {
    const id = randomId();
    const now = Date.now();
    await run(
      c.env.DB,
      `INSERT INTO conversations (id, type, title, description, owner_id, dm_key, created_at, last_message_at, last_message_preview)
       VALUES (?, 'dm', NULL, '', ?, ?, ?, ?, '')`,
      id,
      user.id,
      key,
      now,
      now
    );
    await run(
      c.env.DB,
      `INSERT INTO members (conversation_id, user_id, role, joined_at, last_read_at) VALUES (?, ?, 'member', ?, ?)`,
      id,
      user.id,
      now,
      now
    );
    await run(
      c.env.DB,
      `INSERT INTO members (conversation_id, user_id, role, joined_at, last_read_at) VALUES (?, ?, 'member', ?, ?)`,
      id,
      other.id,
      now,
      now
    );
    conv = await one(c.env.DB, `SELECT * FROM conversations WHERE id = ?`, id);
    await emit(c.env.DB, "conversation", id, user.id, { type: "dm" });
  }
  return c.json({ conversation: await conversationPayload(c.env.DB, conv, user) });
});
app.post("/conversations/group", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  const title = cleanText(body.title, 1, 40);
  if (!title) return jsonError(c, "\u0627\u0633\u0645 \u06AF\u0631\u0648\u0647 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A");
  const usernames = Array.isArray(body.usernames) ? body.usernames : [];
  const id = randomId();
  const now = Date.now();
  await run(
    c.env.DB,
    `INSERT INTO conversations (id, type, title, description, owner_id, created_at, last_message_at, last_message_preview)
     VALUES (?, 'group', ?, ?, ?, ?, ?, ?)`,
    id,
    title,
    typeof body.description === "string" ? body.description.slice(0, 240) : "",
    user.id,
    now,
    now,
    "\u06AF\u0631\u0648\u0647 \u0633\u0627\u062E\u062A\u0647 \u0634\u062F"
  );
  await run(
    c.env.DB,
    `INSERT INTO members (conversation_id, user_id, role, joined_at, last_read_at) VALUES (?, ?, 'owner', ?, ?)`,
    id,
    user.id,
    now,
    now
  );
  for (const raw2 of usernames.slice(0, 40)) {
    const u = await one(c.env.DB, `SELECT * FROM users WHERE username_lc = ?`, String(raw2).toLowerCase());
    if (!u || u.id === user.id) continue;
    if (await blocked(c.env.DB, user.id, u.id)) continue;
    await run(
      c.env.DB,
      `INSERT OR IGNORE INTO members (conversation_id, user_id, role, joined_at, last_read_at) VALUES (?, ?, 'member', ?, ?)`,
      id,
      u.id,
      now,
      0
    );
  }
  await addSystem(c.env.DB, id, `${user.display_name} \u06AF\u0631\u0648\u0647 \xAB${title}\xBB \u0631\u0627 \u0633\u0627\u062E\u062A`);
  await emit(c.env.DB, "conversation", id, user.id, { type: "group" });
  const conv = await one(c.env.DB, `SELECT * FROM conversations WHERE id = ?`, id);
  return c.json({ conversation: await conversationPayload(c.env.DB, conv, user) });
});
app.post("/conversations/channel", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  const title = cleanText(body.title, 1, 40);
  if (!title) return jsonError(c, "\u0627\u0633\u0645 \u06A9\u0627\u0646\u0627\u0644 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A");
  const id = randomId();
  const now = Date.now();
  await run(
    c.env.DB,
    `INSERT INTO conversations (id, type, title, description, owner_id, created_at, last_message_at, last_message_preview)
     VALUES (?, 'channel', ?, ?, ?, ?, ?, ?)`,
    id,
    title,
    typeof body.description === "string" ? body.description.slice(0, 240) : "",
    user.id,
    now,
    now,
    "\u06A9\u0627\u0646\u0627\u0644 \u0633\u0627\u062E\u062A\u0647 \u0634\u062F"
  );
  await run(
    c.env.DB,
    `INSERT INTO members (conversation_id, user_id, role, joined_at, last_read_at) VALUES (?, ?, 'owner', ?, ?)`,
    id,
    user.id,
    now,
    now
  );
  await addSystem(c.env.DB, id, `${user.display_name} \u06A9\u0627\u0646\u0627\u0644 \xAB${title}\xBB \u0631\u0627 \u0633\u0627\u062E\u062A`);
  await emit(c.env.DB, "conversation", id, user.id, { type: "channel" });
  const conv = await one(c.env.DB, `SELECT * FROM conversations WHERE id = ?`, id);
  return c.json({ conversation: await conversationPayload(c.env.DB, conv, user) });
});
app.get("/explore/channels", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const q = (c.req.query("q") || "").trim();
  const rows = await many(
    c.env.DB,
    `SELECT * FROM conversations WHERE type = 'channel' AND (? = '' OR title LIKE ?)
     ORDER BY last_message_at DESC LIMIT 40`,
    q,
    `%${q}%`
  );
  const items = [];
  for (const row of rows) {
    const count = await one(
      c.env.DB,
      `SELECT COUNT(*) as n FROM members WHERE conversation_id = ?`,
      row.id
    );
    const joined = await memberOf(c.env.DB, row.id, user.id);
    items.push({
      id: row.id,
      title: row.title,
      description: row.description,
      lastMessageAt: row.last_message_at,
      members: count?.n ?? 0,
      joined: !!joined
    });
  }
  return c.json({ channels: items });
});
app.post("/conversations/:id/subscribe", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const conv = await one(c.env.DB, `SELECT * FROM conversations WHERE id = ?`, c.req.param("id"));
  if (!conv || conv.type !== "channel") return jsonError(c, "\u06A9\u0627\u0646\u0627\u0644 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F", 404);
  const now = Date.now();
  await run(
    c.env.DB,
    `INSERT OR IGNORE INTO members (conversation_id, user_id, role, joined_at, last_read_at) VALUES (?, ?, 'subscriber', ?, ?)`,
    conv.id,
    user.id,
    now,
    now
  );
  await emit(c.env.DB, "conversation", conv.id, user.id, { join: true });
  return c.json({ conversation: await conversationPayload(c.env.DB, conv, user) });
});
app.post("/conversations/:id/members", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const conv = await one(c.env.DB, `SELECT * FROM conversations WHERE id = ?`, c.req.param("id"));
  if (!conv) return jsonError(c, "\u06AF\u0641\u062A\u06AF\u0648 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F", 404);
  if (conv.type === "dm") return jsonError(c, "\u0628\u0647 \u067E\u06CC\u0648\u06CC \u0646\u0645\u06CC\u200C\u0634\u0648\u062F \u06A9\u0633\u06CC \u0627\u0636\u0627\u0641\u0647 \u06A9\u0631\u062F");
  const mem = await memberOf(c.env.DB, conv.id, user.id);
  if (!mem || mem.role !== "owner" && mem.role !== "admin") return jsonError(c, "\u0627\u062C\u0627\u0632\u0647 \u0646\u062F\u0627\u0631\u06CC", 403);
  const body = await c.req.json().catch(() => ({}));
  const uname = String(body.username || "").toLowerCase();
  const other = await one(c.env.DB, `SELECT * FROM users WHERE username_lc = ?`, uname);
  if (!other) return jsonError(c, "\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F", 404);
  const now = Date.now();
  const role = conv.type === "channel" ? "subscriber" : "member";
  await run(
    c.env.DB,
    `INSERT OR IGNORE INTO members (conversation_id, user_id, role, joined_at, last_read_at) VALUES (?, ?, ?, ?, 0)`,
    conv.id,
    other.id,
    role,
    now
  );
  await addSystem(c.env.DB, conv.id, `${user.display_name} ${other.display_name} \u0631\u0627 \u0627\u0636\u0627\u0641\u0647 \u06A9\u0631\u062F`);
  await emit(c.env.DB, "members", conv.id, user.id, {});
  return c.json({ ok: true });
});
app.patch("/conversations/:id/members/:userId", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const conv = await one(c.env.DB, `SELECT * FROM conversations WHERE id = ?`, c.req.param("id"));
  if (!conv || conv.type === "dm") return jsonError(c, "\u0646\u0627\u0645\u0639\u062A\u0628\u0631", 400);
  const mem = await memberOf(c.env.DB, conv.id, user.id);
  if (!mem || mem.role !== "owner") return jsonError(c, "\u0641\u0642\u0637 \u0645\u0627\u0644\u06A9 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0646\u0642\u0634 \u0628\u062F\u0647\u062F", 403);
  const role = c.req.query("role") || (await c.req.json().catch(() => ({}))).role;
  if (!["admin", "member", "subscriber"].includes(role)) return jsonError(c, "\u0646\u0642\u0634 \u0646\u0627\u0645\u0639\u062A\u0628\u0631");
  if (c.req.param("userId") === conv.owner_id) return jsonError(c, "\u0646\u0642\u0634 \u0645\u0627\u0644\u06A9 \u0639\u0648\u0636 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F");
  await run(
    c.env.DB,
    `UPDATE members SET role = ? WHERE conversation_id = ? AND user_id = ?`,
    role,
    conv.id,
    c.req.param("userId")
  );
  await emit(c.env.DB, "members", conv.id, user.id, {});
  return c.json({ ok: true });
});
app.delete("/conversations/:id/members/:userId", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const conv = await one(c.env.DB, `SELECT * FROM conversations WHERE id = ?`, c.req.param("id"));
  if (!conv || conv.type === "dm") return jsonError(c, "\u0646\u0627\u0645\u0639\u062A\u0628\u0631", 400);
  const mem = await memberOf(c.env.DB, conv.id, user.id);
  const targetId = c.req.param("userId");
  const self = targetId === user.id;
  if (!mem) return jsonError(c, "\u0639\u0636\u0648 \u0646\u06CC\u0633\u062A\u06CC", 403);
  if (!self && mem.role !== "owner" && mem.role !== "admin") return jsonError(c, "\u0627\u062C\u0627\u0632\u0647 \u0646\u062F\u0627\u0631\u06CC", 403);
  if (targetId === conv.owner_id && !self) return jsonError(c, "\u0645\u0627\u0644\u06A9 \u0631\u0627 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F \u062D\u0630\u0641 \u06A9\u0631\u062F");
  await run(c.env.DB, `DELETE FROM members WHERE conversation_id = ? AND user_id = ?`, conv.id, targetId);
  const target = await one(c.env.DB, `SELECT * FROM users WHERE id = ?`, targetId);
  await addSystem(
    c.env.DB,
    conv.id,
    self ? `${user.display_name} \u0631\u0641\u062A` : `${user.display_name} ${target?.display_name ?? "\u06A9\u0633\u06CC"} \u0631\u0627 \u062D\u0630\u0641 \u06A9\u0631\u062F`
  );
  await emit(c.env.DB, "members", conv.id, user.id, {});
  return c.json({ ok: true });
});
app.post("/conversations/:id/mute", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const mem = await memberOf(c.env.DB, c.req.param("id"), user.id);
  if (!mem) return jsonError(c, "\u0639\u0636\u0648 \u0646\u06CC\u0633\u062A\u06CC", 403);
  const next = mem.muted ? 0 : 1;
  await run(
    c.env.DB,
    `UPDATE members SET muted = ? WHERE conversation_id = ? AND user_id = ?`,
    next,
    c.req.param("id"),
    user.id
  );
  return c.json({ muted: !!next });
});
app.post("/conversations/:id/pin", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const mem = await memberOf(c.env.DB, c.req.param("id"), user.id);
  if (!mem) return jsonError(c, "\u0639\u0636\u0648 \u0646\u06CC\u0633\u062A\u06CC", 403);
  const next = mem.pinned ? 0 : 1;
  await run(
    c.env.DB,
    `UPDATE members SET pinned = ? WHERE conversation_id = ? AND user_id = ?`,
    next,
    c.req.param("id"),
    user.id
  );
  return c.json({ pinned: !!next });
});
app.patch("/conversations/:id", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const conv = await one(c.env.DB, `SELECT * FROM conversations WHERE id = ?`, c.req.param("id"));
  if (!conv || conv.type === "dm") return jsonError(c, "\u0646\u0627\u0645\u0639\u062A\u0628\u0631", 400);
  const mem = await memberOf(c.env.DB, conv.id, user.id);
  if (!mem || mem.role !== "owner" && mem.role !== "admin") return jsonError(c, "\u0627\u062C\u0627\u0632\u0647 \u0646\u062F\u0627\u0631\u06CC", 403);
  const body = await c.req.json().catch(() => ({}));
  const title = body.title !== void 0 ? cleanText(body.title, 1, 40) : conv.title;
  if (body.title !== void 0 && !title) return jsonError(c, "\u0627\u0633\u0645 \u0646\u0627\u0645\u0639\u062A\u0628\u0631");
  const description = body.description !== void 0 ? String(body.description).slice(0, 240) : conv.description;
  await run(c.env.DB, `UPDATE conversations SET title = ?, description = ? WHERE id = ?`, title, description, conv.id);
  await emit(c.env.DB, "conversation", conv.id, user.id, {});
  const fresh = await one(c.env.DB, `SELECT * FROM conversations WHERE id = ?`, conv.id);
  return c.json({ conversation: await conversationPayload(c.env.DB, fresh, user) });
});
app.get("/conversations/:id/messages", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const convId = c.req.param("id");
  if (!await memberOf(c.env.DB, convId, user.id)) return jsonError(c, "\u0639\u0636\u0648 \u0646\u06CC\u0633\u062A\u06CC", 403);
  const before = Number(c.req.query("before") || Date.now() + 1e6);
  const limit = Math.min(80, Math.max(1, Number(c.req.query("limit") || 50)));
  const rows = await many(
    c.env.DB,
    `SELECT * FROM messages WHERE conversation_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`,
    convId,
    before,
    limit
  );
  rows.reverse();
  return c.json({ messages: await messagesWithExtras(c.env.DB, rows, user.id) });
});
app.post("/conversations/:id/messages", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const conv = await one(c.env.DB, `SELECT * FROM conversations WHERE id = ?`, c.req.param("id"));
  if (!conv) return jsonError(c, "\u06AF\u0641\u062A\u06AF\u0648 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F", 404);
  const mem = await memberOf(c.env.DB, conv.id, user.id);
  if (!mem) return jsonError(c, "\u0639\u0636\u0648 \u0646\u06CC\u0633\u062A\u06CC", 403);
  if (!await canPost(mem, conv)) return jsonError(c, "\u062F\u0631 \u06A9\u0627\u0646\u0627\u0644 \u0641\u0642\u0637 \u0627\u062F\u0645\u06CC\u0646 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0628\u0646\u0648\u06CC\u0633\u062F", 403);
  if (conv.type === "dm") {
    const other = await one(
      c.env.DB,
      `SELECT * FROM members WHERE conversation_id = ? AND user_id != ?`,
      conv.id,
      user.id
    );
    if (other && await blocked(c.env.DB, user.id, other.user_id)) return jsonError(c, "\u0645\u0633\u062F\u0648\u062F \u0627\u0633\u062A", 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const kindRaw = body.type === "photo" || body.type === "video" || body.type === "voice" ? body.type : "text";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (kindRaw === "text") {
    if (!text || text.length > 4e3) return jsonError(c, "\u067E\u06CC\u0627\u0645 \u062E\u0627\u0644\u06CC \u06CC\u0627 \u062E\u06CC\u0644\u06CC \u0628\u0644\u0646\u062F \u0627\u0633\u062A");
  } else if (text.length > 400) {
    return jsonError(c, "\u06A9\u067E\u0634\u0646 \u062E\u06CC\u0644\u06CC \u0628\u0644\u0646\u062F \u0627\u0633\u062A");
  }
  let mediaId = null;
  let durationMs = null;
  if (kindRaw !== "text") {
    const parsed = parseMedia(body.media, kindRaw);
    if (!parsed) return jsonError(c, "\u0641\u0627\u06CC\u0644 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u06CC\u0627 \u062E\u06CC\u0644\u06CC \u0628\u0632\u0631\u06AF \u0627\u0633\u062A");
    mediaId = randomId();
    durationMs = parsed.durationMs || null;
    await run(
      c.env.DB,
      `INSERT INTO media (id, conversation_id, kind, mime, data, bytes, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      mediaId,
      conv.id,
      kindRaw,
      parsed.mime,
      parsed.data,
      parsed.bytes,
      durationMs,
      Date.now()
    );
  }
  let replyTo = body.replyToId || null;
  if (replyTo) {
    const r = await one(c.env.DB, `SELECT * FROM messages WHERE id = ? AND conversation_id = ?`, replyTo, conv.id);
    if (!r) replyTo = null;
  }
  const id = randomId();
  const now = Date.now();
  await run(
    c.env.DB,
    `INSERT INTO messages (id, conversation_id, author_id, type, body, reply_to_id, created_at, media_id, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    conv.id,
    user.id,
    kindRaw,
    text,
    replyTo,
    now,
    mediaId,
    durationMs
  );
  await touchConv(c.env.DB, conv.id, previewFor(kindRaw, text), now);
  await run(
    c.env.DB,
    `UPDATE members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?`,
    now,
    conv.id,
    user.id
  );
  await emit(c.env.DB, "message", conv.id, user.id, { id });
  const msg = await one(c.env.DB, `SELECT * FROM messages WHERE id = ?`, id);
  const [full] = await messagesWithExtras(c.env.DB, [msg], user.id);
  return c.json({ message: full });
});
app.patch("/messages/:id", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const msg = await one(c.env.DB, `SELECT * FROM messages WHERE id = ?`, c.req.param("id"));
  if (!msg || msg.author_id !== user.id || msg.type !== "text" || msg.deleted_at) {
    return jsonError(c, "\u0646\u0645\u06CC\u200C\u0634\u0648\u062F \u0648\u06CC\u0631\u0627\u06CC\u0634 \u06A9\u0631\u062F", 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text || text.length > 4e3) return jsonError(c, "\u0645\u062A\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631");
  const now = Date.now();
  await run(c.env.DB, `UPDATE messages SET body = ?, edited_at = ? WHERE id = ?`, text, now, msg.id);
  await emit(c.env.DB, "message", msg.conversation_id, user.id, { id: msg.id, edited: true });
  const fresh = await one(c.env.DB, `SELECT * FROM messages WHERE id = ?`, msg.id);
  const [full] = await messagesWithExtras(c.env.DB, [fresh], user.id);
  return c.json({ message: full });
});
app.delete("/messages/:id", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const msg = await one(c.env.DB, `SELECT * FROM messages WHERE id = ?`, c.req.param("id"));
  if (!msg) return jsonError(c, "\u067E\u06CC\u0627\u0645 \u0646\u06CC\u0633\u062A", 404);
  const mem = await memberOf(c.env.DB, msg.conversation_id, user.id);
  const conv = await one(c.env.DB, `SELECT * FROM conversations WHERE id = ?`, msg.conversation_id);
  const asMod = mem && conv && (mem.role === "owner" || mem.role === "admin");
  if (msg.author_id !== user.id && !asMod) return jsonError(c, "\u0627\u062C\u0627\u0632\u0647 \u0646\u062F\u0627\u0631\u06CC", 403);
  await run(c.env.DB, `UPDATE messages SET deleted_at = ?, body = '' WHERE id = ?`, Date.now(), msg.id);
  await emit(c.env.DB, "message", msg.conversation_id, user.id, { id: msg.id, deleted: true });
  return c.json({ ok: true });
});
app.post("/messages/:id/pin", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const msg = await one(c.env.DB, `SELECT * FROM messages WHERE id = ?`, c.req.param("id"));
  if (!msg) return jsonError(c, "\u067E\u06CC\u0627\u0645 \u0646\u06CC\u0633\u062A", 404);
  const mem = await memberOf(c.env.DB, msg.conversation_id, user.id);
  if (!mem) return jsonError(c, "\u0639\u0636\u0648 \u0646\u06CC\u0633\u062A\u06CC", 403);
  const next = msg.pinned ? 0 : 1;
  await run(c.env.DB, `UPDATE messages SET pinned = ? WHERE id = ?`, next, msg.id);
  await emit(c.env.DB, "message", msg.conversation_id, user.id, { id: msg.id, pinned: !!next });
  return c.json({ pinned: !!next });
});
app.post("/messages/:id/react", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const msg = await one(c.env.DB, `SELECT * FROM messages WHERE id = ?`, c.req.param("id"));
  if (!msg || !await memberOf(c.env.DB, msg.conversation_id, user.id)) return jsonError(c, "\u0646\u0627\u0645\u0639\u062A\u0628\u0631", 403);
  const body = await c.req.json().catch(() => ({}));
  const emoji = String(body.emoji || "");
  if (!EMOJIS.includes(emoji)) return jsonError(c, "\u0627\u06CC\u0645\u0648\u062C\u06CC \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A");
  const existing = await one(
    c.env.DB,
    `SELECT emoji FROM reactions WHERE message_id = ? AND user_id = ?`,
    msg.id,
    user.id
  );
  if (existing?.emoji === emoji) {
    await run(c.env.DB, `DELETE FROM reactions WHERE message_id = ? AND user_id = ?`, msg.id, user.id);
  } else {
    await run(
      c.env.DB,
      `INSERT INTO reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(message_id, user_id) DO UPDATE SET emoji = excluded.emoji`,
      msg.id,
      user.id,
      emoji,
      Date.now()
    );
  }
  await emit(c.env.DB, "message", msg.conversation_id, user.id, { id: msg.id, react: true });
  return c.json({ ok: true });
});
app.post("/messages/:id/forward", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const msg = await one(c.env.DB, `SELECT * FROM messages WHERE id = ?`, c.req.param("id"));
  if (!msg || msg.deleted_at) return jsonError(c, "\u067E\u06CC\u0627\u0645 \u0646\u06CC\u0633\u062A", 404);
  if (!await memberOf(c.env.DB, msg.conversation_id, user.id)) return jsonError(c, "\u0627\u062C\u0627\u0632\u0647 \u0646\u062F\u0627\u0631\u06CC", 403);
  const body = await c.req.json().catch(() => ({}));
  const destId = String(body.conversationId || "");
  const dest = await one(c.env.DB, `SELECT * FROM conversations WHERE id = ?`, destId);
  const mem = dest ? await memberOf(c.env.DB, dest.id, user.id) : null;
  if (!dest || !mem) return jsonError(c, "\u0645\u0642\u0635\u062F \u0646\u0627\u0645\u0639\u062A\u0628\u0631", 403);
  if (!await canPost(mem, dest)) return jsonError(c, "\u0627\u062C\u0627\u0632\u0647 \u0627\u0631\u0633\u0627\u0644 \u0646\u062F\u0627\u0631\u06CC", 403);
  const author = msg.author_id ? await one(c.env.DB, `SELECT * FROM users WHERE id = ?`, msg.author_id) : null;
  const id = randomId();
  const now = Date.now();
  await run(
    c.env.DB,
    `INSERT INTO messages (id, conversation_id, author_id, type, body, forwarded_from, created_at)
     VALUES (?, ?, ?, 'text', ?, ?, ?)`,
    id,
    dest.id,
    user.id,
    msg.body,
    author?.display_name || "\u0646\u0627\u0634\u0646\u0627\u0633",
    now
  );
  await touchConv(c.env.DB, dest.id, previewOf(msg.body), now);
  await emit(c.env.DB, "message", dest.id, user.id, { id });
  return c.json({ ok: true, id, conversationId: dest.id });
});
app.get("/media/:id", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const row = await one(c.env.DB, `SELECT id, conversation_id, mime, data FROM media WHERE id = ?`, c.req.param("id"));
  if (!row) return jsonError(c, "\u0641\u0627\u06CC\u0644 \u0646\u06CC\u0633\u062A", 404);
  if (!await memberOf(c.env.DB, row.conversation_id, user.id)) return jsonError(c, "\u0627\u062C\u0627\u0632\u0647 \u0646\u062F\u0627\u0631\u06CC", 403);
  const decoded = decodeDataUrl(row.data);
  if (!decoded) return jsonError(c, "\u0641\u0627\u06CC\u0644 \u062E\u0631\u0627\u0628 \u0627\u0633\u062A", 500);
  const copy = new Uint8Array(decoded.bytes.byteLength);
  copy.set(decoded.bytes);
  return new Response(new Blob([copy], { type: decoded.mime || row.mime || "application/octet-stream" }), {
    status: 200,
    headers: {
      "Content-Type": decoded.mime || row.mime || "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
      "Content-Disposition": "inline"
    }
  });
});
app.post("/conversations/:id/read", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const now = Date.now();
  await run(
    c.env.DB,
    `UPDATE members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?`,
    now,
    c.req.param("id"),
    user.id
  );
  await emit(c.env.DB, "read", c.req.param("id"), user.id, { at: now });
  return c.json({ ok: true });
});
app.post("/presence", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  await run(c.env.DB, `UPDATE users SET last_seen = ? WHERE id = ?`, Date.now(), user.id);
  return c.json({ ok: true });
});
app.post("/typing", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  const convId = String(body.conversationId || "");
  if (!await memberOf(c.env.DB, convId, user.id)) return jsonError(c, "\u0639\u0636\u0648 \u0646\u06CC\u0633\u062A\u06CC", 403);
  await run(
    c.env.DB,
    `INSERT INTO typing (conversation_id, user_id, until_ts) VALUES (?, ?, ?)
     ON CONFLICT(conversation_id, user_id) DO UPDATE SET until_ts = excluded.until_ts`,
    convId,
    user.id,
    Date.now() + 3e3
  );
  return c.json({ ok: true });
});
app.get("/sync", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const lite = c.req.query("lite") === "1";
  const after = Number(c.req.query("after") || 0);
  if (!lite) {
    await run(c.env.DB, `UPDATE users SET last_seen = ? WHERE id = ?`, Date.now(), user.id);
  }
  const events = await many(
    c.env.DB,
    `SELECT e.* FROM events e
     WHERE e.id > ?
       AND (
         e.conversation_id IS NULL
         OR e.conversation_id IN (SELECT conversation_id FROM members WHERE user_id = ?)
         OR e.kind IN ('story', 'badge')
       )
     ORDER BY e.id ASC LIMIT 80`,
    after,
    user.id
  );
  const messageIds = events.filter((e) => e.kind === "message").map((e) => {
    try {
      return JSON.parse(e.payload).id;
    } catch {
      return null;
    }
  }).filter(Boolean);
  let messages = [];
  if (messageIds.length) {
    const ph = messageIds.map(() => "?").join(",");
    const rows = await many(c.env.DB, `SELECT * FROM messages WHERE id IN (${ph})`, ...messageIds);
    messages = rows.map((m) => ({
      ...serializeMessage(m, user.id),
      reactions: [],
      replyTo: null
    }));
  }
  let conversations = [];
  if (!lite) {
    const heavyIds = [
      ...new Set(
        events.filter((e) => e.kind === "conversation" || e.kind === "members").map((e) => e.conversation_id).filter(Boolean)
      )
    ];
    if (heavyIds.length) {
      const ph = heavyIds.map(() => "?").join(",");
      const rows = await many(c.env.DB, `SELECT * FROM conversations WHERE id IN (${ph})`, ...heavyIds);
      for (const row of rows) {
        const mem = await memberOf(c.env.DB, row.id, user.id);
        if (mem) conversations.push(await conversationPayload(c.env.DB, row, user));
      }
    }
  }
  const now = Date.now();
  const typing = await many(
    c.env.DB,
    `SELECT t.conversation_id, t.user_id, u.display_name
     FROM typing t JOIN users u ON u.id = t.user_id
     WHERE t.until_ts > ? AND t.user_id != ?
       AND t.conversation_id IN (SELECT conversation_id FROM members WHERE user_id = ?)`,
    now,
    user.id,
    user.id
  );
  let presence = [];
  if (!lite) {
    const peerIds = await many(
      c.env.DB,
      `SELECT DISTINCT m2.user_id FROM members m1
       JOIN members m2 ON m1.conversation_id = m2.conversation_id
       WHERE m1.user_id = ? AND m2.user_id != ?`,
      user.id,
      user.id
    );
    if (peerIds.length) {
      const ph = peerIds.map(() => "?").join(",");
      const users = await many(
        c.env.DB,
        `SELECT id, last_seen, last_seen_vis, badge FROM users WHERE id IN (${ph})`,
        ...peerIds.map((p) => p.user_id)
      );
      for (const u of users) {
        const online = now - u.last_seen < ONLINE_MS;
        const lastSeen = u.last_seen_vis === "nobody" ? null : u.last_seen;
        presence.push({ id: u.id, online: lastSeen !== null && online, lastSeen, badge: u.badge });
      }
    }
  }
  const cursor = events.length ? events[events.length - 1].id : after;
  return c.json({
    cursor,
    events: events.map((e) => ({
      id: e.id,
      ts: e.ts,
      kind: e.kind,
      conversationId: e.conversation_id,
      actorId: e.actor_id
    })),
    messages,
    conversations,
    typing,
    presence,
    serverTime: now
  });
});
app.get("/stories", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const now = Date.now();
  await run(c.env.DB, `DELETE FROM stories WHERE expires_at < ?`, now);
  const rows = await many(
    c.env.DB,
    `SELECT u.*, s.id as story_id, s.body as story_body, s.created_at as story_created, s.expires_at as story_expires
     FROM stories s JOIN users u ON u.id = s.user_id
     WHERE s.expires_at > ?
       AND (
         s.user_id = ?
         OR s.user_id IN (
           SELECT m2.user_id FROM members m1
           JOIN members m2 ON m1.conversation_id = m2.conversation_id
           JOIN conversations c ON c.id = m1.conversation_id AND c.type = 'dm'
           WHERE m1.user_id = ?
         )
       )
     ORDER BY (s.user_id = ?) DESC, s.created_at DESC`,
    now,
    user.id,
    user.id,
    user.id
  );
  const grouped = {};
  for (const r of rows) {
    const contact = await areContacts(c.env.DB, user.id, r.id);
    if (!grouped[r.id]) grouped[r.id] = { user: pub(r, user.id, contact), stories: [] };
    const viewed = await one(
      c.env.DB,
      `SELECT viewer_id FROM story_views WHERE story_id = ? AND viewer_id = ?`,
      r.story_id,
      user.id
    );
    grouped[r.id].stories.push({
      id: r.story_id,
      body: r.story_body,
      createdAt: r.story_created,
      expiresAt: r.story_expires,
      viewed: !!viewed
    });
  }
  return c.json({ rings: Object.values(grouped) });
});
app.post("/stories", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text || text.length > 280) return jsonError(c, "\u0627\u0633\u062A\u0648\u0631\u06CC \u0645\u062A\u0646\u06CC \u062A\u0627 \u06F2\u06F8\u06F0 \u062D\u0631\u0641");
  const now = Date.now();
  const id = randomId();
  await run(
    c.env.DB,
    `INSERT INTO stories (id, user_id, body, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`,
    id,
    user.id,
    text,
    now,
    now + 24 * 60 * 60 * 1e3
  );
  await emit(c.env.DB, "story", null, user.id, { id });
  return c.json({ id });
});
app.delete("/stories/:id", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  await run(c.env.DB, `DELETE FROM stories WHERE id = ? AND user_id = ?`, c.req.param("id"), user.id);
  await emit(c.env.DB, "story", null, user.id, { deleted: c.req.param("id") });
  return c.json({ ok: true });
});
app.post("/stories/:id/view", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  await run(
    c.env.DB,
    `INSERT OR IGNORE INTO story_views (story_id, viewer_id, viewed_at) VALUES (?, ?, ?)`,
    c.req.param("id"),
    user.id,
    Date.now()
  );
  return c.json({ ok: true });
});
app.get("/stories/:id/views", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const story = await one(c.env.DB, `SELECT user_id FROM stories WHERE id = ?`, c.req.param("id"));
  if (!story || story.user_id !== user.id) return jsonError(c, "\u0627\u062C\u0627\u0632\u0647 \u0646\u062F\u0627\u0631\u06CC", 403);
  const rows = await many(
    c.env.DB,
    `SELECT u.* FROM story_views v JOIN users u ON u.id = v.viewer_id WHERE v.story_id = ? ORDER BY v.viewed_at DESC`,
    c.req.param("id")
  );
  return c.json({ users: await hydrateUsers(c.env.DB, rows, user) });
});
app.get("/search", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const q = (c.req.query("q") || "").trim();
  const convId = c.req.query("conversationId");
  if (q.length < 2) return c.json({ messages: [] });
  let sql = `SELECT msg.* FROM messages msg
    JOIN members m ON m.conversation_id = msg.conversation_id AND m.user_id = ?
    WHERE msg.deleted_at IS NULL AND msg.type = 'text' AND msg.body LIKE ?`;
  const params = [user.id, `%${q}%`];
  if (convId) {
    sql += ` AND msg.conversation_id = ?`;
    params.push(convId);
  }
  sql += ` ORDER BY msg.created_at DESC LIMIT 40`;
  const rows = await many(c.env.DB, sql, ...params);
  return c.json({ messages: rows.map((m) => serializeMessage(m, user.id)) });
});
app.get("/blocks", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const rows = await many(
    c.env.DB,
    `SELECT u.* FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ?`,
    user.id
  );
  return c.json({ users: await hydrateUsers(c.env.DB, rows, user) });
});
app.post("/blocks", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  const target = await one(c.env.DB, `SELECT * FROM users WHERE id = ?`, String(body.userId || ""));
  if (!target || target.id === user.id) return jsonError(c, "\u0646\u0627\u0645\u0639\u062A\u0628\u0631");
  await run(
    c.env.DB,
    `INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)`,
    user.id,
    target.id,
    Date.now()
  );
  return c.json({ ok: true });
});
app.delete("/blocks/:userId", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  await run(c.env.DB, `DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?`, user.id, c.req.param("userId"));
  return c.json({ ok: true });
});
app.get("/admin/users", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const gate = await requireOwnerLike(user, c.env.DB);
  if (!gate) return jsonError(c, "\u0627\u06CC\u0646 \u067E\u0646\u0644 \u0628\u0631\u0627\u06CC \u062A\u0648 \u0646\u06CC\u0633\u062A", 403);
  const q = (c.req.query("q") || "").trim().toLowerCase();
  const rows = await many(
    c.env.DB,
    `SELECT * FROM users
     WHERE ? = '' OR username_lc LIKE ? OR lower(display_name) LIKE ?
     ORDER BY created_at DESC LIMIT 200`,
    q,
    `%${q}%`,
    `%${q}%`
  );
  return c.json({
    me: pub(user, user.id, true),
    gate,
    users: rows.map((u) => ({
      ...pub(u, user.id, true),
      lastSeen: u.last_seen,
      online: Date.now() - u.last_seen < ONLINE_MS
    }))
  });
});
app.patch("/admin/users/:id", async (c) => {
  const user = await auth(c);
  if (user instanceof Response) return user;
  const gate = await requireOwnerLike(user, c.env.DB);
  if (!gate) return jsonError(c, "\u0627\u06CC\u0646 \u067E\u0646\u0644 \u0628\u0631\u0627\u06CC \u062A\u0648 \u0646\u06CC\u0633\u062A", 403);
  const body = await c.req.json().catch(() => ({}));
  const badge = body.badge === null || body.badge === "" ? null : String(body.badge);
  if (badge !== null && !["owner", "admin", "verified"].includes(badge)) return jsonError(c, "\u062A\u06CC\u06A9 \u0646\u0627\u0645\u0639\u062A\u0628\u0631");
  if (gate === "admin" && badge !== "verified" && badge !== null) {
    return jsonError(c, "\u0627\u062F\u0645\u06CC\u0646 \u0641\u0642\u0637 \u062A\u06CC\u06A9 \u062A\u0627\u06CC\u06CC\u062F \u0631\u0627 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0628\u062F\u0647\u062F", 403);
  }
  const target = await one(c.env.DB, `SELECT * FROM users WHERE id = ?`, c.req.param("id"));
  if (!target) return jsonError(c, "\u06A9\u0627\u0631\u0628\u0631 \u0646\u06CC\u0633\u062A", 404);
  if (gate !== "bootstrap" && target.badge === "owner" && user.badge !== "owner") {
    return jsonError(c, "\u062A\u06CC\u06A9 \u0645\u0627\u0644\u06A9 \u062F\u0633\u062A\u200C\u0646\u062E\u0648\u0631\u062F\u0646\u06CC \u0627\u0633\u062A", 403);
  }
  await run(c.env.DB, `UPDATE users SET badge = ? WHERE id = ?`, badge, target.id);
  await emit(c.env.DB, "badge", null, user.id, { userId: target.id, badge });
  const fresh = await one(c.env.DB, `SELECT * FROM users WHERE id = ?`, target.id);
  return c.json({ user: pub(fresh, user.id, true) });
});
app.all("*", (c) => jsonError(c, "\u0645\u0633\u06CC\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F", 404));
var app_default = app;

// functions/_middleware.ts
async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    if (!context.env?.DB) {
      return Response.json(
        { error: "\u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0648\u0635\u0644 \u0646\u06CC\u0633\u062A. \u062F\u0631 Cloudflare Pages \u2192 Bindings \u2192 D1 \u06CC\u06A9 \u0645\u062A\u063A\u06CC\u0631 \u0628\u0647 \u0627\u0633\u0645 DB \u0628\u0647 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 t \u0648\u0635\u0644 \u06A9\u0646." },
        { status: 503 }
      );
    }
    try {
      return await app_default.fetch(context.request, context.env);
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 500 }
      );
    }
  }
  return context.next();
}
export {
  onRequest
};
