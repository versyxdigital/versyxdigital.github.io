// OMG share links, format 2: a small text compressor that already knows OMG.
//
// A share link carries the whole program in the address, so the shorter the
// program packs, the shorter the link. General-purpose compression (the old
// "d1" links used deflate) does poorly on a short program, because it has to
// learn what OMG looks like from the program itself, and a twenty-line
// program is over before it has learned much.
//
// This one starts out having already read about 55 KB of OMG: the examples,
// the language tour and every snippet on this site (the PRIMER at the bottom
// of this file). It then guesses the program one bit at a time, and only the
// surprises cost anything. A program straight from the site packs into a few
// characters; a fresh one comes out at about half the size deflate gave.
//
// How it works, briefly:
//   - Several small models each guess the next bit from a different view of
//     what came before: the last 1, 2, 3, 4 and 6 characters, the word being
//     typed, and the longest earlier place where the same text appeared.
//   - A mixer adds the guesses up, trusting each model as much as it has
//     earned, and learns from every bit.
//   - An arithmetic coder turns "how surprising was that bit" into output.
// Packing and unpacking run the very same model over the very same text, so
// they always agree. Everything is whole-number arithmetic, which behaves
// identically in every browser.
//
// THE FORMAT IS FROZEN. A link only opens if this file guesses exactly as it
// did when the link was made. Changing the PRIMER by one character, or any
// number or formula in the model, breaks every format 2 link ever shared.
// To improve it, add a new format with a new tag next to this one, the way
// this file sits next to "d1" and "b1" in site.js. PRIMER_CHECK guards
// against accidents: if the text no longer matches, the packer turns itself
// off and site.js falls back to the old format.
//
// Used by site.js, which loads it the first time a link is made or opened.
// Under Node it exports the same object, for testing.

(function () {
  'use strict';

  // =========================================================================
  // The model
  // =========================================================================

  const ORDERS = [1, 2, 3, 4, 6]; // how many characters back each context model looks
  const SLOTS = ORDERS.length + 2; // plus one with no context and one for the current word
  const INPUTS = SLOTS + 1; // plus the match model
  const BITS = 18; // each context model has 2^18 counters
  const SIZE = 1 << BITS;
  const COUNT_LIMIT = 20; // a counter stops slowing down after this many updates
  const MIX_RATE = 16; // how fast the mixer learns
  const MATCH_MIN = 3; // the shortest repeat the match model follows
  const MATCH_BITS = 16;
  const MAX_BYTES = 1 << 18; // longest program a link may carry

  // stretch(p) = ln(p / (1 - p)) and squash, its inverse, as lookup tables
  // over 12-bit probabilities. The mixer works in the stretched domain.
  const SQUASH_KNOTS = [
    1, 2, 3, 6, 10, 16, 27, 45, 73, 120, 194, 310, 488, 747, 1101, 1546, 2047, 2549, 2994, 3348, 3607, 3785, 3901,
    3975, 4022, 4050, 4068, 4079, 4085, 4089, 4092, 4093, 4094,
  ];

  function squash(x) {
    if (x > 2047) return 4095;
    if (x < -2047) return 1;
    const part = x & 127;
    const knot = (x >> 7) + 16;
    return (SQUASH_KNOTS[knot] * (128 - part) + SQUASH_KNOTS[knot + 1] * part + 64) >> 7;
  }

  const STRETCH = new Int16Array(4096);
  for (let x = -2047, filled = 0; x <= 2047; x++) {
    const p = squash(x);
    while (filled <= p) STRETCH[filled++] = x;
    if (x === 2047) while (filled < 4096) STRETCH[filled++] = 2047;
  }

  // A counter moves towards each bit it sees by 1 / (times seen + 1.5).
  const STEP = new Int32Array(COUNT_LIMIT + 1);
  for (let n = 0; n <= COUNT_LIMIT; n++) STEP[n] = Math.floor(65536 / (n + 1.5));
  const MATCH_STEP = new Int32Array(256);
  for (let n = 0; n < 256; n++) MATCH_STEP[n] = Math.floor(65536 / (n + 1.5));

  function newModel() {
    return {
      prob: new Uint16Array(SLOTS * SIZE).fill(32768), // chance of a 1, out of 65536
      seen: new Uint8Array(SLOTS * SIZE),
      weights: new Int32Array(3 * 256 * INPUTS).fill(16000), // 65536 means 1.0
      text: new Uint8Array(1 << 16), // every byte read so far
      length: 0,
      partial: 1, // the bits of the current byte, behind a leading 1
      hashes: new Int32Array(SLOTS),
      slots: new Int32Array(SLOTS),
      inputs: new Int32Array(INPUTS),
      weightsAt: 0,
      guess: 2048, // the last prediction, out of 4096
      wordHash: 0,
      matchTable: new Int32Array(1 << MATCH_BITS), // hash of 3 bytes -> where they last ended
      matchAt: 0, // where in the text the match continues
      matchLength: 0,
      matchProb: new Uint16Array(64).fill(32768), // by match length and predicted bit
      matchSeen: new Uint8Array(64),
      matchSlot: -1,
    };
  }

  function copyModel(m) {
    const copy = Object.assign({}, m);
    for (const key in copy) if (ArrayBuffer.isView(copy[key])) copy[key] = copy[key].slice();
    return copy;
  }

  // Called at each byte boundary: work out the contexts for the next byte.
  function startByte(m) {
    const text = m.text;
    const n = m.length;
    m.partial = 1;
    m.hashes[0] = 0;

    for (let i = 0; i < ORDERS.length; i++) {
      const order = ORDERS[i];
      let h = Math.imul(order + 1, 0x9e3779b1);
      for (let k = 1; k <= order; k++) h = (Math.imul(h ^ (n >= k ? text[n - k] : 0), 0x2545f491) + k) | 0;
      m.hashes[i + 1] = h;
    }

    // The word so far, or the character before it when there is none.
    const last = n ? text[n - 1] : 0;
    const inWord = (last >= 48 && last <= 57) || (last >= 65 && last <= 90) || (last >= 97 && last <= 122) || last === 95;
    m.wordHash = inWord ? (Math.imul(m.wordHash ^ last, 0x2545f491) + 7) | 0 : 0;
    m.hashes[SLOTS - 1] = (Math.imul(m.wordHash ^ 0x51ed270b, 0x9e3779b1) + (inWord ? 0 : last)) | 0;

    // The match model: if the bytes just read also appeared earlier, expect
    // what followed them then.
    if (m.matchLength > 0 && text[m.matchAt] === last) {
      m.matchLength++;
      m.matchAt++;
    } else {
      m.matchLength = 0;
    }
    if (n >= MATCH_MIN) {
      let h = 0;
      for (let k = 1; k <= MATCH_MIN; k++) h = (Math.imul(h ^ text[n - k], 0x2545f491) + k) | 0;
      const slot = h >>> (32 - MATCH_BITS);
      if (m.matchLength === 0) {
        const candidate = m.matchTable[slot];
        if (candidate > 0) {
          let same = 0;
          while (same < 32 && same < candidate && text[candidate - 1 - same] === text[n - 1 - same]) same++;
          if (same >= MATCH_MIN) {
            m.matchLength = same;
            m.matchAt = candidate;
          }
        }
      }
      m.matchTable[slot] = n;
    }
  }

  // The chance that the next bit is a 1, out of 4096.
  function predict(m) {
    const partial = m.partial;
    const confidence = m.matchLength === 0 ? 0 : m.matchLength < 16 ? 1 : 2;
    const weightsAt = (confidence * 256 + partial) * INPUTS;
    m.weightsAt = weightsAt;
    let sum = 0;

    for (let i = 0; i < SLOTS; i++) {
      const slot =
        i * SIZE + (i === 0 ? partial : Math.imul(m.hashes[i] ^ Math.imul(partial, 0x9e3779b1), 0x85ebca6b) >>> (32 - BITS));
      const input = STRETCH[m.prob[slot] >> 4];
      m.slots[i] = slot;
      m.inputs[i] = input;
      sum += m.weights[weightsAt + i] * input;
    }

    let input = 0;
    m.matchSlot = -1;
    if (m.matchLength > 0) {
      const expected = m.text[m.matchAt] | 256;
      const bitsDone = 31 - Math.clz32(partial);
      if (expected >> (8 - bitsDone) === partial) {
        const bit = (expected >> (7 - bitsDone)) & 1;
        m.matchSlot = (m.matchLength > 31 ? 31 : m.matchLength) * 2 + bit;
        input = STRETCH[m.matchProb[m.matchSlot] >> 4];
      } else {
        m.matchLength = 0; // the match just mispredicted; drop it
      }
    }
    m.inputs[SLOTS] = input;
    sum += m.weights[weightsAt + SLOTS] * input;

    m.guess = squash(Math.floor(sum / 65536));
    return m.guess;
  }

  // Learn from the bit that actually came.
  function update(m, bit) {
    const error = ((bit << 12) - m.guess) * MIX_RATE;
    for (let i = 0; i < INPUTS; i++) m.weights[m.weightsAt + i] += (m.inputs[i] * error + 0x8000) >> 16;

    const target = bit ? 65535 : 0;
    for (let i = 0; i < SLOTS; i++) {
      const slot = m.slots[i];
      const n = m.seen[slot];
      m.prob[slot] += (((target - m.prob[slot]) * STEP[n]) / 65536) | 0;
      if (n < COUNT_LIMIT) m.seen[slot] = n + 1;
    }
    if (m.matchSlot >= 0) {
      const slot = m.matchSlot;
      const n = m.matchSeen[slot];
      m.matchProb[slot] += (((target - m.matchProb[slot]) * MATCH_STEP[n]) / 65536) | 0;
      if (n < 255) m.matchSeen[slot] = n + 1;
    }

    m.partial = (m.partial << 1) | bit;
    if (m.partial >= 256) {
      if (m.length === m.text.length) {
        const grown = new Uint8Array(m.length * 2);
        grown.set(m.text);
        m.text = grown;
      }
      m.text[m.length++] = m.partial & 255;
      startByte(m);
    }
  }

  // =========================================================================
  // The primed model
  // =========================================================================

  // FNV-1a, to notice a PRIMER that is no longer the one links were made with.
  function checksum(bytes) {
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193);
    return h >>> 0;
  }

  let primed = null;

  function primedModel() {
    if (!primed) {
      const bytes = new Uint8Array(PRIMER.length);
      for (let i = 0; i < bytes.length; i++) bytes[i] = PRIMER.charCodeAt(i) & 255;
      if (checksum(bytes) !== PRIMER_CHECK) throw new Error('omg-share.js: the primer text has been changed');
      const m = newModel();
      startByte(m);
      for (let i = 0; i < bytes.length; i++) {
        for (let b = 7; b >= 0; b--) {
          predict(m);
          update(m, (bytes[i] >> b) & 1);
        }
      }
      primed = m;
    }
    return copyModel(primed);
  }

  // =========================================================================
  // Packing and unpacking
  // =========================================================================

  // A packed program is: its length in bytes (7 bits at a time, low bits
  // first, top bit set on all but the last), then the arithmetic-coded bits
  // of the program followed by an 8-bit check. Trailing 0xFF bytes are left
  // off; the unpacker supplies them.

  function pack(bytes) {
    if (bytes.length > MAX_BYTES) throw new Error('too long to pack');
    const m = primedModel();
    const out = [];
    let low = 0;
    let high = 0xffffffff;

    function put(bit, chance) {
      const mid = low + ((high - low) >>> 12) * chance;
      if (bit) high = mid;
      else low = mid + 1;
      while (((low ^ high) & 0xff000000) === 0) {
        out.push(high >>> 24);
        low = (low << 8) >>> 0;
        high = ((high << 8) | 255) >>> 0;
      }
    }

    for (let i = 0; i < bytes.length; i++) {
      for (let b = 7; b >= 0; b--) {
        const bit = (bytes[i] >> b) & 1;
        put(bit, predict(m));
        update(m, bit);
      }
    }
    const check = checksum(bytes) & 255;
    for (let b = 7; b >= 0; b--) put((check >> b) & 1, 2048);

    if (high !== 0xffffffff) out.push(low >>> 24);
    while (out.length && out[out.length - 1] === 255) out.pop();

    const header = [];
    let n = bytes.length;
    while (n > 127) {
      header.push((n & 127) | 128);
      n >>>= 7;
    }
    header.push(n);
    return Uint8Array.from(header.concat(out));
  }

  function unpack(packed) {
    let at = 0;
    let length = 0;
    for (let shift = 0; ; shift += 7) {
      if (at >= packed.length || shift > 21) throw new Error('not a packed program');
      const byte = packed[at++];
      length += (byte & 127) << shift;
      if (byte < 128) break;
    }
    if (length > MAX_BYTES) throw new Error('not a packed program');

    const m = primedModel();
    const next = () => (at < packed.length ? packed[at++] : 255);
    let low = 0;
    let high = 0xffffffff;
    let code = 0;
    for (let i = 0; i < 4; i++) code = ((code << 8) | next()) >>> 0;

    function get(chance) {
      const mid = low + ((high - low) >>> 12) * chance;
      const bit = code <= mid ? 1 : 0;
      if (bit) high = mid;
      else low = mid + 1;
      while (((low ^ high) & 0xff000000) === 0) {
        low = (low << 8) >>> 0;
        high = ((high << 8) | 255) >>> 0;
        code = ((code << 8) | next()) >>> 0;
      }
      return bit;
    }

    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      let byte = 0;
      for (let b = 0; b < 8; b++) {
        const bit = get(predict(m));
        update(m, bit);
        byte = (byte << 1) | bit;
      }
      bytes[i] = byte;
    }
    let check = 0;
    for (let b = 0; b < 8; b++) check = (check << 1) | get(2048);
    if (check !== (checksum(bytes) & 255)) throw new Error('the link is damaged or cut short');
    return bytes;
  }

  // =========================================================================
  // The primer
  // =========================================================================

  // What the model reads before every program. Plain ASCII, no tabs, no
  // spaces at line ends, so that editors and Git have nothing to tidy up.
  // Do not edit: see the note at the top of this file.

  const PRIMER_CHECK = 0xb4dc72f9;

  const PRIMER = String.raw`;;;omg

# Declare some variables
alloc x := 5
alloc y := 10
alloc z := 0

emit "x = " + x
emit "y = " + y

proc add(a, b) {
    return a + b
}

emit "x + y is " + (x + y)
emit "-5 + 5 is " + (-5 + 5)

# Reassign
emit "Re-assigning x"
emit "x was " + x
x := 10
emit "x is now " + x

# Lists
alloc xs := [
    1,
    2,
    3
]

emit "sliced xs (Start: inc. End: exc.): " + xs[1:2]

# Create a loop
emit "Beginning loop:"
alloc i := 0
loop i <= 3 {
    # comparisons and logical "and"
    if i > 1 and i < 3 and i == 2 {
        emit "2 is alright I guess."
    } elif i == 3 {
        emit "3 is the magic number."
    } else {
        emit i
    }
    i := i + 1
}
emit "Finished loop."

alloc j := 0
emit "Beginning another loop and checking if j is 2 or 4:"
loop j < 5 {
    if j == 2 or j == 4 {
        emit "j is " + j
    }
    j := j + 1
}

;;;omg

# Demonstrate bitwise operations

# Bitwise AND: 6 & 3 = 2
alloc a := 6 & 3

# Bitwise OR: 6 | 3 = 7
alloc b := 6 | 3

# Bitwise XOR: 6 ^ 3 = 5
alloc c := 6 ^ 3

# Bitwise NOT: ~6 = -7
alloc d := ~6

# Bit shift left: 3 << 2 = 12
alloc e := 3 << 2

# Bit shift right: 8 >> 1 = 4
alloc f := 8 >> 1

# Output the results
emit a  # 2
emit b  # 7
emit c  # 5
emit d  # -7
emit e  # 12
emit f  # 4

# Flag bitmasks
alloc FLAG_1 := 0b0001  # 1
alloc FLAG_2 := 0b0010  # 2
alloc FLAG_3 := 0b0100  # 4
alloc FLAG_4 := 0b1000  # 8

# Start with FLAG_1 set
alloc flags := FLAG_1

emit "Initial flags: " + flags

# Set FLAG_3
flags := flags | FLAG_3
emit "After setting FLAG_3: " + flags

# Check if FLAG_3 is set
if flags & FLAG_3 != 0 {
    emit "FLAG_3 is set"
}

# Check if FLAG_2 is set
if flags & FLAG_2 != 0 {
    emit "FLAG_2 is set"
} else {
    emit "FLAG_2 is not set"
}

# Toggle FLAG_1 (should unset it)
flags := flags ^ FLAG_1
emit "After toggling FLAG_1: " + flags

# Clear FLAG_3 (using bitwise AND with complement)
flags := flags & ~FLAG_3
emit "After clearing FLAG_3: " + flags

# Final flag state
emit "Final flags: " + flags

;;;omg

alloc person := {
    name: "Chris",
    age: 32
}

person.age := 33
person["city"] := "Milton Keynes"

alloc key := "age"

alloc company := {
    ceo: person
}

proc get_city(p) {
    return p.city
}

facts person.age == 33
facts person["city"] == "Milton Keynes"
facts person[key] == 33
facts company.ceo.name == "Chris"
facts get_city(company.ceo) == "Milton Keynes"

emit person.name
emit person["city"]

;;;omg

# Andy Sloane's spinning ASCII donut (donut.c), ported to OMG.
#
# A torus is parameterised by two angles:
#   theta - around the central axis (sweeps through the hole)
#   phi   - around the tube
# Each frame, the donut is rotated by A around the X axis and B
# around the Z axis. Every (theta, phi) sample is projected onto an
# 80x22 grid with a per-pixel z-buffer to handle occlusion, and the
# surface normal is dotted with a fixed light direction to pick a
# luminance character from ".,-~:;=!*#$@".
#
# Animation: chr(27) is ESC; ESC followed by "[H" moves the cursor back
# to the top-left each frame, so the donut spins in place. The output
# pane on this page understands that code. Press Stop to end it.
#
# Performance: ~12K torus samples per frame. That is too much for the
# bytecode VM in a browser, so this example selects the JS engine,
# which compiles the program to JavaScript first. Switch the engine to
# VM to feel the difference. On your own machine, compile it to a
# native program for the smoothest spin:
#     omg --build examples/donut.omg donut && ./donut

alloc W := 80
alloc H := 22
alloc CELLS := W * H
alloc LUMA := ".,-~:;=!*#$@"
alloc CLEAR := chr(27) + "[2J"
alloc HOME  := chr(27) + "[H"

# Sample resolution. Each frame visits NPHI*NTHETA torus points;
# bumping these makes the donut smoother but the loop slower.
alloc NPHI   := 60
alloc NTHETA := 210
alloc TWOPI := 6.283185307179586

# Build a list of 'n' copies of 'fill'. O(n^2) because of list +
# semantics - fine for the one-time allocation, but never call this
# inside the per-frame path.
proc make_buffer(n, fill) {
    alloc buf := []
    alloc k := 0
    loop k < n {
        buf := buf + [fill]
        k := k + 1
    }
    return buf
}

# Precompute sin/cos for n equally-spaced angles in [0, 2pi). Returned
# as [cos_table, sin_table] so the inner render loop can replace
# 4 * NPHI * NTHETA trig calls with cheap list lookups.
proc make_trig_table(n) {
    alloc cs := []
    alloc ss := []
    alloc i := 0
    alloc step := TWOPI / n
    loop i < n {
        alloc x := i * step
        cs := cs + [cos(x)]
        ss := ss + [sin(x)]
        i := i + 1
    }
    return [cs, ss]
}

proc reset_buffers(fb, zb) {
    alloc i := 0
    loop i < CELLS {
        fb[i] := " "
        zb[i] := 0.0
        i := i + 1
    }
}

proc render_frame(fb, zb, A, B, cosphi_t, sinphi_t, costheta_t, sintheta_t) {
    reset_buffers(fb, zb)

    alloc cosA := cos(A)
    alloc sinA := sin(A)
    alloc cosB := cos(B)
    alloc sinB := sin(B)

    alloc p := 0
    loop p < NPHI {
        alloc cosphi := cosphi_t[p]
        alloc sinphi := sinphi_t[p]
        alloc h := cosphi + 2.0          # R2 + R1*cos(phi); R1=1, R2=2

        # Hoist everything that depends only on phi (constant across
        # the inner theta loop). Saves ~9 multiplies per inner iter.
        alloc h_sinA := h * sinA
        alloc h_cosA := h * cosA
        alloc h_cosB := h * cosB
        alloc h_sinB := h * sinB
        alloc spcA := sinphi * cosA
        alloc spsA := sinphi * sinA
        alloc cpcA := cosphi * cosA
        alloc cpsA := cosphi * sinA
        alloc cpsB := cosphi * sinB
        alloc d_const := spcA + 5.0
        alloc lum_const := 8.0 * (spsA * cosB - spcA)
        alloc lum_a := 8.0 * (cpcA * cosB + cpsA)
        alloc lum_b := 8.0 * cpsB

        alloc t := 0
        loop t < NTHETA {
            alloc costheta := costheta_t[t]
            alloc sintheta := sintheta_t[t]

            alloc D := 1.0 / (sintheta * h_sinA + d_const)
            alloc tval := sintheta * h_cosA - spsA

            alloc x := int(40.0 + 30.0 * D * (costheta * h_cosB - tval * sinB))
            alloc y := int(12.0 + 15.0 * D * (costheta * h_sinB + tval * cosB))
            alloc o := x + W * y

            alloc lum := int(lum_const - (sintheta * lum_a + costheta * lum_b))

            if y > 0 and y < H and x > 0 and x < W and D > zb[o] {
                zb[o] := D
                if lum < 0  { lum := 0 }
                if lum > 11 { lum := 11 }
                fb[o] := LUMA[lum]
            }

            t := t + 1
        }
        p := p + 1
    }
}

proc draw(fb) {
    emit HOME
    alloc row := 0
    loop row < H {
        alloc line := ""
        alloc col := 0
        loop col < W {
            line := line + fb[row * W + col]
            col := col + 1
        }
        emit line
        row := row + 1
    }
}

proc spin() {
    alloc fb := make_buffer(CELLS, " ")
    alloc zb := make_buffer(CELLS, 0.0)
    alloc phi_tbl   := make_trig_table(NPHI)
    alloc theta_tbl := make_trig_table(NTHETA)
    alloc cosphi_t   := phi_tbl[0]
    alloc sinphi_t   := phi_tbl[1]
    alloc costheta_t := theta_tbl[0]
    alloc sintheta_t := theta_tbl[1]

    alloc A := 0.0
    alloc B := 0.0
    emit CLEAR
    loop true {
        render_frame(fb, zb, A, B, cosphi_t, sinphi_t, costheta_t, sintheta_t)
        draw(fb)
        A := A + 0.04
        B := B + 0.02
        sleep_ms(10)        # leave the browser some breathing room
    }
}

spin()

;;;omg

# Newton's method for square root.
# Demonstrates floats, mixed arithmetic, and the math kit.

proc my_sqrt(x) {
    alloc guess := x / 2.0
    alloc i := 0
    loop i < 20 {
        guess := (guess + x / guess) / 2.0
        i := i + 1
    }
    return guess
}

emit my_sqrt(2.0)
emit my_sqrt(50.0)

# '/' is true division and always returns a float; '//' floors and keeps int when both operands are int.
emit 10 / 3                 # 3.3333333333333335
emit 10 / 3.0               # 3.3333333333333335
emit 10 // 3                # 3 (integer floor)
emit 10.5 // 3              # 3.0

# Cross-type comparison: 5 == 5.0 is true.
emit 5 == 5.0

# Standard math: sin^2 + cos^2 == 1 (within rounding).
proc square(x) { return x * x }
alloc theta := 1.234
emit square(sin(theta)) + square(cos(theta))

;;;omg

# Character lookup for hex digits
alloc HEXCHARS := "0123456789ABCDEF"

# Convert a single hex digit to decimal
proc hex_char_to_int(ch) {
    alloc i := 0
    loop i < 16 {
        if HEXCHARS[i] == ch {
            return i
        }
        i := i + 1
    }
    return 0  # fallback (shouldn't be reached)
}

# Convert two hex characters to a decimal byte
proc hex_to_byte(pair) {
    alloc high := hex_char_to_int(pair[0])
    alloc low := hex_char_to_int(pair[1])
    return high * 16 + low
}

# Convert full hex string to RGB
proc hex_to_rgb(hexstr) {
    alloc r := hex_to_byte(hexstr[0:2])
    alloc g := hex_to_byte(hexstr[2:4])
    alloc b := hex_to_byte(hexstr[4:6])
    return r + ", " + g + ", " + b
}

# Convert decimal 0-15 to a hex digit
proc nibble_to_hex(n) {
    return HEXCHARS[n]
}

# Convert a byte (0-255) to two hex characters
proc byte_to_hex(n) {
    alloc hi := n // 16
    alloc lo := n % 16
    return nibble_to_hex(hi) + nibble_to_hex(lo)
}

# Convert RGB values to hex string
proc rgb_to_hex(r, g, b) {
    return byte_to_hex(r) + byte_to_hex(g) + byte_to_hex(b)
}

emit "RGB: " + hex_to_rgb("FF8800")      # Outputs: R: 255 G: 136 B: 0
emit "HEX: " + rgb_to_hex(255, 136, 0)   # Outputs: FF8800

;;;omg

proc double(x) {
    return x + x
}

proc apply_twice(f, x) {
    return f(f(x))
}

emit apply_twice(double, 3)

proc make_adder(n) {
    proc inner(x) {
        return x + n
    }
    return inner # returns the inner function
}

alloc add5 := make_adder(5)
emit add5(10)

;;;omg

import "./modules/math.omg" as math

# Loop over numbers and rate them, including Fibonacci calculation
alloc idx := 10
alloc max := 15
alloc fnum := 2

loop idx <= max {
    emit "Classified number " + idx + " " + math.classify_number(idx)
    emit "Fibonacci sequence[" + fnum + "] = " + math.fibonacci(fnum)
    idx := idx + 1
    fnum := fnum + 2
}

# Assert primality of 97 for validation
facts math.is_prime(97)
emit "97 is prime"

;;;omg

# Demonstrates matrix creation, identity matrices, and multiplication

proc zeros(n, m) {
    alloc result := []
    alloc i := 0
    loop i < n {
        alloc row := []
        alloc j := 0
        loop j < m {
            row := row + [0]
            j := j + 1
        }
        result := result + [row]
        i := i + 1
    }
    return result
}

proc identity(n) {
    alloc id := zeros(n, n)
    alloc i := 0
    loop i < n {
        id[i][i] := 1
        i := i + 1
    }
    return id
}

proc mat_mul(a, b) {
    alloc n := length(a)
    alloc m := length(b[0])
    alloc p := length(b)
    alloc result := zeros(n, m)
    alloc i := 0
    loop i < n {
        alloc j := 0
        loop j < m {
            alloc k := 0
            alloc sum := 0
            loop k < p {
                sum := sum + a[i][k] * b[k][j]
                k := k + 1
            }
            result[i][j] := sum
            j := j + 1
        }
        i := i + 1
    }
    return result
}

alloc a := [
    [1, 2, 3],
    [4, 5, 6]
]
alloc b := [
    [7, 8],
    [9, 10],
    [11, 12]
]

alloc prod := mat_mul(a, b)
alloc prod_id := mat_mul(prod, identity(length(prod)))
emit prod
emit prod_id

;;;omg

# Breadth-first search on a maze represented as a grid

alloc maze := [
    [0, 0, 0, 0, 0],
    [1, 1, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 0]
]

alloc start := [0, 0]
alloc goal := [4, 4]

proc key(p) {
    return p[0] + "," + p[1]
}

proc has_key(d, k) {
    try {
        alloc probe := d[k]
        return true
    } except err {
        return false
    }
}

proc neighbors(p) {
    alloc dirs := [[1, 0], [-1, 0], [0, 1], [0, -1]]
    alloc result := []
    alloc i := 0
    loop i < length(dirs) {
        alloc nx := p[0] + dirs[i][0]
        alloc ny := p[1] + dirs[i][1]
        if nx >= 0 and nx < length(maze) and ny >= 0 and ny < length(maze[0]) and maze[nx][ny] == 0 {
            result := result + [[nx, ny]]
        }
        i := i + 1
    }
    return result
}

proc bfs(start, goal) {
    alloc queue := [start]
    alloc visited := {}
    visited[key(start)] := true
    alloc prev := {}
    loop length(queue) > 0 {
        alloc current := queue[0]
        queue := queue[1:length(queue)]
        if current[0] == goal[0] and current[1] == goal[1] {
            alloc path := [current]
            alloc k := key(current)
            loop has_key(prev, k) {
                alloc p := prev[k]
                path := [p] + path
                k := key(p)
            }
            return path
        }
        alloc neigh := neighbors(current)
        alloc i := 0
        loop i < length(neigh) {
            alloc n := neigh[i]
            alloc nk := key(n)
            if has_key(visited, nk) == false {
                visited[nk] := true
                prev[nk] := current
                queue := queue + [n]
            }
            i := i + 1
        }
    }
    return []
}

alloc path := bfs(start, goal)
emit path

;;;omg

# Merge sort implementation using recursion and list manipulation

proc merge(left, right) {
    alloc result := []
    alloc i := 0
    alloc j := 0
    loop i < length(left) and j < length(right) {
        if left[i] <= right[j] {
            result := result + [left[i]]
            i := i + 1
        } else {
            result := result + [right[j]]
            j := j + 1
        }
    }
    loop i < length(left) {
        result := result + [left[i]]
        i := i + 1
    }
    loop j < length(right) {
        result := result + [right[j]]
        j := j + 1
    }
    return result
}

proc merge_sort(xs) {
    if length(xs) <= 1 {
        return xs
    }
    alloc mid := length(xs) // 2
    alloc left := xs[0:mid]
    alloc right := xs[mid:length(xs)]
    alloc sorted_left := merge_sort(left)
    alloc sorted_right := merge_sort(right)
    return merge(sorted_left, sorted_right)
}

alloc arr := [5, 2, 9, 1, 5, 6]
alloc sorted := merge_sort(arr)
emit sorted

;;;omg

# Permission bitmasks
alloc READ := 4      # 100
alloc WRITE := 2     # 010
alloc EXECUTE := 1   # 001

# Convert a single digit (0-7) to rwx string
proc to_rwx(bits) {
    alloc result := ""

    if bits & READ != 0 {
        result := result + "r"
    } else {
        result := result + "-"
    }

    if bits & WRITE != 0 {
        result := result + "w"
    } else {
        result := result + "-"
    }

    if bits & EXECUTE != 0 {
        result := result + "x"
    } else {
        result := result + "-"
    }

    return result
}

# Convert full numeric mode (e.g. 755) to rwxrwxrwx
proc permissions(mode) {
    alloc u := mode // 100
    alloc g := (mode // 10) % 10
    alloc o := mode % 10

    return to_rwx(u) + to_rwx(g) + to_rwx(o)
}

# Try a few examples
alloc codes := [755, 644, 700, 600, 777]
alloc i := 0

alloc mode := 0
loop i < length(codes) {
    mode := codes[i]
    emit mode + ": " + permissions(mode)
    i := i + 1
}

;;;omg

# Sieve of Eratosthenes to generate primes up to a limit

proc sieve(limit) {
    # Initialize list of numbers from 2 to limit
    alloc nums := []
    alloc i := 2
    loop i <= limit {
        nums := nums + [i]
        i := i + 1
    }

    # Collect primes by filtering multiples
    alloc primes := []
    loop length(nums) > 0 {
        alloc p := nums[0]
        primes := primes + [p]
        alloc filtered := []
        alloc j := 0
        loop j < length(nums) {
            if nums[j] % p != 0 {
                filtered := filtered + [nums[j]]
            }
            j := j + 1
        }
        nums := filtered
    }
    return primes
}

# Generate and emit primes up to 100
alloc primes := sieve(100)
emit primes

;;;omg

# Shift the list by n positions
proc shift(a_list, n) {
    alloc i := 0
    alloc result := []
    alloc len := length(a_list)
    alloc shifted := []
    loop i < len {
        shifted := a_list[(i + n) % len]
        result := result + [shifted]
        i := i + 1
    }
    return result
}

# Generate alphabet
proc alphabet() {                               # create a procedure named alphabet
    alloc i := 0                                # allocate 0  to i
    alloc result := []                          # allocate [] to result
    loop i < 26 {                               # loop through the code below while i is smaller than 26
        result := result + [chr(65 + i)]        # get next alphabet char and push to result ([])
        i := i + 1                              # increment i (is now 1)
    }                                           # close the loop
    return result                               # return result (allocated: [a, b, c, d...])
}

# Generate Tabula Recta (list of 26 shifted alphabets)
proc tabula_recta() {
    alloc i := 0
    alloc base := alphabet()                     # Call the 'alphabet' procedure
    alloc result := []
    loop i < 26 {
        result := result + [shift(base, i)]
        i := i + 1
    }
    return result
}

# Perform ROT-13 using tabula recta and return joined string
proc rot13(input) {
    alloc base := alphabet()
    alloc table := tabula_recta()
    alloc i := 0
    alloc j := 0
    alloc k  := 0
    alloc char   := 0
    alloc found  := false
    alloc result := ""
    alloc rot    := ""

    loop i < length(input) {
        char := input[i]
        j := 0
        k := 0
        found := false

        loop j < length(base) {
            if base[j] == char {
                found := true
                k := j
                j := length(base)
            } else {
                j := j + 1
            }
        }

        if found {
            rot := table[13]
            result := result + rot[k]
        } else {
            result := result + char
        }

        i := i + 1
    }
    return result
}

# Entry point
alloc message := ["H", "E", "L", "L", "O"]
alloc encoded := rot13(message)
emit encoded

;;;omg

# === Bytecode Program ===
alloc program := [
    ["push", 5],                    # push 5   -> stack  = [5]
    ["push", 3],                    # push 3   -> stack  = [5,3]
    ["add"],                        # add      -> stack  = [8]
    ["store", "x"],                 # store 8  -> memory = {x: 8} -> stack = []
    ["push", 10],                   # push 10  -> stack  = [10]
    ["load", "x"],                  # load x   -> stack  = [10,8]
    ["mul"],                        # multiply -> stack  = [80]
    ["emit_top"],                   # output top of stack (80)
    ["pop"],                        # pop the stack -> stack = []
    ["label", "loop"],              # loop start
    ["load", "x"],                  # load x   -> stack  = [8]
    ["push", 1],                    # push 1   -> stack  = [8,1]
    ["sub"],                        # subtract -> stack  = [7]
    ["dup"],                        # dup top  -> stack  = [7,7]    (one copy for store, one for the branch test)
    ["store", "x"],                 # store 7  -> memory = {x: 7}, stack = [7]
    ["jmp_if_nonzero", "loop"],     # branch while x != 0 (consumes the dup'd copy)
    ["halt"]
]

# === VM State ===
alloc ptr := 0
alloc stack  := []
alloc memory := {}
alloc labels := {}
alloc instr  := []
alloc op     := ""
alloc lhs    := 0
alloc rhs    := 0
alloc val    := 0
alloc cond   := 0

# === Preprocess labels ===
alloc idx := 0
loop idx < length(program) {
    instr := program[idx]
    if instr[0] == "label" {
        labels[instr[1]] := idx
    }
    idx := idx + 1
}

# === VM Loop ===
loop ptr < length(program) {
    instr := program[ptr]
    ptr := ptr + 1
    op := instr[0]

    if op == "push" {
        stack := stack + [instr[1]]
        emit instr + " -> stack: " + stack
    } elif op == "pop" {
        stack := stack[0:length(stack) - 1]
        emit "stack popped, -> stack: " + stack
    } elif op == "add" {
        rhs := stack[length(stack) - 1]
        stack := stack[0:length(stack) - 1]
        lhs := stack[length(stack) - 1]
        stack := stack[0:length(stack) - 1]
        stack := stack + [lhs + rhs]
        emit instr + " with values " + lhs + " and " + rhs + " -> stack: " + stack
    } elif op == "sub" {
        rhs := stack[length(stack) - 1]
        stack := stack[0:length(stack) - 1]
        lhs := stack[length(stack) - 1]
        stack := stack[0:length(stack) - 1]
        stack := stack + [lhs - rhs]
        emit instr + " with values " + lhs + " and " + rhs + " -> stack: " + stack
    } elif op == "mul" {
        rhs := stack[length(stack) - 1]
        stack := stack[0:length(stack) - 1]
        lhs := stack[length(stack) - 1]
        stack := stack[0:length(stack) - 1]
        stack := stack + [lhs * rhs]
        emit instr + " with values " + lhs + " and " + rhs + " -> stack: " + stack
    } elif op == "div" {
        rhs := stack[length(stack) - 1]
        stack := stack[0:length(stack) - 1]
        lhs := stack[length(stack) - 1]
        stack := stack[0:length(stack) - 1]
        stack := stack + [lhs / rhs]
        emit instr + " with values " + lhs + " and " + rhs + " -> stack: " + stack
    } elif op == "store" {
        val := stack[length(stack) - 1]
        stack := stack[0:length(stack) - 1]
        memory[instr[1]] := val
        emit val + " in '" + instr[1] + "' in memory," + " -> stack: " + stack
    } elif op == "load" {
        stack := stack + [memory[instr[1]]]
        emit instr[1] + " from memory: " + instr + " -> stack: " + stack
    } elif op == "dup" {
        val := stack[length(stack) - 1]
        stack := stack + [val]
        emit "dup top, -> stack: " + stack
    } elif op == "emit_top" {
        val := stack[length(stack) - 1]
        emit val + " -> stack: " + stack
    } elif op == "jmp" {
        ptr := labels[instr[1]]
    } elif op == "jmp_if_nonzero" {
        cond := stack[length(stack) - 1]
        stack := stack[0:length(stack) - 1]
        if cond != 0 {
            ptr := labels[instr[1]]
        }
    } elif op == "label" {
        # no-op (resolved in the prepass above)
    } elif op == "halt" {
        break
    } else {
        emit "Unknown instruction: " + op
        break
    }
}

;;;omg

# === ISA constants ===
alloc OP_PUSH  := 1
alloc OP_POP   := 2
alloc OP_ADD   := 3
alloc OP_SUB   := 4
alloc OP_MUL   := 5
alloc OP_DIV   := 6
alloc OP_STORE := 7
alloc OP_LOAD  := 8
alloc OP_EMIT  := 9
alloc OP_JMP   := 10
alloc OP_JNZ   := 11
alloc OP_HALT  := 12
alloc OP_DUP   := 13


# === Helper ===
proc has_key(d, k) {
    try {
        alloc probe := d[k]
        return true
    } except err {
        return false
    }
}

# === Two-pass assembler ===
proc assemble(asm) {
    alloc labels := {}
    alloc pc := 0
    alloc i := 0
    alloc inst := []
    alloc op := false
    loop i < length(asm) {
        inst := asm[i]
        op := inst[0]
        if op == "label" {
            labels[inst[1]] := pc
        } else {
            pc := pc + 1
        }
        i := i + 1
    }

    alloc bytecode := []
    alloc addr := 0
    i := 0
    loop i < length(asm) {
        inst := asm[i]
        op := inst[0]
        if op == "push" {
            bytecode := bytecode + [[OP_PUSH, inst[1]]]
        } elif op == "pop" {
            bytecode := bytecode + [[OP_POP]]
        } elif op == "add" {
            bytecode := bytecode + [[OP_ADD]]
        } elif op == "sub" {
            bytecode := bytecode + [[OP_SUB]]
        } elif op == "mul" {
            bytecode := bytecode + [[OP_MUL]]
        } elif op == "div" {
            bytecode := bytecode + [[OP_DIV]]
        } elif op == "store" {
            bytecode := bytecode + [[OP_STORE, inst[1]]]
        } elif op == "load" {
            bytecode := bytecode + [[OP_LOAD, inst[1]]]
        } elif op == "emit" {
            bytecode := bytecode + [[OP_EMIT]]
        } elif op == "dup" {
            bytecode := bytecode + [[OP_DUP]]
        } elif op == "jmp" {
            if has_key(labels, inst[1]) == false {
                return ["BAD_LABEL"]
            }
            bytecode := bytecode + [[OP_JMP, labels[inst[1]]]]
        } elif op == "jnz" {
            if has_key(labels, inst[1]) == false {
                return ["BAD_LABEL"]
            }
            bytecode := bytecode + [[OP_JNZ, labels[inst[1]]]]
        } elif op == "halt" {
            bytecode := bytecode + [[OP_HALT]]
        } elif op == "label" {
            # already resolved in pass 1
        } else {
            return ["BAD_OPCODE"]
        }
        i := i + 1
    }
    return ["ok", bytecode]
}

# === VM runtime ===
proc run(program) {
    alloc pc := 0
    alloc stack := []
    alloc memory := {}
    alloc output := []
    alloc status := "ok"
    alloc instr := []
    alloc opcode := 0
    alloc operand := false
    alloc lhs := 0
    alloc rhs := 0
    alloc cond := 0
    loop pc < length(program) {
        instr := program[pc]
        pc := pc + 1
        opcode := instr[0]
        if opcode == OP_PUSH {
            stack := stack + [instr[1]]
        } elif opcode == OP_POP {
            if length(stack) == 0 {
                status := "STACK_UNDERFLOW"
                break
            }
            stack := stack[0:length(stack) - 1]
        } elif opcode == OP_ADD {
            if length(stack) < 2 {
                status := "STACK_UNDERFLOW"
                break
            }
            rhs := stack[length(stack) - 1]
            stack := stack[0:length(stack) - 1]
            lhs := stack[length(stack) - 1]
            stack := stack[0:length(stack) - 1]
            stack := stack + [lhs + rhs]
        } elif opcode == OP_SUB {
            if length(stack) < 2 {
                status := "STACK_UNDERFLOW"
                break
            }
            rhs := stack[length(stack) - 1]
            stack := stack[0:length(stack) - 1]
            lhs := stack[length(stack) - 1]
            stack := stack[0:length(stack) - 1]
            stack := stack + [lhs - rhs]
        } elif opcode == OP_MUL {
            if length(stack) < 2 {
                status := "STACK_UNDERFLOW"
                break
            }
            rhs := stack[length(stack) - 1]
            stack := stack[0:length(stack) - 1]
            lhs := stack[length(stack) - 1]
            stack := stack[0:length(stack) - 1]
            stack := stack + [lhs * rhs]
        } elif opcode == OP_DIV {
            if length(stack) < 2 {
                status := "STACK_UNDERFLOW"
                break
            }
            rhs := stack[length(stack) - 1]
            stack := stack[0:length(stack) - 1]
            if rhs == 0 {
                status := "DIV_ZERO"
                break
            }
            lhs := stack[length(stack) - 1]
            stack := stack[0:length(stack) - 1]
            stack := stack + [lhs / rhs]
        } elif opcode == OP_STORE {
            if length(stack) == 0 {
                status := "STACK_UNDERFLOW"
                break
            }
            operand := instr[1]
            rhs := stack[length(stack) - 1]
            stack := stack[0:length(stack) - 1]
            memory[operand] := rhs
        } elif opcode == OP_LOAD {
            operand := instr[1]
            if has_key(memory, operand) {
                stack := stack + [memory[operand]]
            } else {
                stack := stack + [0]
            }
        } elif opcode == OP_EMIT {
            if length(stack) == 0 {
                status := "STACK_UNDERFLOW"
                break
            }
            rhs := stack[length(stack) - 1]
            output := output + [rhs]
        } elif opcode == OP_DUP {
            if length(stack) == 0 {
                status := "STACK_UNDERFLOW"
                break
            }
            rhs := stack[length(stack) - 1]
            stack := stack + [rhs]
        } elif opcode == OP_JMP {
            operand := instr[1]
            if operand < 0 {
                status := "BAD_JUMP"
                break
            }
            if operand >= length(program) {
                status := "BAD_JUMP"
                break
            }
            pc := operand
        } elif opcode == OP_JNZ {
            if length(stack) == 0 {
                status := "STACK_UNDERFLOW"
                break
            }
            cond := stack[length(stack) - 1]
            stack := stack[0:length(stack) - 1]
            if cond != 0 {
                operand := instr[1]
                if operand < 0 {
                    status := "BAD_JUMP"
                    break
                }
                if operand >= length(program) {
                    status := "BAD_JUMP"
                    break
                }
                pc := operand
            }
        } elif opcode == OP_HALT {
            break
        } else {
            status := "BAD_OPCODE"
            break
        }
    }
    return [status, output]
}

# === Sample assembly programs ===
alloc prog_add := [
    ["push", 2],
    ["push", 3],
    ["add"],
    ["emit"],
    ["halt"]
]

alloc prog_fact := [
    ["push", 5],
    ["store", "n"],       # upper bound
    ["push", 1],
    ["store", "m"],       # current multiplier
    ["push", 1],
    ["store", "r"],       # running factorial
    ["label", "loop"],
    ["load", "r"],
    ["load", "m"],
    ["mul"],
    ["dup"],              # keep a copy: one for store, one for emit
    ["store", "r"],
    ["emit"],
    ["load", "m"],
    ["load", "n"],
    ["sub"],
    ["jnz", "cont"],
    ["jmp", "end"],
    ["label", "cont"],
    ["load", "m"],
    ["push", 1],
    ["add"],
    ["store", "m"],
    ["jmp", "loop"],
    ["label", "end"],
    ["halt"]
]

alloc prog_fib := [
    ["push", 8],
    ["store", "n"],       # number of terms to emit
    ["push", 0],
    ["store", "a"],
    ["push", 1],
    ["store", "b"],
    ["label", "loop"],
    ["load", "n"],
    ["jnz", "body"],
    ["jmp", "end"],
    ["label", "body"],
    ["load", "a"],
    ["dup"],              # keep a copy of 'a' for the add below
    ["emit"],
    ["load", "b"],
    ["add"],
    ["store", "t"],
    ["load", "b"],
    ["store", "a"],
    ["load", "t"],
    ["store", "b"],
    ["load", "n"],
    ["push", 1],
    ["sub"],
    ["store", "n"],
    ["jmp", "loop"],
    ["label", "end"],
    ["halt"]
]

alloc prog_div0 := [
    ["push", 1],
    ["push", 0],
    ["div"],
    ["halt"]
]

alloc prog_badjump := [
    ["jmp", "missing"],
    ["halt"]
]

alloc prog_underflow := [
    ["add"],
    ["halt"]
]

# === Test harness ===
proc test(name, prog, expect_status, expect_output) {
    alloc asm_res := assemble(prog)
    if asm_res[0] != "ok" {
        if asm_res[0] == expect_status {
            emit name + ": pass"
        } else {
            emit name + ": fail (asm " + asm_res[0] + ")"
        }
        return 0
    }
    alloc bytecode := asm_res[1]
    alloc run_res := run(bytecode)
    alloc status := run_res[0]
    alloc out := run_res[1]
    if status == expect_status and out == expect_output {
        emit name + ": pass"
    } else {
        emit name + ": fail (status=" + status + " out=" + out + ")"
    }
    return 0
}

proc run_tests() {
    test("prog_add", prog_add, "ok", [5])
    test("prog_fact", prog_fact, "ok", [1, 2, 6, 24, 120])
    test("prog_fib", prog_fib, "ok", [0, 1, 1, 2, 3, 5, 8, 13])
    test("prog_div0", prog_div0, "DIV_ZERO", [])
    test("prog_badjump", prog_badjump, "BAD_LABEL", [])
    test("prog_underflow", prog_underflow, "STACK_UNDERFLOW", [])
}

run_tests()

;;;omg

# Generate alphabet
proc alphabet() {
    alloc i := 0
    alloc result := []
    loop i < 26 {
        result := result + [chr(65 + i)]
        i := i + 1
    }
    return result
}

# Shift the list by n positions
proc shift(a_list, n) {
    alloc i := 0
    alloc result := []
    alloc len := length(a_list)
    alloc shifted := []
    loop i < len {
        shifted := a_list[(i + n) % len]
        result := result + [shifted]
        i := i + 1
    }
    return result
}

# Generate Tabula Recta (list of 26 shifted alphabets)
proc tabula_recta() {
    alloc i := 0
    alloc base := alphabet()
    alloc result := []
    loop i < 26 {
        result := result + [shift(base, i)]
        i := i + 1
    }
    return result
}

# Entry point
alloc table := tabula_recta()
alloc i := 0
loop i < length(table) {
    emit table[i]
    i := i + 1
}

;;;omg

/**
 * Math Module
 * Provides basic arithmetic operations, primality testing, and number classification.
 *
 * @module math
 * @version 1.0
 */

/**
 * Adds two numbers.
 *
 * @param a First number
 * @param b Second number
 * @return Sum of a and b
 */
proc add(a, b) {
    return a + b
}

/**
 * Subtracts second number from first.
 *
 * @param a First number
 * @param b Second number
 * @return Difference of a and b
 */
proc subtract(a, b) {
    return a - b
}

/**
 * Multiplies two numbers.
 *
 * @param a First number
 * @param b Second number
 * @return Product of a and b
 */
proc multiply(a, b) {
    return a * b
}

/**
 * Divides first number by second.
 * Returns an error message if division by zero is attempted.
 *
 * @param a Numerator
 * @param b Denominator
 * @return Quotient of a and b or error message
 */
proc divide(a, b) {
    if b == 0 {
        return "Error: Division by zero"
    }
    return a / b
}

/**
 * Raises a number to a power.
 *
 * @param base Base number
 * @param exp Exponent
 * @return Result of base raised to the power of exp
 */
proc power(base, exp) {
    alloc result := 1
    loop exp > 0 {
        result := result * base
        exp := exp - 1
    }
    return result
}

/**
 * Checks if a number is prime.
 *
 * @param n Number to check
 * @return 1 if n is prime, 0 otherwise
 */
proc is_prime(n) {
    if n <= 1 {
        return 0
    }
    alloc i := 2
    loop i * i <= n {
        if n % i == 0 {
            return 0
        }
        i := i + 1
    }
    return 1
}

/**
 * Computes the factorial of a number.
 *
 * @param n Number to compute factorial for
 * @return Factorial of n
 */
proc factorial(n) {
    if n <= 1 {
        return 1
    } else {
        return n * factorial(n - 1)
    }
}

/**
 * Computes the nth Fibonacci number.
 *
 * @param n Position in Fibonacci sequence
 * @return nth Fibonacci number
 */
proc fibonacci(n) {
    if n <= 1 {
        return n
    } else {
        return fibonacci(n - 1) + fibonacci(n - 2)
    }
}

/**
 * Computes the sum of digits of a number.
 *
 * @param n Number to compute digit sum for
 * @return Sum of digits of n
 */
proc digit_sum(n) {
    alloc sum := 0
    alloc temp := n
    loop temp > 0 {
        sum := sum + (temp % 10)
        temp := temp // 10
    }
    return sum
}

# Primality, odd/even, and digit sum
proc classify_number(n) {
    alloc isprime := is_prime(n)
    alloc dsum := digit_sum(n)

    if isprime == 1 {
        return "is prime, sum of digits is " + dsum
    } elif n % 2 == 0 {
        return "is even, sum of digits is " + dsum
    } else {
        return "is odd, sum of digits is " + dsum
    }
}

# 03 - Language tour

# A whirlwind tour of OMG. If you've used Python or JS, most of it will feel
# familiar - with a few quirks (declaration vs assignment, the ;;;omg header,
# keywords like proc and facts).

# The header

# OMG files conventionally start with:

;;;omg

# It's stripped by the lexer if present. The header isn't required - every
# way of running a file (omg, --compile, --build, --disasm)
# accepts a file without it - but it's the canonical way to mark
# a file as OMG source (so editors and tools can recognize it).

# Types

# Type: Examples
# Int: 42, -7, 0b1010 (64-bit signed)
# Float: 3.14, 1.0e-3
# String: "hello", "line\n"
# Bool: true, false
# None: no literal; produced when a proc falls off the end without return. emit of None prints a blank line.
# List: [1, 2, 3], [], ["a", 5, true]
# Dict: {name: "Ada", age: 36}
# Closure: from proc definitions

# There are no hexadecimal literals (hex(n) formats an int as hex, but
# 0xff is not a number in source) and no nan / inf literals. List and dict elements, and call arguments, are separated by
# commas; leaving one out is a SyntaxError.

# Lists and dicts are heterogeneous. Equality is structural ([1,2] == [1,2]).

# Variables

# OMG distinguishes declaration (alloc) from assignment (:=).

alloc x := 5     # introduces a new binding
x := 6           # reassigns the existing binding
y := 7           # ERROR: y is not declared

# This catches typos. Without alloc, a misspelled name like cont instead
# of count would either silently create a new binding or shadow the outer
# one. With := requiring prior declaration, the typo errors immediately:

alloc count := 0
cont := count + 1   # -> UndefinedIdentError: cont

# Use alloc once per name per scope. Re-declaring inside a loop body is fine
# (each iteration is a fresh scope).

# Output

emit "hello"        # prints, with newline
emit 42 + 8         # 50
emit [1, 2, 3]      # [1, 2, 3]

# emit is a statement, not a function. It always takes one expression.

# Control flow

if x > 0 {
    emit "positive"
} elif x < 0 {
    emit "negative"
} else {
    emit "zero"
}

loop x < 100 {
    x := x + 1
    if x % 2 == 0 { continue }     # back to the test
    if x == 51 { break }
}

for item in [1, 2, 3] {            # lists, and the characters of a string
    emit item
}

if not ready { emit "waiting" }

# There's no while: loop is the while. for x in xs evaluates xs
# once and is shorthand for a counted loop (for a dict, walk
# dict_keys(d)). not binds looser than a comparison and tighter than
# and, so not a == b and c is (not (a == b)) and c.

# Functions

proc add(a, b) {
    return a + b
}

proc make_adder(n) {
    proc add_n(x) {       # nested procs capture from enclosing scope
        return x + n
    }
    return add_n
}

alloc add5 := make_adder(5)
emit add5(7)              # 12

# Procs can be passed around as values, returned, called via the captured
# result, etc. Closures work as you'd expect.

# A nested proc can call itself, and keeps what it captured while it does:

proc sum_to(limit, step) {
    proc walk(k) {
        if k > limit { return 0 }
        return k + walk(k + step)   # 'limit' and 'step' are still visible
    }
    return walk(0)
}
emit sum_to(10, 5)            # 15

# A closure captures the variables that exist *at the point where the
# nested proc is written*. Using a variable that the enclosing proc only
# declares further down is therefore a compile-time error, rather than a
# surprise at run time:

proc outer() {
    proc get() { return late }    # SyntaxError: 'late' is used in a nested
    alloc late := 1               # proc before the enclosing proc declares it
    return get()
}

# Move the alloc (or the sibling proc) above the nested proc that uses
# it. Names declared at the top level of a file are globals and are exempt:
# they are looked up when the proc runs.

# Tail calls to top-level procs are optimized - recursion of any depth
# doesn't blow the stack:

proc count_down(n) {
    if n == 0 { return "done" }
    return count_down(n - 1)   # tail call - no stack growth
}
emit count_down(1000000)       # works

# Three cases are ordinary calls instead, and do use a stack frame each:

# - return f(...) inside a try block. The handler has to stay in place
# while f runs, otherwise an error raised by f would escape the
# except written around it.
# - A call through a value: a nested proc (including one calling itself), a
# parameter, or anything held in a variable.
# - Any tail call in a program transpiled to JavaScript, which has no
# tail-call elimination.

# How deep ordinary recursion can go depends on how the program is run.
# The interpreter (omg foo.omg) keeps its call stack on the heap and is
# limited only by memory. A built executable uses the machine stack,
# 64 MiB of it on Linux and Windows: several hundred thousand frames
# when built to machine code, about 15,000 when built through C (whose
# frames are much larger), and under 2,000 through C on macOS, where the
# main thread's stack is fixed at 8 MB. JavaScript uses the engine's.
# Running out is not a crash anywhere: it raises
# RuntimeError: maximum recursion depth exceeded, which try /
# except can catch.

# Strings

alloc s := "hello"
emit length(s)             # 5
emit s[0]                  # h
emit s[1:4]                # ell
emit s + " world"          # hello world
emit chr(65)               # A
emit ascii("A")            # 65

# Strings are UTF-8. Indexing and slicing operate on code points, not bytes:

alloc s := "h?llo"
emit length(s)             # 5 (not 6)
emit s[1]                  # ?

# For raw byte access use string_bytes(s) and bytes_to_string(list).

# Lists

alloc xs := [1, 2, 3]
emit length(xs)            # 3
emit xs[0]                 # 1
emit xs[-1]                # 3 (negative indices count from end)
emit xs[0:2]               # [1, 2]
emit xs + [4, 5]           # [1, 2, 3, 4, 5] (fresh list)
xs[0] := 99                # in-place mutation
emit xs                    # [99, 2, 3]
append(xs, 4)              # in-place push, constant time
emit xs                    # [99, 2, 3, 4]

# Dicts

alloc d := {name: "Ada", age: 36}
emit d.name                # Ada
emit d["age"]              # 36
d.email := "ada@example.com"
emit dict_keys(d)          # [name, age, email]

# d.x and d["x"] are interchangeable; the key is always a string.

# Try / except

try {
    alloc result := 10 / 0
} except err {
    emit "caught: " + err   # caught: ZeroDivisionError: integer division or modulo by zero
}

# err is a string with the formatted error: "<Kind>: <message>".

# The error kinds you'll see: RuntimeError, TypeError, ValueError,
# IndexError, KeyError, ZeroDivisionError, AssertionError,
# UndefinedIdentError, ModuleImportError, FrozenWriteError.

# Uncaught errors print a Python-style traceback to stderr - file,
# line, and the chain of proc calls that led to the failure - before
# the program exits non-zero. Catching with try/except suppresses the
# traceback and binds just the formatted error message to err. See
# [07-debugging.md -> Reading a traceback](07-debugging.md#reading-a-traceback)
# for examples.

# Errors

panic("something went wrong")         # -> RuntimeError: something went wrong
raise("bad input")                    # functionally identical to panic
facts x > 0                           # like 'assert x > 0' - fails as AssertionError

# panic and raise produce the same RuntimeError: ... and are catchable
# with try/except. exit_with_error("msg") prints to stderr verbatim (no kind
# prefix) and exits 1; mostly used by vm.omg.

# Imports

import "./modules/math.omg" as math

emit math.is_prime(97)                # true

# The imported file's top-level bindings become attributes of the alias.
# Imports are resolved at compile time and inlined into the bytecode.

# Built-in functions

# The full list, grouped by area. Argument counts in parens.

# Strings & chars
# length(x), chr(i), ascii(s), string_bytes(s), bytes_to_string(list)

# Numeric
# int(x), float(x), floor(x), ceil(x), round(x), abs(x), pow(a,b),
# sqrt(x), log(x), sin(x), cos(x), tan(x)

# Formatting
# hex(i), binary(i) or binary(i, width), float_bits(s), bits_to_float(i)

# Collections
# freeze(d) (makes a dict immutable), dict_keys(d), has_key(d, k),
# append(list, item) (in place), list_repeat(item, n)

# File I/O
# read_file(path) (returns string),
# file_open(path, mode) (returns int handle), file_read(h), file_write(h, data),
# file_close(h),
# file_exists(p), is_dir(p), read_dir(p) (sorted list of names),
# make_dir(p) (mkdir -p), chmod(p, mode) (permission bits; on
# Windows it only checks that the file exists)

# Errors
# panic(msg), raise(msg), exit_with_error(msg)

# Process control
# subprocess(argv_list) (run a child, return its exit code; a program
# that cannot be started raises a catchable ValueError),
# exit(code), getpid(), executable_path() (absolute path of the
# native OMG executable running the program, or false when there is
# none, as in the browser)

# Reflection
# call_builtin(name, args_list) - dispatches to another builtin. Used by
# the OMG-in-OMG interpreter; rarely useful in user code.

# CLI args

;;;omg
emit "args: " + args
emit "first: " + args[0]   # the script path or binary
emit "count: " + length(args)

# args[0] is your "argv[0]"; user-supplied args start at args[1]. What
# exactly args[0] is depends on how you invoke the program:

# Invocation: args[0] is
# rust/target/release/omg foo.omg a b: foo.omg (user-typed)
# bin/omg foo.omg a b: a /tmp/.../a.omgb tempfile
# ./foo a b (after omg --build): ./foo (the binary)

# Most programs only care that args[1..] are their user-supplied arguments;
# args[0] is mainly useful in usage messages.

# Two more globals

# Global: What it is
# module_file: path to the running script (or binary)
# current_dir: working directory at startup; consulted by read_file, file_open, etc. for relative paths. Mutating it changes path resolution.

# Idioms

# Read a file as lines

alloc src := read_file("data.txt")
alloc lines := []
alloc start := 0
alloc i := 0
loop i < length(src) {
    if src[i] == "\n" {
        lines := lines + [src[start:i]]
        start := i + 1
    }
    i := i + 1
}
if start < length(src) {
    lines := lines + [src[start:]]
}

# Sort a list (insertion sort, in-place)

proc sort(xs) {
    alloc i := 1
    loop i < length(xs) {
        alloc j := i
        loop j > 0 and xs[j] < xs[j - 1] {
            alloc t := xs[j]
            xs[j] := xs[j - 1]
            xs[j - 1] := t
            j := j - 1
        }
        i := i + 1
    }
}

# Map (no built-in map() - write the loop)

proc map(f, xs) {
    alloc out := []
    for x in xs {
        append(out, f(x))
    }
    return out
}

# Read next

# - [04-pipeline.md](04-pipeline.md) - what happens between .omg and ./foo
# - [examples/](../examples/) - 19 working programs of varying size,
# from hello_world.omg to the spinning ASCII donut.omg

;;;omg

# Edit me, then press Run (or Ctrl+Enter).
proc greet(name) {
    return "Hello, " + name + "!"
}

alloc names := ["world", "OMG"]
alloc i := 0
loop i < length(names) {
    emit greet(names[i])
    i := i + 1
}

;;;omg

emit "Hello, world!"

;;;omg

alloc name := "Chris"        # introduce a new variable
emit name

name := "Bob"                # change it: no alloc the second time
emit name

;;;omg

alloc count := 0
cont := count + 1            # a typo: "cont" was never introduced
emit count

;;;omg

alloc total := 0

proc add(n) {
    total := total + n           # updates the global
    alloc doubled := n * 2       # local to this call
    return doubled
}

emit add(5)                      # 10
emit total                       # 5

;;;omg

emit 1 + 2          # 3
emit 10 - 3         # 7
emit 4 * 5          # 20
emit 10 / 3         # 3.3333...  true division, always a float
emit 10 // 3        # 3          floor division
emit 10 % 3         # 1          remainder
emit -7 // 2        # -4         floor rounds towards minus infinity

;;;omg

emit 6 & 3          # 2      AND
emit 6 | 3          # 7      OR
emit 6 ^ 3          # 5      XOR
emit ~1             # -2     NOT
emit 1 << 3         # 8      shift left
emit 16 >> 2        # 4      shift right
emit 0b1010         # 10     a binary literal
emit hex(255)       # ff
emit binary(5, 8)   # 00000101

;;;omg

emit 1.5
emit 2.0 + 3.5      # 5.5
emit 1.0e3          # 1000.0   scientific notation
emit 10 / 4         # 2.5
emit 10.5 // 3      # 3.0      floor division on a float stays a float
emit 5 == 5.0       # true     comparisons look at the value
emit 0.1 + 0.2 == 0.3

;;;omg

emit sqrt(2.0)      # 1.4142135623730951
emit pow(2, 10)     # 1024     int to the power of an int stays an int
emit floor(3.7)     # 3
emit ceil(3.2)      # 4
emit round(2.5)     # 2        ties go to the nearest even number
emit round(3.5)     # 4
emit abs(-4)        # 4
emit int(3.99)      # 3        cuts towards zero
emit int("42") + 1  # 43       parses a string
emit float(3)       # 3.0

;;;omg

alloc greeting := "Hello"
alloc name := "world"
emit greeting + ", " + name + "!"

emit length(greeting)       # 5
emit greeting[0]            # H
emit greeting[-1]           # o      negative indexes count from the end
emit greeting[1:4]          # ell    from 1 up to, not including, 4

emit "answer: " + 42        # numbers are converted when joined
emit "tab\there, quote \"here\""

;;;omg

emit ascii("A")             # 65
emit chr(65 + 1)            # B

# Shift every letter of a word one place along the alphabet.
alloc word := "HAL"
alloc out := ""
for letter in word {
    out := out + chr(ascii(letter) + 1)
}
emit out

;;;omg

emit 5 > 3              # true
emit 5 == 5             # true
emit 5 != 4             # true
emit "abc" < "abd"      # true     strings compare alphabetically
emit true and false     # false
emit true or false      # true
emit not true           # false
emit not 5 > 3          # false    the comparison happens first

;;;omg

alloc items := []
if items {
    emit "there are items"
} else {
    emit "the list is empty"
}

;;;omg

alloc score := 75

if score >= 90 {
    emit "A"
} elif score >= 80 {
    emit "B"
} elif score >= 70 {
    emit "C"
} else {
    emit "F"
}

;;;omg

alloc i := 0
loop i < 5 {
    emit i
    i := i + 1
}

;;;omg

# The first power of 2 greater than 100.
alloc n := 1
loop true {
    if n > 100 {
        break
    }
    n := n * 2
}
emit n

;;;omg

# The odd numbers below 10.
alloc i := 0
loop i < 10 {
    i := i + 1
    if i % 2 == 0 {
        continue
    }
    emit i
}

;;;omg

for name in ["ada", "grace", "linus"] {
    emit "hello, " + name
}

for letter in "omg" {
    emit letter
}

;;;omg

alloc xs := [10, 20, 30]
emit xs                 # [10, 20, 30]
emit length(xs)         # 3
emit xs[0]              # 10
emit xs[-1]             # 30
emit xs[1:3]            # [20, 30]

xs[0] := 99             # replace one element
xs := xs + [40]         # joining makes a new, longer list
append(xs, 50)          # append adds to the end of this list
emit xs                 # [99, 20, 30, 40, 50]

;;;omg

alloc a := [1, 2, 3]
alloc b := a
b[0] := 99
emit a                  # [99, 2, 3]

;;;omg

alloc temps := [14, 17, 21, 19, 12]

alloc sum := 0
alloc highest := temps[0]
for t in temps {
    sum := sum + t
    if t > highest {
        highest := t
    }
}

emit "average: " + sum / length(temps)
emit "highest: " + highest

;;;omg

alloc person := {name: "Chris", age: 32}

emit person.name                # Chris
emit person["age"]              # 32

person.age := 33                # change a value
person["job"] := "engineer"     # add a new key

emit person
emit dict_keys(person)          # [name, age, job]
emit has_key(person, "job")     # true

;;;omg

alloc stock := {apples: 12, pears: 0, plums: 7}

for k in dict_keys(stock) {
    if stock[k] == 0 {
        emit k + ": sold out"
    } else {
        emit k + ": " + stock[k]
    }
}

;;;omg

proc square(x) {
    return x * x
}

emit square(4)          # 16
emit square(7)          # 49

;;;omg

proc fib(n) {
    if n < 2 { return n }
    return fib(n - 1) + fib(n - 2)
}

alloc i := 0
loop i < 10 {
    emit "fib(" + i + ") = " + fib(i)
    i := i + 1
}

;;;omg

proc apply_twice(f, x) {
    return f(f(x))
}

proc inc(n) {
    return n + 1
}

emit apply_twice(inc, 5)        # 7

;;;omg

proc make_adder(n) {
    proc add(x) {
        return x + n        # n comes from make_adder
    }
    return add
}

alloc add5 := make_adder(5)
alloc add100 := make_adder(100)

emit add5(10)           # 15
emit add100(7)          # 107

;;;omg

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
emit b()        # 1   b has its own n
emit a()        # 3

;;;omg

import "mathlib.omg" as math

emit math.square(5)     # 25
emit math.cube(3)       # 27
emit math.PI * math.square(2)

;;;omg

alloc text := read_file("notes.txt")
if text == false {
    emit "could not read notes.txt"
} else {
    emit "got " + length(text) + " characters:"
    emit text
}

;;;omg

# Write a file...
alloc h := file_open("greeting.txt", "w")
file_write(h, "hi from OMG\n")
file_close(h)

# ...read it back as text...
alloc h2 := file_open("greeting.txt", "r")
emit file_read(h2)
file_close(h2)

# ...and again as raw bytes.
alloc h3 := file_open("greeting.txt", "rb")
emit file_read(h3)
file_close(h3)

emit read_dir(".")

;;;omg

proc third(xs) {
    return xs[2]
}

proc report(xs) {
    emit "third item: " + third(xs)
}

report([1, 2, 3])
report([1])                 # too short
emit "never reached"

;;;omg

try {
    alloc xs := [1, 2, 3]
    emit xs[99]
} except err {
    emit "oops: " + err
}
emit "still running"

;;;omg

proc divide(a, b) {
    if b == 0 {
        panic("cannot divide " + a + " by zero")
    }
    return a / b
}

emit divide(10, 4)

try {
    emit divide(10, 0)
} except err {
    emit "caught: " + err
}

;;;omg

proc max(a, b) {
    if a > b { return a }
    return b
}

facts max(1, 2) == 2
facts max(5, 3) == 5
facts max(2, 2) == 2
emit "all tests passed"

facts max(1, 2) == 1        # wrong on purpose

;;;omg
alloc total := 1 + 2 * 3   # a comment
emit "total: " + total

emit 1 + 2 * 3

emit 1 + 2 * 3

alloc i := 0
loop i < 3 {
    emit i
    i := i + 1
}

proc square(x) {
    return x * x
}
emit square(4)

try {
    emit [1, 2][5]
} except err {
    emit "caught: " + err
}

emit 1 + 2 * 3

;;;omg

emit "Hello, world!"

;;;omg

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

;;;omg

proc fib(n) {
    if n < 2 { return n }
    return fib(n - 1) + fib(n - 2)
}

alloc i := 0
loop i < 15 {
    emit "fib(" + i + ") = " + fib(i)
    i := i + 1
}

;;;omg

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

;;;omg

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
`;

  const api = {
    pack,
    unpack,
    // Read the primer now, so the first pack or unpack does not have to wait.
    warm() {
      primedModel();
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.OMGShareCodec = api;
})();
