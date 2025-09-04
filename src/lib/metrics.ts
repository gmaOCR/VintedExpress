// No-op logging and perf metrics
export function log(level: 'info' | 'debug' | 'warn', ...args: unknown[]) {
  void level;
  void args;
}

export function perf(key: string, action: 'start' | 'end') {
  void key;
  void action;
}
