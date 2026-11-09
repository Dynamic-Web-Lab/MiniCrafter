// Blockly integration for Bit: kid-sized custom blocks, workspace <-> program
// conversion, and a readable "see the code" view. Blockly (Apache 2.0) is
// loaded lazily the first time the editor opens.
import { BLOCKS, PLACEABLE } from './blocks.js';

// Bundled locally (see vendor/README.md) so coding works offline too.
const BLOCKLY_URL = new URL('../vendor/blockly.min.js', import.meta.url).href;
let loading = null;

export function loadBlockly() {
  if (window.Blockly) return Promise.resolve(window.Blockly);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = BLOCKLY_URL;
    s.async = true;
    s.onload = () => (window.Blockly ? resolve(window.Blockly) : reject(new Error('Blockly missing')));
    s.onerror = () => { loading = null; reject(new Error('Could not load Blockly')); };
    document.head.appendChild(s);
  });
  return loading;
}

const C = { start: 45, move: 210, build: 25, loops: 120, logic: 270, talk: 330 };
const DIR_MOVE = [['forward ⬆', 'forward'], ['back ⬇', 'back'], ['up ⤒', 'up'], ['down ⤓', 'down']];
const DIR_ACT = [['in front', 'forward'], ['above', 'up'], ['below', 'down']];
const blockOptions = () => [['the block I am holding', 'held'],
  ...PLACEABLE.filter((id) => id !== 14).map((id) => [BLOCKS[id].name, String(id)])];

let defined = false;
export function defineBlocks(Blockly) {
  if (defined) return;
  defined = true;
  Blockly.defineBlocksWithJsonArray([
    { type: 'bit_start', message0: '▶ when I press Run', nextStatement: null, colour: C.start, hat: 'cap', tooltip: 'Bit starts here' },
    { type: 'bit_move', message0: '🚶 move %1 %2 steps', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIR_MOVE }, { type: 'field_number', name: 'N', value: 1, min: 1, max: 50, precision: 1 }], previousStatement: null, nextStatement: null, colour: C.move, tooltip: 'Move Bit' },
    { type: 'bit_turn', message0: '↪ turn %1', args0: [{ type: 'field_dropdown', name: 'DIR', options: [['left ⟲', 'left'], ['right ⟳', 'right']] }], previousStatement: null, nextStatement: null, colour: C.move, tooltip: 'Turn Bit' },
    { type: 'bit_dig', message0: '⛏ dig the block %1', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIR_ACT }], previousStatement: null, nextStatement: null, colour: C.build, tooltip: 'Bit digs a block' },
    { type: 'bit_place', message0: '🧱 place %1 %2', args0: [{ type: 'field_dropdown', name: 'BLOCK', options: blockOptions }, { type: 'field_dropdown', name: 'DIR', options: DIR_ACT }], previousStatement: null, nextStatement: null, colour: C.build, tooltip: 'Bit places a block' },
    { type: 'bit_say', message0: '💬 say %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'Hello!' }], previousStatement: null, nextStatement: null, colour: C.talk, tooltip: 'Bit says something' },
    { type: 'bit_repeat', message0: '🔁 repeat %1 times', args0: [{ type: 'field_number', name: 'N', value: 4, min: 0, max: 1000, precision: 1 }], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], previousStatement: null, nextStatement: null, colour: C.loops, tooltip: 'Do the blocks inside again and again' },
    { type: 'bit_while', message0: '🔁 repeat while %1', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], previousStatement: null, nextStatement: null, colour: C.loops, tooltip: 'Keep going while the check is true' },
    { type: 'bit_if', message0: '❓ if %1', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }], message1: 'then %1', args1: [{ type: 'input_statement', name: 'THEN' }], message2: 'else %1', args2: [{ type: 'input_statement', name: 'ELSE' }], previousStatement: null, nextStatement: null, colour: C.logic, tooltip: 'Choose what to do' },
    { type: 'bit_detect', message0: 'there is a block %1', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIR_ACT }], output: 'Boolean', colour: C.logic, tooltip: 'True if a solid block is there' },
    { type: 'bit_is', message0: 'the block %1 is %2', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIR_ACT }, { type: 'field_dropdown', name: 'BLOCK', options: () => blockOptions().slice(1).concat([['air (nothing)', '0'], ['water', '14']]) }], output: 'Boolean', colour: C.logic, tooltip: 'Check which block is there' },
    { type: 'bit_not', message0: 'not %1', args0: [{ type: 'input_value', name: 'A', check: 'Boolean' }], output: 'Boolean', colour: C.logic, tooltip: 'The opposite' },
  ]);
}

export const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    { kind: 'category', name: '🚶 Move', colour: String(C.move), contents: [
      { kind: 'block', type: 'bit_move' }, { kind: 'block', type: 'bit_turn' }] },
    { kind: 'category', name: '🧱 Build', colour: String(C.build), contents: [
      { kind: 'block', type: 'bit_place' }, { kind: 'block', type: 'bit_dig' }] },
    { kind: 'category', name: '🔁 Loops', colour: String(C.loops), contents: [
      { kind: 'block', type: 'bit_repeat' },
      { kind: 'block', type: 'bit_while', inputs: { COND: { block: { type: 'bit_not', inputs: { A: { block: { type: 'bit_detect' } } } } } } }] },
    { kind: 'category', name: '❓ Logic', colour: String(C.logic), contents: [
      { kind: 'block', type: 'bit_if', inputs: { COND: { block: { type: 'bit_detect' } } } },
      { kind: 'block', type: 'bit_detect' }, { kind: 'block', type: 'bit_is' }, { kind: 'block', type: 'bit_not' }] },
    { kind: 'category', name: '💬 Talk', colour: String(C.talk), contents: [{ kind: 'block', type: 'bit_say' }] },
  ],
};

// ---------- workspace -> program ----------
function stmtList(block) {
  const out = [];
  for (let b = block; b; b = b.getNextBlock()) {
    if (b.isEnabled && !b.isEnabled()) continue;
    const s = stmt(b);
    if (s) out.push(s);
  }
  return out;
}

function stmt(b) {
  const id = b.id;
  const num = (name, d) => Number(b.getFieldValue(name) ?? d);
  const blk = (v) => (v === 'held' ? 'held' : Number(v));
  switch (b.type) {
    case 'bit_move': return { id, op: 'move', dir: b.getFieldValue('DIR'), n: num('N', 1) };
    case 'bit_turn': return { id, op: 'turn', dir: b.getFieldValue('DIR') };
    case 'bit_dig': return { id, op: 'dig', dir: b.getFieldValue('DIR') };
    case 'bit_place': return { id, op: 'place', dir: b.getFieldValue('DIR'), block: blk(b.getFieldValue('BLOCK')) };
    case 'bit_say': return { id, op: 'say', text: b.getFieldValue('TEXT') };
    case 'bit_repeat': return { id, op: 'repeat', times: num('N', 1), body: stmtList(b.getInputTargetBlock('DO')) };
    case 'bit_while': return { id, op: 'while', cond: cond(b.getInputTargetBlock('COND')), body: stmtList(b.getInputTargetBlock('DO')) };
    case 'bit_if': return { id, op: 'if', cond: cond(b.getInputTargetBlock('COND')), then: stmtList(b.getInputTargetBlock('THEN')), else: stmtList(b.getInputTargetBlock('ELSE')) };
    default: return null;
  }
}

function cond(b) {
  if (!b) return null;
  switch (b.type) {
    case 'bit_detect': return { op: 'detect', dir: b.getFieldValue('DIR') };
    case 'bit_is': return { op: 'is', dir: b.getFieldValue('DIR'), block: Number(b.getFieldValue('BLOCK')) };
    case 'bit_not': return { op: 'not', a: cond(b.getInputTargetBlock('A')) };
    default: return null;
  }
}

/** Program from the blocks under the "when I press Run" block (or all top stacks if there is none). */
export function workspaceToProgram(ws) {
  const tops = ws.getTopBlocks(true);
  const start = tops.find((b) => b.type === 'bit_start');
  if (start) return stmtList(start.getNextBlock());
  return tops.filter((b) => b.previousConnection).flatMap((b) => stmtList(b));
}

// ---------- program -> workspace JSON ----------
function toBlock(list) {
  let first = null, prev = null;
  for (const s of list || []) {
    const b = stmtJSON(s);
    if (!b) continue;
    if (!first) first = b; else prev.next = { block: b };
    prev = b;
  }
  return first;
}

function stmtJSON(s) {
  const f = (fields, inputs) => ({ fields, ...(inputs ? { inputs } : {}) });
  const stack = (list) => { const b = toBlock(list); return b ? { block: b } : undefined; };
  const clean = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };
  switch (s.op) {
    case 'move': return { type: 'bit_move', ...f({ DIR: s.dir, N: s.n ?? 1 }) };
    case 'turn': return { type: 'bit_turn', ...f({ DIR: s.dir }) };
    case 'dig': return { type: 'bit_dig', ...f({ DIR: s.dir || 'forward' }) };
    case 'place': return { type: 'bit_place', ...f({ DIR: s.dir || 'forward', BLOCK: String(s.block ?? 'held') }) };
    case 'say': return { type: 'bit_say', ...f({ TEXT: s.text ?? '' }) };
    case 'repeat': return { type: 'bit_repeat', fields: { N: s.times }, inputs: clean({ DO: stack(s.body) }) };
    case 'while': return { type: 'bit_while', inputs: clean({ COND: condJSON(s.cond), DO: stack(s.body) }) };
    case 'if': return { type: 'bit_if', inputs: clean({ COND: condJSON(s.cond), THEN: stack(s.then), ELSE: stack(s.else) }) };
    default: return null;
  }
}

function condJSON(c) {
  if (!c) return undefined;
  if (c.op === 'detect') return { block: { type: 'bit_detect', fields: { DIR: c.dir } } };
  if (c.op === 'is') return { block: { type: 'bit_is', fields: { DIR: c.dir, BLOCK: String(c.block) } } };
  if (c.op === 'not') { const a = condJSON(c.a); return { block: { type: 'bit_not', ...(a ? { inputs: { A: a } } : {}) } }; }
  return undefined;
}

export function programToWorkspaceJSON(program) {
  const body = toBlock(program);
  return { blocks: { languageVersion: 0, blocks: [{ type: 'bit_start', x: 24, y: 24, ...(body ? { next: { block: body } } : {}) }] } };
}

// ---------- "see the code" ----------
const blockName = (b) => (b === 'held' || b == null ? 'bit.heldBlock()' : `"${(BLOCKS[b]?.name || 'air').toLowerCase()}"`);
function condText(c) {
  if (!c) return 'false';
  if (c.op === 'not') return `!${condText(c.a)}`;
  if (c.op === 'detect') return `bit.detect('${c.dir}')`;
  if (c.op === 'is') return `bit.inspect('${c.dir}') === ${blockName(c.block)}`;
  return 'false';
}

export function programToText(program, indent = '', depth = 0) {
  const lines = [];
  const v = 'ijk'[depth] || `i${depth}`;
  for (const s of program || []) {
    switch (s.op) {
      case 'move': lines.push(`${indent}bit.move('${s.dir}', ${s.n ?? 1});`); break;
      case 'turn': lines.push(`${indent}bit.turn('${s.dir}');`); break;
      case 'dig': lines.push(`${indent}bit.dig('${s.dir}');`); break;
      case 'place': lines.push(`${indent}bit.place(${blockName(s.block)}, '${s.dir}');`); break;
      case 'say': lines.push(`${indent}bit.say(${JSON.stringify(s.text ?? '')});`); break;
      case 'repeat':
        lines.push(`${indent}for (let ${v} = 0; ${v} < ${s.times}; ${v}++) {`, programToText(s.body, indent + '  ', depth + 1), `${indent}}`); break;
      case 'while':
        lines.push(`${indent}while (${condText(s.cond)}) {`, programToText(s.body, indent + '  ', depth), `${indent}}`); break;
      case 'if':
        lines.push(`${indent}if (${condText(s.cond)}) {`, programToText(s.then, indent + '  ', depth));
        if (s.else?.length) lines.push(`${indent}} else {`, programToText(s.else, indent + '  ', depth));
        lines.push(`${indent}}`); break;
      default: break;
    }
  }
  return lines.filter((l) => l !== '').join('\n');
}
