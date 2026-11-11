// OMG in a Web Worker.
//
// The page never runs OMG on its own thread. It posts source text here; this
// worker runs it and streams the output back, so a slow program (or one that
// never ends) leaves the page responsive and can be stopped by terminating
// the worker.
//
// Three programs can be loaded, each a single JavaScript file:
//
//   omg-web.js       The OMG compiler and the OMG virtual machine, both
//                    written in OMG, compiled to JavaScript by OMG's own
//                    JavaScript backend. Runs a program.
//   omg-explorer.js  The same, plus the C and JavaScript backends. Reports
//                    every stage: tokens, syntax tree, bytecode, C,
//                    JavaScript, then the program's output.
//   omg-rt.js        The runtime that every JavaScript file produced by the
//                    backend starts with. Used to run the JavaScript the
//                    explorer generated for a program.
//
// All three are copied unchanged from the OMG repository
// (https://github.com/sentrychris/omglang): web/omg-web.js,
// web/omg-explorer.js and bootstrap/src/omg_rt.js. To move the site to a
// newer OMG, run bootstrap/build-web.sh there and copy the three files again.
//
// A bundle is a script that runs top to bottom, reading its input from a few
// `let` bindings at the top (args, the output functions, the file system).
// Those lines are rewritten to read from a host object, and the whole script
// becomes the body of a function. Calling the function runs the bundle from
// a clean state, which is exactly what a fresh `omg` process would be.

'use strict';

// ---------------------------------------------------------------------------
// Rewrites applied to a bundle's runtime header. Every one must match, so a
// change to omg_rt.js in the language repository fails loudly here instead of
// quietly writing to a console nobody reads.
// ---------------------------------------------------------------------------

const PATCHES = [
  [
    "let _omg_write = (s) => { console.log(s); };",
    "let _omg_write = (s) => { __host.write(String(s) + '\\n'); };",
  ],
  [
    "let _omg_print_raw = (s) => { process.stdout.write(s); };",
    "let _omg_print_raw = (s) => { __host.write(String(s)); };",
  ],
  [
    "let _omg_exit = (code) => { if (typeof process !== 'undefined') process.exit(Number(code)); };",
    "let _omg_exit = (code) => { throw new OmgError('Exit', '' + code); };",
  ],
  [
    "let _omg_fs = null;",
    "let _omg_fs = __host.fs;",
  ],
  [
    "let args = (typeof process !== 'undefined') ? process.argv.slice(1) : [];",
    "let args = __host.args;",
  ],
];

function patchBundle(text, name) {
  let out = text;
  for (const [from, to] of PATCHES) {
    if (!out.includes(from)) {
      throw new Error(name + ': the runtime header has changed (missing: ' + from.slice(0, 40) + '…)');
    }
    out = out.replace(from, () => to);
  }
  return out;
}

// The bundle is written for Node as well as the browser and checks for
// `process` and `require` to tell them apart. Both are passed in as
// undefined so it always takes the browser path, wherever this file runs.
function compileBundle(text, name) {
  // eslint-disable-next-line no-new-func
  return new Function('__host', 'process', 'require', 'Buffer', patchBundle(text, name));
}

// ---------------------------------------------------------------------------
// A small Buffer. The runtime's file handles keep their contents in Node
// Buffers; this covers the handful of methods they use.
// ---------------------------------------------------------------------------

class Buf extends Uint8Array {
  static alloc(n) {
    return new Buf(n);
  }
  static from(data) {
    if (typeof data === 'string') {
      const bytes = new TextEncoder().encode(data);
      const b = new Buf(bytes.length);
      b.set(bytes);
      return b;
    }
    const b = new Buf(data.length);
    b.set(data);
    return b;
  }
  static concat(list) {
    let total = 0;
    for (const part of list) total += part.length;
    const b = new Buf(total);
    let at = 0;
    for (const part of list) {
      b.set(part, at);
      at += part.length;
    }
    return b;
  }
  copy(target, targetStart = 0, start = 0, end = this.length) {
    target.set(this.subarray(start, end), targetStart);
  }
  toString() {
    return new TextDecoder().decode(this);
  }
}

// ---------------------------------------------------------------------------
// An in-memory file system, new for every run. It gives `read_file`,
// `file_open`, `make_dir` and `import` something real to work on without
// touching the visitor's machine. Paths are relative to one root folder.
// ---------------------------------------------------------------------------

function normalisePath(path) {
  const parts = [];
  for (const part of String(path).replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function parentOf(path) {
  const cut = path.lastIndexOf('/');
  return cut < 0 ? '' : path.slice(0, cut);
}

function createFs(seed) {
  const files = new Map();
  const dirs = new Set(['']);

  const addDirs = (path) => {
    let dir = parentOf(path);
    while (dir !== '' && !dirs.has(dir)) {
      dirs.add(dir);
      dir = parentOf(dir);
    }
  };
  for (const [path, text] of Object.entries(seed || {})) {
    const p = normalisePath(path);
    addDirs(p);
    files.set(p, Buf.from(text));
  }

  const missing = (path) => new Error("ENOENT: no such file or directory, '" + path + "'");

  return {
    readFileSync(path, encoding) {
      // File descriptor 0 is standard input, which a web page does not have.
      if (typeof path !== 'string') throw new Error('EAGAIN: standard input is not available');
      const p = normalisePath(path);
      const data = files.get(p);
      if (!data) throw dirs.has(p) ? new Error("EISDIR: illegal operation on a directory, '" + path + "'") : missing(path);
      return encoding ? data.toString() : Buf.from(data);
    },
    writeFileSync(path, data, options) {
      const p = normalisePath(path);
      if (p === '' || dirs.has(p)) throw new Error("EISDIR: illegal operation on a directory, '" + path + "'");
      if (!dirs.has(parentOf(p))) throw missing(path);
      const bytes = Buf.from(data);
      if (options && options.flag === 'a' && files.has(p)) files.set(p, Buf.concat([files.get(p), bytes]));
      else files.set(p, bytes);
    },
    existsSync(path) {
      const p = normalisePath(path);
      return files.has(p) || dirs.has(p);
    },
    statSync(path) {
      const p = normalisePath(path);
      if (!files.has(p) && !dirs.has(p)) throw missing(path);
      return { isDirectory: () => dirs.has(p) };
    },
    readdirSync(path) {
      const p = normalisePath(path);
      if (!dirs.has(p)) throw missing(path);
      const prefix = p === '' ? '' : p + '/';
      const names = new Set();
      for (const name of [...files.keys(), ...dirs]) {
        if (name !== p && name.startsWith(prefix)) names.add(name.slice(prefix.length).split('/')[0]);
      }
      names.delete('');
      return [...names];
    },
    mkdirSync(path) {
      const p = normalisePath(path);
      if (files.has(p)) throw new Error("EEXIST: file already exists, '" + path + "'");
      addDirs(p + '/x');
    },
    // Not part of Node's API: lists what a run left behind, for the page.
    snapshot() {
      const out = {};
      for (const [name, data] of files) out[name] = data.toString();
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// One run.
// ---------------------------------------------------------------------------

const OUTPUT_LIMIT = 2000000; // characters
const FLUSH_EVERY_MS = 40;

class OutputLimit extends Error {}
class StopEarly extends Error {}

// The explorer prints this line before it runs the program on the VM.
const RUN_STAGE = '___OMG_EXPLORER_STAGE___run___OMG_EXPLORER_STAGE___';

/**
 * Runs a compiled bundle once.
 *
 * @param {Function} program  the result of compileBundle
 * @param {string[]} args     what the bundle sees as its command line
 * @param {object}   options  files:      { path: text } for the file system
 *                            onOutput:   called with each chunk of output
 *                            stopAt:     stop quietly when this text is printed
 *                            traceback:  the bundle is the user's own program,
 *                                        so its traceback is worth showing
 * @returns {{ ok: boolean, error: string, exitCode: number, files: object }}
 */
function runBundle(program, args, options) {
  const fs = createFs(options.files);
  let pending = '';
  let total = 0;
  let lastFlush = Date.now();

  const flush = () => {
    if (pending !== '') {
      options.onOutput(pending);
      pending = '';
    }
    lastFlush = Date.now();
  };

  const host = {
    args,
    fs,
    write(text) {
      if (options.stopAt && text.startsWith(options.stopAt)) throw new StopEarly();
      // A program that redraws the screen (clear, or cursor to the top) is
      // animating, not piling up output, so the count starts again.
      if (text.indexOf('\x1b[H') >= 0 || text.indexOf('\x1b[2J') >= 0) total = 0;
      total += text.length;
      if (total > OUTPUT_LIMIT) throw new OutputLimit();
      pending += text;
      if (Date.now() - lastFlush >= FLUSH_EVERY_MS) flush();
    },
  };

  let ok = true;
  let error = '';
  let exitCode = 0;
  try {
    program(host, undefined, undefined, Buf);
  } catch (e) {
    if (e instanceof StopEarly) {
      // Asked for: nothing went wrong.
    } else if (e instanceof OutputLimit) {
      ok = false;
      error = 'Stopped: the program printed more than ' + OUTPUT_LIMIT / 1000000 + ' million characters.';
    } else if (e && e.kind === 'Exit') {
      // exit(code) and exit_with_error(message) both arrive here. exit(n)
      // inside the VM surfaces as a traceback ending "Exit: n". Any other
      // message is an error the program did not catch.
      const message = String(e.omgMessage);
      const status = /^(-?\d+)$/.exec(message) || /(?:^|\n)Exit: (-?\d+)\s*$/.exec(message);
      if (status) {
        exitCode = Number(status[1]);
        ok = exitCode === 0;
        if (!ok) error = 'Exited with status ' + exitCode + '.';
      } else {
        ok = false;
        exitCode = 1;
        error = message;
      }
    } else if (e && e.kind !== undefined && e.omgMessage !== undefined) {
      // An error raised by the bundle itself, which in practice means the
      // compiler rejecting the source. Its own traceback points into the
      // compiler, so only the message is worth showing.
      ok = false;
      exitCode = 1;
      const message = String(e.omgMessage);
      if (options.traceback && String(e.message).startsWith('Traceback')) error = e.message;
      else error = e.kind === 'RuntimeError' && /^[A-Za-z]+Error: /.test(message) ? message : e.kind + ': ' + message;
    } else if (e instanceof RangeError && /call stack/i.test(e.message)) {
      ok = false;
      exitCode = 1;
      error = 'RecursionError: the program recursed too deeply for the browser to follow.';
    } else {
      ok = false;
      exitCode = 1;
      error = 'Internal error: ' + (e && e.message ? e.message : String(e));
    }
  }
  flush();
  return { ok, error, exitCode, files: fs.snapshot() };
}

// The JavaScript backend's output has a short comment where the native build
// would paste the runtime. Putting the real runtime in front gives a complete
// program, which can then be run like any other bundle.
function linkGeneratedJs(js, runtime) {
  return runtime + '\n' + js;
}

// ---------------------------------------------------------------------------
// Worker plumbing.
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  // Loaded by Node for tests.
  module.exports = { compileBundle, runBundle, linkGeneratedJs, createFs, normalisePath };
} else {
  const FILES = { vm: 'omg-web.js', explorer: 'omg-explorer.js', runtime: 'omg-rt.js' };
  const texts = {};
  const programs = {};

  const fetchText = (kind) => {
    if (!texts[kind]) {
      texts[kind] = fetch(new URL(FILES[kind], self.location.href)).then((response) => {
        if (!response.ok) throw new Error(FILES[kind] + ': HTTP ' + response.status);
        return response.text();
      });
      texts[kind].catch(() => {
        delete texts[kind];
      });
    }
    return texts[kind];
  };

  const loadProgram = (kind) => {
    if (!programs[kind]) {
      programs[kind] = fetchText(kind).then((text) => compileBundle(text, FILES[kind]));
      programs[kind].catch(() => {
        delete programs[kind];
      });
    }
    return programs[kind];
  };

  self.onmessage = async (event) => {
    const message = event.data;
    const id = message.id;
    try {
      if (message.type === 'load') {
        await (message.kind === 'runtime' ? fetchText('runtime') : loadProgram(message.kind));
        self.postMessage({ type: 'loaded', id });
        return;
      }

      let program;
      let args;
      const extra = {};
      if (message.type === 'run') {
        // Compile to bytecode, then interpret it on the OMG virtual machine.
        program = await loadProgram('vm');
        args = ['<playground>', message.source];
      } else if (message.type === 'explore') {
        program = await loadProgram('explorer');
        args = ['<omg-explorer>', '<source>', message.source];
        if (!message.run) extra.stopAt = RUN_STAGE;
      } else if (message.type === 'run-js') {
        // Run JavaScript that the explorer's backend generated.
        const runtime = await fetchText('runtime');
        program = compileBundle(linkGeneratedJs(message.js, runtime), 'generated JavaScript');
        args = ['<playground>'];
        extra.traceback = true;
      } else {
        throw new Error('unknown message: ' + message.type);
      }

      self.postMessage({ type: 'start', id });
      const started = performance.now();
      const result = runBundle(program, args, {
        ...extra,
        files: message.files,
        onOutput: (text) => self.postMessage({ type: 'out', id, text }),
      });
      self.postMessage({
        type: 'done',
        id,
        ok: result.ok,
        error: result.error,
        exitCode: result.exitCode,
        files: result.files,
        ms: performance.now() - started,
      });
    } catch (e) {
      self.postMessage({ type: 'done', id, ok: false, error: 'Could not start: ' + (e && e.message ? e.message : String(e)), exitCode: 1, files: {}, ms: 0 });
    }
  };
}
