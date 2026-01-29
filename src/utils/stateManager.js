import { USER_STATE } from './constants.js';

class StateManager {
  constructor() {
    this.userStates = {};
    this.SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  }

  getState(phoneNumber) {
    const state = this.userStates[phoneNumber];
    
    // Auto cleanup jika timeout
    if (state && Date.now() - state.timestamp > this.SESSION_TIMEOUT) {
      this.setState(phoneNumber, USER_STATE.IDLE);
      return USER_STATE.IDLE;
    }
    
    return state?.state || USER_STATE.IDLE;
  }

  setState(phoneNumber, newState) {
    this.userStates[phoneNumber] = {
      state: newState,
      timestamp: Date.now()
    };
  }

  clearState(phoneNumber) {
    delete this.userStates[phoneNumber];
  }

  getAllStates() {
    return this.userStates;
  }
}

export default new StateManager();