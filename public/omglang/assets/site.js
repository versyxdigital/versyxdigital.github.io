// OMG site: shared behaviour for every page under /omglang/.
//
// Exposes one global, `OMG`, with:
//   highlight(source)            OMG source -> highlighted HTML
//   createEditor(textarea, opts) a small code editor around a <textarea>
//   run(options)                 run a program in a worker
//   stop()                       stop the program that is running
//   explore(source, options)     tokens, syntax tree, bytecode, C and JS
//   createTerminal(element)      an output area that understands a few
//                                terminal escape codes (for animations)
//   share                        encode and decode "#code=..." links
//
// It also upgrades the markup the pages are written in: runnable snippets,
// live compiler-stage labs, highlighted code blocks and the contents list.

(function () {
  'use strict';

  const ASSETS = new URL('.', document.currentScript.src);
  const ROOT = new URL('..', ASSETS);

  // =========================================================================
  // Theme
  // =========================================================================

  // The first paint is handled by a tiny inline script in each page's <head>;
  // this only wires the toggle.
  function initTheme() {
    const button = document.getElementById('themeToggle');
    if (!button) return;
    button.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem('omg-theme', next);
      } catch (_) {
        /* private mode: the choice lasts for this page only */
      }
    });
  }

  // =========================================================================
  // Syntax highlighting
  // =========================================================================

  const KEYWORDS = new Set([
    'alloc', 'and', 'as', 'break', 'continue', 'elif', 'else', 'emit', 'except', 'facts',
    'for', 'if', 'import', 'in', 'loop', 'not', 'or', 'proc', 'return', 'try',
  ]);

  const BUILTINS = new Set([
    'length', 'chr', 'ascii', 'string_bytes', 'bytes_to_string',
    'int', 'float', 'floor', 'ceil', 'round', 'abs', 'sqrt', 'pow', 'log', 'sin', 'cos', 'tan',
    'hex', 'binary', 'float_bits', 'bits_to_float',
    'freeze', 'dict_keys', 'has_key', 'list_repeat', 'append',
    'read_file', 'file_open', 'file_read', 'file_write', 'file_close', 'file_seek', 'file_tell',
    'file_exists', 'is_dir', 'read_dir', 'make_dir',
    'stdin_readline', 'stdin_read', 'stdin_read_bytes', 'stdin_set_raw', 'stdin_read_key',
    'time_ms', 'sleep_ms', 'print',
    'panic', 'raise', 'exit', 'exit_with_error',
    'subprocess', 'getpid', 'call_builtin',
  ]);

  const LANGVARS = new Set(['args', 'module_file', 'current_dir']);

  const isSpace = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
  const isDigit = (c) => c >= '0' && c <= '9';
  const isIdentStart = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  const isIdent = (c) => isIdentStart(c) || isDigit(c);

  function tokenize(src) {
    const tokens = [];
    const n = src.length;
    let i = 0;
    while (i < n) {
      const ch = src[i];
      let j = i;

      if (isSpace(ch)) {
        while (j < n && isSpace(src[j])) j++;
        tokens.push({ text: src.slice(i, j) });
      } else if (ch === ';' && src.startsWith(';;;omg', i) && (i === 0 || src[i - 1] === '\n')) {
        while (j < n && src[j] !== '\n') j++;
        tokens.push({ type: 'header', text: src.slice(i, j) });
      } else if (ch === '#') {
        while (j < n && src[j] !== '\n') j++;
        tokens.push({ type: 'comment', text: src.slice(i, j) });
      } else if (ch === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        j = end < 0 ? n : end + 2;
        tokens.push({ type: 'comment', text: src.slice(i, j) });
      } else if (ch === '"') {
        j = i + 1;
        while (j < n && src[j] !== '"' && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
        if (src[j] === '"') j++;
        j = Math.min(j, n);
        tokens.push({ type: 'string', text: src.slice(i, j) });
      } else if (isDigit(ch)) {
        if (ch === '0' && (src[i + 1] === 'b' || src[i + 1] === 'B')) {
          j = i + 2;
          while (j < n && (src[j] === '0' || src[j] === '1')) j++;
        } else {
          while (j < n && isDigit(src[j])) j++;
          if (src[j] === '.' && isDigit(src[j + 1] || '')) {
            j++;
            while (j < n && isDigit(src[j])) j++;
          }
          if ((src[j] === 'e' || src[j] === 'E') && /[0-9+-]/.test(src[j + 1] || '')) {
            j += 2;
            while (j < n && isDigit(src[j])) j++;
          }
        }
        tokens.push({ type: 'number', text: src.slice(i, j) });
      } else if (isIdentStart(ch)) {
        while (j < n && isIdent(src[j])) j++;
        const word = src.slice(i, j);
        let type;
        if (KEYWORDS.has(word)) type = 'keyword';
        else if (word === 'true' || word === 'false') type = 'boolean';
        else if (LANGVARS.has(word)) type = 'langvar';
        else {
          let k = j;
          while (k < n && (src[k] === ' ' || src[k] === '\t')) k++;
          if (src[k] === '(') type = BUILTINS.has(word) ? 'builtin' : 'fn';
        }
        tokens.push({ type, text: word });
      } else {
        const two = src.slice(i, i + 2);
        if ([':=', '==', '!=', '<=', '>=', '<<', '>>', '//'].includes(two)) j = i + 2;
        else j = i + 1;
        const text = src.slice(i, j);
        tokens.push('+-*/%<>=&|^~:!'.includes(ch) ? { type: 'op', text } : { text });
      }
      i = j;
    }
    return tokens;
  }

  function escapeHTML(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlight(src) {
    let html = '';
    for (const t of tokenize(src)) {
      const safe = escapeHTML(t.text);
      html += t.type ? '<span class="tok-' + t.type + '">' + safe + '</span>' : safe;
    }
    return html;
  }

  // =========================================================================
  // Editor
  // =========================================================================

  // Types text at the caret through the browser's own editing path, so that
  // undo and redo keep working.
  function insertText(textarea, text, selectFrom, selectTo) {
    if (selectFrom !== undefined) textarea.setSelectionRange(selectFrom, selectTo);
    let done = false;
    try {
      done = document.execCommand('insertText', false, text);
    } catch (_) {
      done = false;
    }
    if (!done) {
      textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Turns a <textarea> into a code editor with highlighting.
   *
   * options:
   *   gutter    show line numbers
   *   auto      grow to fit the content instead of scrolling vertically
   *   onChange  called with the new text after every edit
   *   onRun     called on Ctrl+Enter (Cmd+Enter on a Mac)
   */
  function createEditor(textarea, options) {
    const opts = options || {};
    const root = document.createElement('div');
    root.className = 'ed' + (opts.auto ? ' ed-auto' : '');

    let gutterInner = null;
    if (opts.gutter) {
      const gutter = document.createElement('pre');
      gutter.className = 'ed-gutter';
      gutter.setAttribute('aria-hidden', 'true');
      gutterInner = document.createElement('code');
      gutterInner.style.display = 'block';
      gutter.appendChild(gutterInner);
      root.appendChild(gutter);
    }

    const area = document.createElement('div');
    area.className = 'ed-area';
    const hl = document.createElement('pre');
    hl.className = 'ed-hl';
    hl.setAttribute('aria-hidden', 'true');
    const hlInner = document.createElement('code');
    hlInner.style.display = 'block';
    hl.appendChild(hlInner);
    area.appendChild(hl);

    textarea.parentNode.insertBefore(root, textarea);
    area.appendChild(textarea);
    root.appendChild(area);

    textarea.classList.add('ed-src');
    textarea.spellcheck = false;
    textarea.setAttribute('autocomplete', 'off');
    textarea.setAttribute('autocorrect', 'off');
    textarea.setAttribute('autocapitalize', 'off');
    textarea.setAttribute('wrap', 'off');
    if (!textarea.getAttribute('aria-label')) textarea.setAttribute('aria-label', 'OMG source code');

    let lineCount = 0;

    function render() {
      const src = textarea.value;
      // A trailing newline needs something after it, or the highlighted copy
      // ends up one line shorter than the text being edited.
      hlInner.innerHTML = highlight(src) + (src.endsWith('\n') ? ' ' : '');
      const lines = src.split('\n').length;
      if (lines !== lineCount) {
        lineCount = lines;
        if (opts.auto) textarea.rows = lines;
        if (gutterInner) {
          let text = '';
          for (let i = 1; i <= lines; i++) text += i + '\n';
          gutterInner.textContent = text;
        }
      }
    }

    function syncScroll() {
      const x = textarea.scrollLeft;
      const y = textarea.scrollTop;
      hlInner.style.transform = 'translate(' + -x + 'px,' + -y + 'px)';
      if (gutterInner) gutterInner.style.transform = 'translateY(' + -y + 'px)';
    }

    textarea.addEventListener('input', () => {
      render();
      syncScroll();
      if (opts.onChange) opts.onChange(textarea.value);
    });
    textarea.addEventListener('scroll', syncScroll);

    // Tab indents, unless Escape was pressed first: that hands Tab back to
    // the browser so keyboard users can move on to the next control.
    let tabLeaves = false;
    textarea.addEventListener('blur', () => {
      tabLeaves = false;
    });
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (opts.onRun) opts.onRun();
        return;
      }
      if (e.key === 'Escape') {
        tabLeaves = true;
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const value = textarea.value;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;

      if (e.key === 'Tab' && !tabLeaves) {
        e.preventDefault();
        if (e.shiftKey) {
          const lead = /^ {1,4}/.exec(value.slice(lineStart));
          if (lead) {
            insertText(textarea, '', lineStart, lineStart + lead[0].length);
            const moved = Math.max(lineStart, start - lead[0].length);
            textarea.setSelectionRange(moved, moved);
          }
        } else {
          const col = start - lineStart;
          insertText(textarea, ' '.repeat(4 - (col % 4)));
        }
      } else if (e.key === 'Enter' && start === end) {
        e.preventDefault();
        const before = value.slice(lineStart, start);
        let indent = /^[ \t]*/.exec(before)[0];
        if (/\{\s*$/.test(before)) indent += '    ';
        insertText(textarea, '\n' + indent);
      } else if (e.key === '}' && start === end) {
        // Closing a block on an otherwise empty line steps the indent back.
        const before = value.slice(lineStart, start);
        if (/^ {4,}$/.test(before)) {
          e.preventDefault();
          insertText(textarea, '}', start - 4, start);
        }
      }
      if (e.key !== 'Shift') tabLeaves = false;
    });

    render();

    return {
      root,
      textarea,
      get value() {
        return textarea.value;
      },
      set value(text) {
        textarea.value = text;
        textarea.scrollTop = 0;
        textarea.scrollLeft = 0;
        render();
        syncScroll();
      },
      focus() {
        textarea.focus();
      },
    };
  }

  // =========================================================================
  // Running programs
  // =========================================================================

  const WORKER_URL = new URL('omg-worker.js', ASSETS);
  const STAGE_MARK = /___OMG_EXPLORER_STAGE___([a-z_]+)___OMG_EXPLORER_STAGE___\n?/;
  let nextId = 1;

  function spawn(onMessage) {
    const worker = new Worker(WORKER_URL);
    worker.onmessage = (event) => onMessage(event.data);
    return worker;
  }

  // --- The worker that runs programs. One program at a time; stopping it
  // --- means terminating the worker and starting a fresh one.

  let runWorker = null;
  let job = null;

  function ensureRunWorker() {
    if (!runWorker) {
      runWorker = spawn((message) => {
        if (!job || message.id !== job.id) return;
        if (message.type === 'start') {
          if (job.onStart) job.onStart();
          if (job.timeoutMs) job.timer = setTimeout(() => stop('timeout'), job.timeoutMs);
        } else if (message.type === 'out') {
          job.onOutput(message.text);
        } else if (message.type === 'done') {
          finish({ ok: message.ok, error: message.error, exitCode: message.exitCode, files: message.files, ms: message.ms, stopped: false });
        }
      });
      runWorker.onerror = (event) => {
        finish({ ok: false, error: 'The runner failed: ' + (event.message || 'unknown error'), exitCode: 1, files: {}, ms: 0, stopped: false });
      };
    }
    return runWorker;
  }

  function finish(result) {
    if (!job) return;
    const done = job;
    job = null;
    clearTimeout(done.timer);
    done.resolve(result);
  }

  /** Stops the running program, if there is one. */
  function stop(reason) {
    if (!job) return;
    if (runWorker) runWorker.terminate();
    runWorker = null;
    const seconds = Math.round((job.timeoutMs || 0) / 1000);
    finish({
      ok: false,
      stopped: true,
      error: reason === 'timeout' ? 'Stopped after ' + seconds + ' seconds. Open it in the playground to let it run for longer.' : '',
      exitCode: 130,
      files: {},
      ms: 0,
    });
    // Have the next run ready to go.
    preload('vm');
  }

  /**
   * Runs a program.
   *
   * options:
   *   source     the OMG source text
   *   engine     'vm' (default): compile to bytecode, run on the OMG VM
   *              'js': compile to JavaScript with OMG's JS backend, run that
   *   files      { path: text } for the in-memory file system
   *   onOutput   called with each chunk of output as it arrives
   *   onStart    called when the program begins (after any download)
   *   timeoutMs  stop the program after this long
   *
   * Resolves with { ok, error, exitCode, files, ms, stopped }.
   */
  function run(options) {
    stop('superseded');
    const id = nextId++;
    return new Promise((resolve) => {
      job = {
        id,
        resolve,
        onOutput: options.onOutput || (() => {}),
        onStart: options.onStart,
        timeoutMs: options.timeoutMs || 0,
        timer: null,
      };
      const worker = ensureRunWorker();
      if (options.engine === 'js') {
        explore(options.source, { files: options.files }).then((result) => {
          if (!job || job.id !== id) return;
          if (!result.ok) {
            finish({ ok: false, error: result.error, exitCode: 1, files: {}, ms: 0, stopped: false });
            return;
          }
          if (options.onStages) options.onStages(result);
          const js = result.stages.js.split('"<explorer>"').join('"<playground>"');
          worker.postMessage({ type: 'run-js', id, js, files: options.files });
        });
      } else {
        worker.postMessage({ type: 'run', id, source: options.source, files: options.files });
      }
    });
  }

  function isRunning() {
    return job !== null;
  }

  /** Downloads and compiles a bundle ahead of the first run. */
  function preload(kind) {
    if (kind === 'explorer') ensureInspector().postMessage({ type: 'load', id: 0, kind: 'explorer' });
    else ensureRunWorker().postMessage({ type: 'load', id: 0, kind: kind || 'vm' });
  }

  // --- The worker that inspects programs: every compiler stage, without
  // --- running the result. Kept apart from the runner so that looking at
  // --- the bytecode never waits behind a long-running program.

  let inspector = null;
  const inspections = new Map();
  const INSPECT_LIMIT_MS = 20000;

  function ensureInspector() {
    if (!inspector) {
      inspector = spawn((message) => {
        const pending = inspections.get(message.id);
        if (!pending) return;
        if (message.type === 'start') {
          pending.timer = setTimeout(() => {
            // Only a runaway program in the "run" stage gets here.
            inspector.terminate();
            inspector = null;
            for (const [key, other] of inspections) {
              inspections.delete(key);
              clearTimeout(other.timer);
              other.resolve(parseStages(other.text, { ok: false, error: 'Stopped: this took longer than ' + INSPECT_LIMIT_MS / 1000 + ' seconds.' }));
            }
          }, INSPECT_LIMIT_MS);
        } else if (message.type === 'out') {
          pending.text += message.text;
        } else if (message.type === 'done') {
          inspections.delete(message.id);
          clearTimeout(pending.timer);
          pending.resolve(parseStages(pending.text, message));
        }
      });
    }
    return inspector;
  }

  const STAGE_ERROR = /^(lex|parse|compile|C-gen|JS-gen) error: /;

  function cleanStageError(text) {
    return text
      .trim()
      .replace(/^(lex|parse|compile|C-gen|JS-gen) error: /, '')
      .replace(/^RuntimeError: (?=[A-Za-z]+Error: )/, '')
      .replace(/<explorer>/g, '<playground>');
  }

  function parseStages(text, done) {
    const parts = text.split(STAGE_MARK);
    const stages = {};
    for (let i = 1; i < parts.length; i += 2) stages[parts[i]] = parts[i + 1].replace(/\n$/, '');
    delete stages.end;

    // The first stage that failed explains everything after it.
    let error = '';
    for (const name of ['tokens', 'ast', 'bytecode', 'c', 'js']) {
      if (/^(lex|parse|compile|C-gen|JS-gen) error: /.test(stages[name] || '')) {
        error = cleanStageError(stages[name]);
        break;
      }
    }
    if (!error && stages.js === undefined) error = done.error || 'The compiler stopped unexpectedly.';
    if ('run' in stages && done.error) stages.run += (stages.run ? '\n' : '') + done.error;
    return { ok: error === '', error, stages };
  }

  /**
   * Compiles a program and reports every stage.
   *
   * options:
   *   files  { path: text } for imports
   *   run    also run it on the VM and report the output as stages.run
   *
   * Resolves with { ok, error, stages: { tokens, ast, bytecode, c, js, run? } }.
   */
  function explore(source, options) {
    const opts = options || {};
    const id = nextId++;
    return new Promise((resolve) => {
      inspections.set(id, { resolve, text: '', timer: null });
      ensureInspector().postMessage({ type: 'explore', id, source, files: opts.files, run: !!opts.run });
    });
  }

  // =========================================================================
  // Output
  // =========================================================================

  /**
   * An output area. Plain text is appended as it arrives. If the program
   * sends terminal escape codes (the spinning donut does), the area turns
   * into a small screen with a cursor, enough for "clear" and "move to the
   * top-left" to produce an animation.
   */
  function createTerminal(element) {
    let textNode = null;
    let screen = null; // { lines, row, col } once escape codes are seen
    let carry = ''; // an escape sequence split across two chunks
    let frame = 0;

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      element.textContent = '';
      element.classList.remove('is-term');
      textNode = null;
      screen = null;
      carry = '';
    }

    function paint() {
      frame = 0;
      if (screen) element.textContent = screen.lines.join('\n');
    }

    function put(text) {
      const s = screen;
      while (s.lines.length <= s.row) s.lines.push('');
      const line = s.lines[s.row];
      s.lines[s.row] = (line.length < s.col ? line.padEnd(s.col) : line.slice(0, s.col)) + text + line.slice(s.col + text.length);
      s.col += text.length;
    }

    function control(params, final) {
      const s = screen;
      const nums = params.replace(/^\?/, '').split(';').map((p) => parseInt(p, 10));
      const n = (index, fallback) => (Number.isFinite(nums[index]) ? nums[index] : fallback);
      if (final === 'H' || final === 'f') {
        s.row = Math.max(0, n(0, 1) - 1);
        s.col = Math.max(0, n(1, 1) - 1);
      } else if (final === 'J') {
        if (n(0, 0) >= 2) {
          s.lines = [];
          s.row = 0;
          s.col = 0;
        } else {
          s.lines.length = Math.min(s.lines.length, s.row + 1);
          if (s.lines[s.row] !== undefined) s.lines[s.row] = s.lines[s.row].slice(0, s.col);
        }
      } else if (final === 'K') {
        if (s.lines[s.row] !== undefined) s.lines[s.row] = s.lines[s.row].slice(0, s.col);
      } else if (final === 'A') s.row = Math.max(0, s.row - n(0, 1));
      else if (final === 'B') s.row += n(0, 1);
      else if (final === 'C') s.col += n(0, 1);
      else if (final === 'D') s.col = Math.max(0, s.col - n(0, 1));
      // Colours and everything else are ignored.
    }

    function writeScreen(text) {
      const s = screen;
      let i = 0;
      const n = text.length;
      while (i < n) {
        const ch = text[i];
        if (ch === '\x1b') {
          const match = /^\x1b\[([0-9;?]*)([A-Za-z])/.exec(text.slice(i, i + 24));
          if (match) {
            control(match[1], match[2]);
            i += match[0].length;
          } else if (n - i < 24 && /^\x1b(\[[0-9;?]*)?$/.test(text.slice(i))) {
            carry = text.slice(i);
            return;
          } else {
            i++;
          }
        } else if (ch === '\n') {
          s.row++;
          s.col = 0;
          i++;
        } else if (ch === '\r') {
          s.col = 0;
          i++;
        } else if (ch === '\b') {
          s.col = Math.max(0, s.col - 1);
          i++;
        } else {
          let j = i + 1;
          while (j < n && text[j] !== '\x1b' && text[j] !== '\n' && text[j] !== '\r' && text[j] !== '\b') j++;
          put(text.slice(i, j));
          i = j;
        }
      }
    }

    function write(text) {
      if (!screen && text.indexOf('\x1b') < 0) {
        const pinned = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
        if (!textNode) {
          textNode = document.createTextNode('');
          element.appendChild(textNode);
        }
        textNode.appendData(text);
        if (pinned) element.scrollTop = element.scrollHeight;
        return;
      }
      if (!screen) {
        const lines = element.textContent.split('\n');
        screen = { lines, row: lines.length - 1, col: lines[lines.length - 1].length };
        element.classList.add('is-term');
        textNode = null;
      }
      writeScreen(carry + text);
      if (!frame) frame = requestAnimationFrame(paint);
    }

    /** Adds a line set apart from the program's own output. */
    function note(text, className) {
      if (frame) {
        cancelAnimationFrame(frame);
        paint();
      }
      if (screen) {
        // Freeze the screen as it stands and carry on below it.
        screen = null;
      }
      const current = element.textContent;
      const span = document.createElement('span');
      span.className = className;
      span.textContent = (current !== '' && !current.endsWith('\n') ? '\n' : '') + text;
      element.appendChild(span);
      textNode = null;
      element.scrollTop = element.scrollHeight;
    }

    return { reset, write, note, element };
  }

  // =========================================================================
  // Share links
  // =========================================================================

  // The source travels in the URL fragment as "#code=<tag><base64url>", so a
  // link is self-contained and nothing is sent to a server. The tag says how
  // the source was packed:
  //   "2"   by omg-share.js, a compressor that already knows what OMG looks
  //         like. Links made today. A snippet from this site packs into a
  //         dozen characters, a fresh program into about half of "d1".
  //   "d1"  deflate. Older links, and the fallback if omg-share.js cannot be
  //         loaded.
  //   "b1"  plain UTF-8. Older links, and the last resort.
  // Every tag that was ever handed out still opens.

  function b64urlEncode(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(text) {
    let s = text.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function pipe(bytes, stream) {
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  }

  // omg-share.js is about 70 KB, most of it the text its model learns from,
  // so it is fetched only when a link is made or opened. Resolves to null if
  // it cannot be loaded.
  let packerLoading = null;
  function loadPacker() {
    if (!packerLoading) {
      packerLoading = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = new URL('omg-share.js', ASSETS).href;
        script.onload = () => {
          try {
            window.OMGShareCodec.warm();
            resolve(window.OMGShareCodec);
          } catch (e) {
            console.warn('Share links fall back to the older format:', e);
            resolve(null);
          }
        };
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
      });
    }
    return packerLoading;
  }

  function sameBytes(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // Packs the source every way this browser can and keeps the shortest.
  async function encodeShare(source) {
    const bytes = new TextEncoder().encode(source);
    let best = 'b1' + b64urlEncode(bytes);
    const consider = (payload) => {
      if (payload.length < best.length) best = payload;
    };

    const packer = await loadPacker();
    if (packer) {
      try {
        const packed = packer.pack(bytes);
        // A link that opens as the wrong program is worse than a long one,
        // so the packed form only counts once it has been unpacked again.
        if (sameBytes(packer.unpack(packed), bytes)) consider('2' + b64urlEncode(packed));
      } catch (_) {
        /* too long for the packer, or something is off: use the others */
      }
    }
    // Deflate only wins on text that looks nothing like OMG, and plain only
    // on text that does not compress at all, but both are cheap to try.
    if (typeof CompressionStream !== 'undefined') {
      try {
        consider('d1' + b64urlEncode(await pipe(bytes, new CompressionStream('deflate-raw'))));
      } catch (_) {
        /* keep what we have */
      }
    }
    return best;
  }

  async function decodeShare(payload) {
    if (payload[0] === '2') {
      const packer = await loadPacker();
      if (!packer) throw new Error('could not load omg-share.js');
      return new TextDecoder().decode(packer.unpack(b64urlDecode(payload.slice(1))));
    }
    const tag = payload.slice(0, 2);
    const bytes = b64urlDecode(payload.slice(2));
    if (tag === 'd1') return new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
    if (tag === 'b1') return new TextDecoder().decode(bytes);
    throw new Error('unknown share format: ' + tag);
  }

  async function readSharedSource() {
    const match = /(?:^|[#&])code=([A-Za-z0-9_-]+)/.exec(location.hash || '');
    if (!match) return null;
    try {
      return await decodeShare(match[1]);
    } catch (e) {
      console.warn('Could not read the shared program:', e);
      return null;
    }
  }

  async function playgroundURL(source, engine) {
    const url = new URL('playground/', ROOT);
    url.hash = 'code=' + (await encodeShare(source)) + (engine === 'js' ? '&engine=js' : '');
    return url.href;
  }

  function toast(message, kind) {
    let host = document.getElementById('omg-toast');
    if (!host) {
      host = document.createElement('div');
      host.id = 'omg-toast';
      host.className = 'toast';
      host.setAttribute('role', 'status');
      document.body.appendChild(host);
    }
    host.textContent = message;
    host.classList.toggle('is-error', kind === 'error');
    host.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => host.classList.remove('is-visible'), 2400);
  }

  // =========================================================================
  // Page furniture
  // =========================================================================

  const ICON_PLAY = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.6 10.4 6 3 10.4Z" fill="currentColor"/></svg>';
  const ICON_STOP = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" rx="1.2" fill="currentColor"/></svg>';

  /** Files declared on the page with <pre data-omg-file="name">, for imports. */
  function pageFiles() {
    const files = {};
    for (const el of document.querySelectorAll('[data-omg-file]')) files[el.getAttribute('data-omg-file')] = el.textContent;
    return files;
  }

  function formatMs(ms) {
    return ms < 1000 ? Math.max(1, Math.round(ms)) + ' ms' : (ms / 1000).toFixed(2) + ' s';
  }

  // --- Runnable snippets: <div class="snippet"><textarea>…</textarea></div>
  //
  //   data-file      name shown in the bar (default: main.omg)
  //   data-engine    "js" to run through the JavaScript backend
  //   data-autorun   run once when the snippet first scrolls into view
  //   data-timeout   seconds before a run is stopped (default: 10)

  let activeSnippet = null;

  function initSnippet(box) {
    const textarea = box.querySelector('textarea');
    if (!textarea) return;
    const original = textarea.value.replace(/\s+$/, '');
    textarea.value = original;
    const engine = box.getAttribute('data-engine') === 'js' ? 'js' : 'vm';
    const timeoutMs = (parseFloat(box.getAttribute('data-timeout')) || 10) * 1000;

    const bar = document.createElement('div');
    bar.className = 'snippet-bar';

    const file = document.createElement('span');
    file.className = 'snippet-file';
    file.textContent = box.getAttribute('data-file') || 'main.omg';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'snippet-link';
    resetBtn.textContent = 'Reset';
    resetBtn.hidden = true;

    const open = document.createElement('a');
    open.className = 'snippet-link';
    open.href = new URL('playground/', ROOT).href;
    open.textContent = 'Open in playground';

    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'btn btn-primary btn-sm';

    bar.append(file, resetBtn, open, runBtn);

    const out = document.createElement('pre');
    out.className = 'snippet-out';
    out.hidden = true;
    out.setAttribute('aria-live', 'polite');
    const label = document.createElement('span');
    label.className = 'out-label';
    label.textContent = 'Output';
    const body = document.createElement('span');
    out.append(label, body);

    let running = false;
    const setRunning = (on) => {
      running = on;
      runBtn.innerHTML = on ? ICON_STOP + ' Stop' : ICON_PLAY + ' Run';
      runBtn.title = on ? 'Stop the program' : 'Run (Ctrl+Enter)';
    };
    setRunning(false);

    // The terminal writes into `body`, but the element that scrolls is `out`.
    const term = createTerminal(body);

    async function go() {
      if (running) {
        stop('user');
        return;
      }
      activeSnippet = box;
      setRunning(true);
      out.hidden = false;
      term.reset();
      label.textContent = 'Output';
      let wrote = false;
      const result = await run({
        source: editor.value,
        engine,
        files: pageFiles(),
        timeoutMs,
        onOutput: (text) => {
          wrote = true;
          term.write(text);
          out.scrollTop = out.scrollHeight;
        },
      });
      setRunning(false);
      if (result.error) term.note(result.error, 'out-err');
      else if (result.stopped) term.note('Stopped.', 'out-note');
      else if (!wrote) term.note('(no output)', 'out-note');
      if (!result.stopped) label.textContent = 'Output · ' + formatMs(result.ms);
    }

    const editor = createEditor(textarea, {
      auto: true,
      onRun: go,
      onChange: (value) => {
        resetBtn.hidden = value === original;
      },
    });

    runBtn.addEventListener('click', go);
    resetBtn.addEventListener('click', () => {
      editor.value = original;
      resetBtn.hidden = true;
      editor.focus();
    });
    open.addEventListener('click', async (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      location.href = await playgroundURL(editor.value, engine);
    });

    box.append(bar, out);

    if (box.hasAttribute('data-autorun') && 'IntersectionObserver' in window) {
      const seen = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          seen.disconnect();
          if (!isRunning()) go();
        }
      });
      seen.observe(box);
    }
  }

  // --- Labs: an editor with one or more compiler stages shown beneath it,
  // --- updated as you type.
  //
  //   <div class="lab" data-stages="tokens,ast"><textarea>…</textarea></div>

  const STAGE_NAMES = {
    tokens: 'Tokens',
    ast: 'Syntax tree',
    bytecode: 'Bytecode',
    c: 'C',
    js: 'JavaScript',
    run: 'Output',
  };

  function initLab(box) {
    const textarea = box.querySelector('textarea');
    if (!textarea) return;
    textarea.value = textarea.value.replace(/\s+$/, '');
    const stages = (box.getAttribute('data-stages') || 'tokens').split(',').map((s) => s.trim());
    const wantsRun = stages.includes('run');
    let current = stages[0];
    let latest = null;
    let ticket = 0;

    const head = document.createElement('div');
    head.className = 'lab-head';
    head.innerHTML = '<span>edit me</span><span class="live"><span class="dot"></span><span class="live-text">waiting</span></span>';
    const dot = head.querySelector('.dot');
    const liveText = head.querySelector('.live-text');
    box.insertBefore(head, textarea);

    const tabs = document.createElement('div');
    tabs.className = 'lab-tabs';
    tabs.setAttribute('role', 'tablist');
    const buttons = {};
    for (const name of stages) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab';
      button.setAttribute('role', 'tab');
      button.textContent = STAGE_NAMES[name] || name;
      button.addEventListener('click', () => {
        current = name;
        show();
      });
      buttons[name] = button;
      tabs.appendChild(button);
    }

    const out = document.createElement('pre');
    out.className = 'lab-out';
    out.setAttribute('role', 'tabpanel');
    out.tabIndex = 0;

    function show() {
      for (const name of stages) buttons[name].setAttribute('aria-selected', name === current ? 'true' : 'false');
      out.classList.toggle('is-wrap', current === 'run');
      if (!latest) {
        out.textContent = '';
        return;
      }
      const text = latest.stages[current];
      if (text === undefined || /^\(skipped/.test(text)) out.textContent = latest.error || '(nothing to show)';
      else if (STAGE_ERROR.test(text)) out.textContent = cleanStageError(text);
      else out.textContent = text.replace(/<explorer>/g, '<playground>') || (current === 'run' ? '(no output)' : '');
      out.scrollTop = 0;
    }

    async function refresh() {
      const mine = ++ticket;
      dot.className = 'dot is-busy';
      liveText.textContent = 'compiling';
      const result = await explore(editor.value, { files: pageFiles(), run: wantsRun });
      if (mine !== ticket) return;
      latest = result;
      // Judge only the stages this lab shows: a lab of tokens is fine with
      // source the parser would go on to reject.
      const failed = stages.some((name) => {
        const text = result.stages[name];
        return text === undefined || /^\(skipped|^(lex|parse|compile|C-gen|JS-gen) error: /.test(text);
      });
      dot.className = 'dot ' + (failed ? 'is-err' : 'is-ok');
      liveText.textContent = failed ? 'error' : 'live';
      show();
    }

    let timer = 0;
    const editor = createEditor(textarea, {
      auto: true,
      onChange: () => {
        clearTimeout(timer);
        timer = setTimeout(refresh, 250);
      },
    });

    box.append(tabs, out);
    show();

    // Compile the first time the lab comes near the viewport, so a page of
    // labs does not download the compiler until one is about to be read.
    if ('IntersectionObserver' in window) {
      const seen = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            seen.disconnect();
            refresh();
          }
        },
        { rootMargin: '300px' },
      );
      seen.observe(box);
    } else {
      refresh();
    }
  }

  // --- Contents list on the long pages: marks the section being read and
  // --- drives the drop-down that replaces the list on narrow screens.

  function initToc() {
    const toc = document.querySelector('.toc');
    if (!toc) return;
    const links = [...toc.querySelectorAll('ol a')];
    const sections = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    const select = toc.querySelector('.toc-select');

    if (select) {
      for (const a of links) {
        const option = document.createElement('option');
        option.value = a.getAttribute('href');
        option.textContent = a.textContent;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        location.hash = select.value;
      });
    }

    let ticking = false;
    function mark() {
      ticking = false;
      const line = window.scrollY + 120;
      let index = 0;
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].offsetTop <= line) index = i;
      }
      // At the very bottom the last section may be too short to reach the line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) index = sections.length - 1;
      links.forEach((a, i) => a.classList.toggle('is-current', i === index));
      if (select && document.activeElement !== select) select.selectedIndex = index;
    }
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(mark);
        }
      },
      { passive: true },
    );
    mark();
  }

  function init() {
    initTheme();
    for (const el of document.querySelectorAll('pre[data-omg], [data-omg-file$=".omg"]')) el.innerHTML = highlight(el.textContent.replace(/\n$/, ''));
    for (const box of document.querySelectorAll('.snippet')) initSnippet(box);
    for (const box of document.querySelectorAll('.lab')) initLab(box);
    initToc();
  }

  window.OMG = {
    ASSETS,
    ROOT,
    highlight,
    escapeHTML,
    createEditor,
    createTerminal,
    run,
    stop,
    isRunning,
    preload,
    explore,
    cleanStageError,
    formatMs,
    toast,
    icons: { play: ICON_PLAY, stop: ICON_STOP },
    share: { encode: encodeShare, decode: decodeShare, read: readSharedSource, playgroundURL, warm: loadPacker },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
