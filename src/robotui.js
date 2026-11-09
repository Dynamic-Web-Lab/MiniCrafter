// Side panel for Bit the robot: run starter programs, change speed, stop,
// and put Bit away. (The Blockly code editor plugs into this panel.)
import { EXAMPLES } from './robot.js';

const $ = (id) => document.getElementById(id);

export class RobotUI {
  /**
   * @param {object} o { getRobot(), onPutAway(), onRun(name), onClose() }
   */
  constructor(o) {
    Object.assign(this, o);
    const list = $('rb-examples');
    for (const ex of EXAMPLES) {
      const b = document.createElement('button');
      b.className = 'rb-ex';
      b.textContent = ex.name;
      b.addEventListener('click', () => this.runProgram(ex.program, ex.name));
      list.appendChild(b);
    }
    $('rb-stop').addEventListener('click', () => { this.getRobot().stop(); this.refresh(); });
    $('rb-away').addEventListener('click', () => this.onPutAway());
    $('rb-close').addEventListener('click', () => this.onClose());
    for (const btn of document.querySelectorAll('[data-speed]')) {
      btn.addEventListener('click', () => { this.getRobot().speed = +btn.dataset.speed; this.refresh(); });
    }
    setInterval(() => { if (!$('robot-panel').classList.contains('hidden')) this.refresh(); }, 250);
  }

  runProgram(program, name) {
    const r = this.getRobot();
    if (r.run(program)) this.onRun?.(name, program);
    this.refresh();
  }

  open() { $('robot-panel').classList.remove('hidden'); this.refresh(); }
  close() { $('robot-panel').classList.add('hidden'); }
  get isOpen() { return !$('robot-panel').classList.contains('hidden'); }

  refresh() {
    const r = this.getRobot();
    const text = {
      idle: 'Bit is ready. Pick a program!',
      running: `Running… step ${r.actions}`,
      done: 'All done! 🎉',
      stopped: 'Stopped.',
      error: r.message || 'Oops!',
    }[r.status];
    $('rb-status').textContent = text;
    $('rb-status').className = 'rb-status ' + r.status;
    $('rb-stop').disabled = !r.running;
    for (const btn of document.querySelectorAll('[data-speed]')) btn.classList.toggle('on', +btn.dataset.speed === r.speed);
  }
}
