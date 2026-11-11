// The playground page: an editor on the left, and on the right the program's
// output plus every stage of the compiler for the same source.
//
// Depends on site.js (the OMG global).

(function () {
  'use strict';

  const OMG = window.OMG;
  const EXAMPLES_URL = new URL('examples/', OMG.ROOT);

  // =========================================================================
  // Examples
  // =========================================================================

  // Short programs kept inline, so there is always something to run even if
  // the examples folder cannot be fetched.
  const STARTERS = [
    {
      name: 'Hello, world',
      source: `;;;omg

emit "Hello, world!"
`,
    },
    {
      name: 'FizzBuzz',
      source: `;;;omg

# Count to 20. Multiples of 3 say Fizz, multiples of 5 say Buzz,
# and multiples of both say FizzBuzz.

alloc i := 1
loop i <= 20 {
    if i % 15 == 0 {
        emit "FizzBuzz"
    } elif i % 3 == 0 {
        emit "Fizz"
    } elif i % 5 == 0 {
        emit "Buzz"
    } else {
        emit i
    }
    i := i + 1
}
`,
    },
    {
      name: 'Fibonacci',
      source: `;;;omg

proc fib(n) {
    if n < 2 { return n }
    return fib(n - 1) + fib(n - 2)
}

alloc i := 0
loop i < 15 {
    emit "fib(" + i + ") = " + fib(i)
    i := i + 1
}
`,
    },
    {
      name: 'Closures',
      source: `;;;omg

# Each call to make_counter returns a tick function with its own n.
proc make_counter() {
    alloc n := 0
    proc tick() {
        n := n + 1
        return n
    }
    return tick
}

alloc a := make_counter()
alloc b := make_counter()

emit a()        # 1
emit a()        # 2
emit b()        # 1
emit a()        # 3
`,
    },
    {
      name: 'Word count',
      source: `;;;omg

# Count how often each word appears, using a dictionary.

alloc text := "the quick brown fox jumps over the lazy dog the end"

proc split_words(s) {
    alloc words := []
    alloc word := ""
    alloc i := 0
    loop i < length(s) {
        if s[i] == " " {
            if word != "" { words := words + [word] }
            word := ""
        } else {
            word := word + s[i]
        }
        i := i + 1
    }
    if word != "" { words := words + [word] }
    return words
}

alloc counts := {}
alloc words := split_words(text)
alloc i := 0
loop i < length(words) {
    alloc w := words[i]
    if has_key(counts, w) {
        counts[w] := counts[w] + 1
    } else {
        counts[w] := 1
    }
    i := i + 1
}

alloc keys := dict_keys(counts)
alloc k := 0
loop k < length(keys) {
    emit keys[k] + ": " + counts[keys[k]]
    k := k + 1
}
`,
    },
  ];

  // Programs from the examples folder of the OMG repository.
  const LIBRARY = [
    ['Language features', [
      ['assignment', 'Variables and scope'],
      ['bitwise', 'Bitwise operators'],
      ['floats', "Floats: Newton's square root"],
      ['dictionaries', 'Dictionaries'],
      ['higher_order', 'Functions as values'],
      ['import_modules', 'Importing a module'],
    ]],
    ['Algorithms', [
      ['prime_sieve', 'Prime sieve'],
      ['merge_sort', 'Merge sort'],
      ['maze_solver', 'Maze solver (breadth-first search)'],
      ['matrix_ops', 'Matrix multiplication'],
      ['hex_to_rgb', 'Hex colour to RGB'],
      ['permissions', 'Unix permission bits'],
      ['rot_13', 'ROT13 cipher'],
      ['tabula_recta', 'Tabula recta'],
    ]],
    ['Bigger programs', [
      ['stack_vm', 'A stack machine'],
      ['stack_vm_and_asm', 'A stack machine with an assembler'],
      ['donut', 'Spinning donut (animation)', 'js'],
    ]],
  ];

  // =========================================================================
  // Elements and state
  // =========================================================================

  const $ = (id) => document.getElementById(id);
  const $select = $('example');
  const $run = $('run');
  const $share = $('share');
  const $sourceMeta = $('sourceMeta');
  const $output = $('pane-output');
  const $stage = $('pane-stage');
  const $ref = $('pane-ref');
  const $statusDot = $('statusDot');
  const $statusLabel = $('statusLabel');
  const $statusDetail = $('statusDetail');
  const $engineNote = $('engineNote');
  const tabs = [...document.querySelectorAll('#tabs .tab')];
  const engineButtons = [...document.querySelectorAll('.seg [data-engine]')];

  const SOURCE_KEY = 'omg-source-v1';
  const SELECTION_KEY = 'omg-selection-v1';
  const ENGINE_KEY = 'omg-engine-v1';
  const STAGE_TABS = ['tokens', 'ast', 'bytecode', 'c', 'js'];

  const store = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (_) {
        return null;
      }
    },
    set(key, value) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch (_) {
        /* private mode or full: carry on without saving */
      }
    },
  };

  let engine = 'vm';
  let tab = 'output';
  let running = false;
  let stages = null; // the last explore() result
  let stagesFor = null; // the source it was made from
  let exploreTicket = 0;

  // Files every run can see: the module that the import example uses.
  const files = {};
  const filesReady = fetch(new URL('modules/math.omg', EXAMPLES_URL))
    .then((response) => (response.ok ? response.text() : Promise.reject(new Error('HTTP ' + response.status))))
    .then((text) => {
      files['modules/math.omg'] = text;
    })
    .catch(() => {
      /* imports of it will fail with a clear message from the compiler */
    });

  const terminal = OMG.createTerminal($output);

  // =========================================================================
  // Status bar
  // =========================================================================

  function setStatus(state, label, detail) {
    $statusDot.className = 'dot' + (state ? ' is-' + state : '');
    $statusLabel.textContent = label;
    $statusDetail.textContent = detail || '';
  }

  function setRunning(on) {
    running = on;
    $run.innerHTML = on ? OMG.icons.stop + ' Stop' : OMG.icons.play + ' Run';
    $run.title = on ? 'Stop the program' : 'Run (Ctrl+Enter)';
  }

  function setEngine(next, remember) {
    engine = next === 'js' ? 'js' : 'vm';
    for (const button of engineButtons) button.setAttribute('aria-pressed', button.dataset.engine === engine ? 'true' : 'false');
    $engineNote.textContent = engine === 'js' ? 'engine: compiled to JavaScript' : 'engine: bytecode on the OMG VM';
    if (remember) store.set(ENGINE_KEY, engine);
  }

  // =========================================================================
  // Editor
  // =========================================================================

  function updateMeta(source) {
    const lines = source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
    $sourceMeta.textContent = lines + (lines === 1 ? ' line' : ' lines');
  }

  let exploreTimer = 0;
  const editor = OMG.createEditor($('source'), {
    gutter: true,
    onRun: run,
    onChange: (source) => {
      store.set(SOURCE_KEY, source);
      updateMeta(source);
      // A share link in the address bar describes the program as it was. Once
      // it is edited, drop the link so that a reload keeps the edits.
      if (location.hash.includes('code=')) history.replaceState(null, '', location.pathname + location.search);
      // Typing means the editor no longer shows the chosen example.
      if ($select.value !== '') {
        $select.value = '';
        store.set(SELECTION_KEY, null);
      }
      if (STAGE_TABS.includes(tab)) {
        clearTimeout(exploreTimer);
        exploreTimer = setTimeout(showStage, 350);
      }
    },
  });

  function setSource(source) {
    editor.value = source;
    store.set(SOURCE_KEY, source);
    updateMeta(source);
  }

  // =========================================================================
  // Running
  // =========================================================================

  async function run() {
    if (running) {
      OMG.stop('user');
      return;
    }
    await filesReady;
    selectTab('output');
    terminal.reset();
    setRunning(true);
    setStatus('busy', engine === 'js' ? 'compiling' : 'running', '');
    let wrote = false;

    const result = await OMG.run({
      source: editor.value,
      engine,
      files,
      onStart: () => setStatus('busy', 'running', ''),
      onStages: (found) => {
        stages = found;
        stagesFor = editor.value;
      },
      onOutput: (text) => {
        wrote = true;
        terminal.write(text);
      },
    });

    setRunning(false);
    if (result.stopped) {
      terminal.note('Stopped.', 'out-note');
      setStatus('', 'stopped', '');
    } else if (result.error) {
      terminal.note(result.error, 'out-err');
      setStatus('err', 'failed', OMG.formatMs(result.ms));
    } else {
      if (!wrote) terminal.note('(no output)', 'out-note');
      setStatus('ok', 'done', OMG.formatMs(result.ms));
    }
  }

  // =========================================================================
  // Tabs and compiler stages
  // =========================================================================

  function selectTab(name) {
    tab = name;
    for (const button of tabs) button.setAttribute('aria-selected', button.dataset.tab === name ? 'true' : 'false');
    $output.hidden = name !== 'output';
    $ref.hidden = name !== 'ref';
    $stage.hidden = !STAGE_TABS.includes(name);
    if (STAGE_TABS.includes(name)) showStage();
  }

  function paintStage() {
    const text = stages.stages[tab];
    if (text === undefined || /^\(skipped/.test(text)) {
      $stage.textContent = stages.error || '(nothing to show)';
      $stage.classList.add('out-err');
    } else {
      const failed = /^(lex|parse|compile|C-gen|JS-gen) error: /.test(text);
      $stage.textContent = failed ? OMG.cleanStageError(text) : text.split('<explorer>').join('<playground>');
      $stage.classList.toggle('out-err', failed);
    }
  }

  async function showStage() {
    const source = editor.value;
    if (stages && stagesFor === source) {
      paintStage();
      return;
    }
    const mine = ++exploreTicket;
    await filesReady;
    const found = await OMG.explore(source, { files });
    if (mine !== exploreTicket) return;
    stages = found;
    stagesFor = source;
    if (STAGE_TABS.includes(tab)) {
      const keep = $stage.scrollTop;
      paintStage();
      $stage.scrollTop = keep;
    }
  }

  // =========================================================================
  // Examples menu
  // =========================================================================

  function buildMenu() {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Examples…';
    $select.appendChild(placeholder);

    const starters = document.createElement('optgroup');
    starters.label = 'Start here';
    STARTERS.forEach((starter, index) => {
      const option = document.createElement('option');
      option.value = 'starter:' + index;
      option.textContent = starter.name;
      starters.appendChild(option);
    });
    $select.appendChild(starters);

    for (const [label, items] of LIBRARY) {
      const group = document.createElement('optgroup');
      group.label = label;
      for (const [file, name, wantsEngine] of items) {
        const option = document.createElement('option');
        option.value = 'example:' + file;
        option.textContent = name;
        if (wantsEngine) option.dataset.engine = wantsEngine;
        group.appendChild(option);
      }
      $select.appendChild(group);
    }
  }

  async function loadSelection(value) {
    let source;
    if (value.startsWith('starter:')) {
      source = STARTERS[Number(value.slice(8))].source;
    } else if (value.startsWith('example:')) {
      const name = value.slice(8);
      try {
        const response = await fetch(new URL(encodeURIComponent(name) + '.omg', EXAMPLES_URL));
        if (!response.ok) throw new Error('HTTP ' + response.status);
        source = await response.text();
      } catch (e) {
        OMG.toast('Could not load that example: ' + e.message, 'error');
        return;
      }
    } else {
      return;
    }
    const option = $select.selectedOptions[0];
    // An example that needs the fast engine switches to it. Every other
    // example goes back to the VM, without changing the saved preference.
    setEngine(option && option.dataset.engine ? option.dataset.engine : store.get(ENGINE_KEY) || 'vm', false);
    if (running) OMG.stop('user');
    setSource(source);
    $select.value = value;
    store.set(SELECTION_KEY, value);
    run();
  }

  // =========================================================================
  // Wiring
  // =========================================================================

  buildMenu();
  setRunning(false);
  setEngine(store.get(ENGINE_KEY) || 'vm', false);

  $select.addEventListener('change', () => loadSelection($select.value));
  $run.addEventListener('click', run);
  for (const button of tabs) button.addEventListener('click', () => selectTab(button.dataset.tab));
  for (const button of engineButtons) {
    button.addEventListener('click', () => {
      setEngine(button.dataset.engine, true);
      if (!running) run();
    });
  }

  $share.addEventListener('click', async () => {
    const url = new URL(location.href);
    url.hash = 'code=' + (await OMG.share.encode(editor.value)) + (engine === 'js' ? '&engine=js' : '');
    // The address bar gets the link either way, so it can be copied by hand
    // where the page is not allowed to write to the clipboard.
    history.replaceState(null, '', url.href);
    try {
      await navigator.clipboard.writeText(url.href);
      OMG.toast('Link copied');
    } catch (_) {
      OMG.toast('The link is in the address bar');
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && e.target !== editor.textarea) {
      e.preventDefault();
      run();
    }
  });

  // What to open with: a shared link wins, then whatever was here last time,
  // then the first starter.
  (async function start() {
    setStatus('busy', 'loading', 'the OMG compiler');
    OMG.preload('vm');

    const shared = await OMG.share.read();
    const saved = store.get(SOURCE_KEY);
    if (shared !== null) {
      setSource(shared);
      store.set(SELECTION_KEY, null);
      if (/[#&]engine=js(&|$)/.test(location.hash)) setEngine('js', false);
    } else if (saved !== null && saved.trim() !== '') {
      editor.value = saved;
      updateMeta(saved);
      const selection = store.get(SELECTION_KEY);
      if (selection && [...$select.options].some((option) => option.value === selection)) {
        $select.value = selection;
        const option = $select.selectedOptions[0];
        if (option.dataset.engine) setEngine(option.dataset.engine, false);
      }
    } else {
      setSource(STARTERS[0].source);
      $select.value = 'starter:0';
    }
    run();
  })();
})();
