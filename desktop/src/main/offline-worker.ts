import { stdin, stdout } from 'node:process';

async function main() {
  let task = '';
  stdin.setEncoding('utf8');
  for await (const chunk of stdin) task += chunk;
  const name = process.argv[2] === 'codex' ? 'Codex' : 'DeepSeek';
  stdout.write(`[${name} · 离线模拟] 已收到任务（${task.length} 字符）。\n`);
}

void main().catch(() => { process.exitCode = 1; });
