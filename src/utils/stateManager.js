import { USER_STATE } from './constants.js';

class StateManager {
  constructor() {
    this.userStates = {};
    this.SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  }

  getState(jid) {
    const entry = this.userStates[jid];

    if (entry && Date.now() - entry.timestamp > this.SESSION_TIMEOUT) {
      this.setState(jid, USER_STATE.IDLE);
      return USER_STATE.IDLE;
    }

    return entry?.state || USER_STATE.IDLE;
  }

  getContext(jid) {
    const entry = this.userStates[jid];

    if (entry && Date.now() - entry.timestamp > this.SESSION_TIMEOUT) {
      this.setState(jid, USER_STATE.IDLE);
      return null;
    }

    return entry?.context || null;
  }

  setState(jid, newState, context = null) {
    this.userStates[jid] = {
      state: newState,
      context: newState === USER_STATE.IDLE ? null : context,
      timestamp: Date.now()
    };
  }

  clearState(jid) {
    delete this.userStates[jid];
  }

  getAllStates() {
    return this.userStates;
  }
}

export default new StateManager();
