// Side panel for Bit the robot: a Blockly code editor (loaded on first open),
// Run / Stop, speed, starter programs you can load and change, a "see the
// code" view, and Put Bit away. Falls back to starter programs if Blockly
// can't load (e.g. offline).
import { EXAMPLES } from './robot.js';
import { loadBlockly, defineBlocks, TOOLBOX, workspaceToProgram, programToWorkspaceJSON, programToText } from './robotblocks.js';

const $ = (id) => document.getElementById(id);

export class RobotUI {
  /**
   * @param {object} o { getRobot(), onPutAway(), onRun(name, program), onClose(), onChange() }
   */
  constructor(o) {
    Object.assign(this, o);
    this.ws = null;
    this.savedState = null; // workspace JSON to restore (kept even before Blockly loads)
    this.showCode = false;
    this.blocklyFailed = false;

    const list = $('rb-examples');
    for (const ex of EXAMPLES) {
      const b = document.createElement('button');
      b.className = 'rb-ex';
      b.textContent = ex.name;
      b.title = 'Load this program into the editor and run it';
      b.addEventListener('click', () => this.loadExample(ex));
      list.appendChild(b);
    }
    $('rb-run').addEventListener('click', () => this.runEditor());
    $('rb-stop').addEventListener('click', () => { this.getRobot().stop(); this.refresh(); });
    $('rb-away').addEventListener('click', () => this.onPutAway());
    $('rb-close').addEventListener('click', () => this.onClose());
    $('rb-clear').addEventListener('click', () => {
      if (!this.ws || !confirm('Clear all the blocks?')) return;
      this.setProgram([]);
    });
    $('rb-code-toggle').addEventListener('click', () => { this.showCode = !this.showCode; this.refresh(); });
    for (const btn of document.querySelectorAll('[data-speed]')) {
      btn.addEventListener('click', () => { this.getRobot().speed = +btn.dataset.speed; this.refresh(); });
    }
    setInterval(() => { if (this.isOpen) this.refresh(); }, 250);
  }

  // ---------- editor ----------
  async ensureEditor() {
    if (this.ws || this.blocklyFailed) return this.ws;
    $('rb-editor-note').textContent = 'Loading the code blocks…';
    try {
      const Blockly = await loadBlockly();
      defineBlocks(Blockly);
      this.ws = Blockly.inject($('rb-blockly'), {
        toolbox: TOOLBOX,
        trashcan: true,
        zoom: { controls: true, wheel: false, startScale: 0.85, minScale: 0.5, maxScale: 1.6 },
        move: { scrollbars: true, drag: true, wheel: true },
        renderer: 'zelos', // rounded, chunky blocks that are easy for small hands
        theme: Blockly.Themes.Zelos || undefined,
        sounds: false,
      });
      if (this.savedState) {
        try { Blockly.serialization.workspaces.load(this.savedState, this.ws); } catch { this.setProgram([]); }
      } else this.setProgram(EXAMPLES.find((e) => e.id === 'square').program);
      this.ws.addChangeListener((e) => {
        if (e.isUiEvent) return;
        this.savedState = Blockly.serialization.workspaces.save(this.ws);
        this.onChange?.();
        if (this.showCode) this.renderCode();
      });
      $('rb-editor-note').textContent = 'Drag blocks from the menu and snap them under “when I press Run”.';
    } catch {
      this.blocklyFailed = true;
      $('rb-editor-note').textContent = 'The code blocks could not load (are you offline?). You can still run the starter programs below.';
      $('rb-blockly').classList.add('hidden');
    }
    this.refresh();
    return this.ws;
  }

  setProgram(program) {
    if (!this.ws) return;
    window.Blockly.serialization.workspaces.load(programToWorkspaceJSON(program), this.ws);
    this.savedState = window.Blockly.serialization.workspaces.save(this.ws);
    this.onChange?.();
  }

  getProgram() { return this.ws ? workspaceToProgram(this.ws) : []; }

  /** Workspace state for saving with the world. */
  getState() { return this.ws ? window.Blockly.serialization.workspaces.save(this.ws) : this.savedState; }

  setState(state) {
    this.savedState = state || null;
    if (this.ws && window.Blockly) {
      if (state) { try { window.Blockly.serialization.workspaces.load(state, this.ws); } catch { /* ignore broken saves */ } }
      else this.setProgram(EXAMPLES.find((e) => e.id === 'square').program);
    }
  }

  async loadExample(ex) {
    await this.ensureEditor();
    if (this.ws) this.setProgram(ex.program);
    this.run(ex.program, ex.name);
  }

  runEditor() {
    if (!this.ws) return;
    const program = this.getProgram();
    if (!program.length) { this.getRobot().say('Snap some blocks under “when I press Run”!', 3); this.refresh(); return; }
    this.run(program, 'my program');
  }

  run(program, name) {
    const r = this.getRobot();
    if (r.run(program)) this.onRun?.(name, program);
    this.refresh();
  }

  /** Highlight the block Bit is doing right now. */
  highlight(id) {
    if (!this.ws) return;
    this.ws.highlightBlock(id || null);
  }

  // ---------- panel ----------
  open() {
    $('robot-panel').classList.remove('hidden');
    this.refresh();
    this.ensureEditor().then(() => { if (this.ws) window.Blockly.svgResize(this.ws); });
  }

  close() { $('robot-panel').classList.add('hidden'); }
  get isOpen() { return !$('robot-panel').classList.contains('hidden'); }

  renderCode() {
    const text = programToText(this.getProgram());
    $('rb-code').textContent = text || '// Snap some blocks under “when I press Run”';
  }

  refresh() {
    const r = this.getRobot();
    const text = {
      idle: 'Bit is ready. Press ▶ Run!',
      running: `Running… step ${r.actions}`,
      done: 'All done! 🎉',
      stopped: 'Stopped.',
      error: r.message || 'Oops!',
    }[r.status];
    $('rb-status').textContent = text;
    $('rb-status').className = 'rb-status ' + r.status;
    $('rb-stop').disabled = !r.running;
    $('rb-run').disabled = !this.ws || r.running;
    if (!r.running) this.highlight(null);
    for (const btn of document.querySelectorAll('[data-speed]')) btn.classList.toggle('on', +btn.dataset.speed === r.speed);
    $('rb-code').classList.toggle('hidden', !this.showCode);
    $('rb-code-toggle').textContent = this.showCode ? 'Hide the code' : '👀 See the code';
    if (this.showCode) this.renderCode();
  }
}
