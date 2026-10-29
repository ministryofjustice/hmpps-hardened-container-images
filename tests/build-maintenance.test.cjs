const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('Renovate extracts current apko and Melange pins without treating majors as full versions', () => {
  const config = JSON.parse(fs.readFileSync('renovate.json', 'utf8'));
  const cases = [
    ['images/node/alpine-runtime/apko.yaml', 2, /^\d+-r\d+$/],
    ['images/node/alpine/melange.npm11.yaml', 1, /^11\.\d+\.\d+$/],
    ['images/node/alpine/melange.npm12.yaml', 1, /^12\.\d+\.\d+$/],
    ['images/node/alpine-runtime/melange.scanners.yaml', 6, /^v\d+\.\d+\.\d+$/],
  ];
  for (const [file, count, versionPattern] of cases) {
    const values = config.customManagers.flatMap(manager => {
      if (!manager.managerFilePatterns.some(pattern => new RegExp(pattern.slice(1, -1)).test(file))) return [];
      return manager.matchStrings.flatMap(pattern =>
        [...fs.readFileSync(file, 'utf8').matchAll(new RegExp(pattern, 'g'))].map(match => match.groups.currentValue));
    });
    assert.equal(values.length, count, file);
    for (const value of values) assert.match(value, versionPattern);
  }
  const rules = config.packageRules.filter(rule => rule.matchManagers?.includes('custom.regex'));
  assert.ok(rules.some(rule => rule.automerge === false));
  assert.ok(rules.some(rule => rule.allowedVersions === '>=11.0.0 <12.0.0'));
  assert.ok(rules.some(rule => rule.allowedVersions === '>=12.0.0 <13.0.0'));
});

test('quiet builds retain full output without flooding successful logs', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-build-'));
  try {
    const log = path.join(directory, 'success.log');
    const result = spawnSync('bash', ['scripts/quiet-build.sh', log, 'bash', '-c', 'echo verbose; echo diagnostic >&2'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /verbose|diagnostic/);
    assert.match(fs.readFileSync(log, 'utf8'), /verbose\ndiagnostic/);
    const failure = spawnSync('bash', ['scripts/quiet-build.sh', path.join(directory, 'failure.log'), 'bash', '-c', 'echo cause >&2; exit 17'], { encoding: 'utf8' });
    assert.equal(failure.status, 17);
    assert.match(failure.stderr, /cause/);
    assert.match(failure.stderr, /exit 17/);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test('scanner compilation is native, parallel and independent of other images', () => {
  const workflow = JSON.parse(execFileSync('ruby', [
    '-ryaml', '-rjson', '-e',
    'puts JSON.generate(YAML.safe_load(File.read(ARGV[0]), aliases: true))',
    '.github/workflows/build-images.yml',
  ]));
  const native = workflow.jobs['build-native-scanners'];
  assert.deepEqual(native.strategy.matrix.include, [
    { arch: 'x86_64', runner: 'ubuntu-24.04' },
    { arch: 'aarch64', runner: 'ubuntu-24.04-arm' },
  ]);
  assert.equal(native.needs, 'test-node-flavours');
  assert.ok(!native.steps.some(step => step.uses?.startsWith('docker/setup-qemu-action')));
  const cache = native.steps.find(step => step.id === 'cache');
  assert.match(cache.with['restore-keys'], /native-scanners-v1-\$\{\{ runner.os \}\}-\$\{\{ runner.arch \}\}-\n$/);
  const upload = native.steps.find(step => step.name === 'Upload signed APK and public key');
  assert.match(upload.with.path, /scanner-keys\/\*\.pub/);
  assert.doesNotMatch(upload.with.path, /scanner-keys\/\*\s|melange\.rsa\s/);
  const publish = workflow.jobs['publish-scanners'];
  assert.equal(publish.needs, 'build-native-scanners');
  assert.deepEqual(publish.steps, workflow.jobs['build-scan-push'].steps);
  const build = publish.steps.find(step => step.name === 'Build signed Melange APKs');
  assert.match(build.if, /!matrix.scanners/);
  assert.equal(workflow.jobs['build-scan-push'].needs, 'test-node-flavours');
  assert.equal(workflow.jobs['compare-node-images'].needs, 'build-scan-push');
});

test('Melange build helper selects only requested architectures and propagates failures', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'native-melange-test-'));
  try {
    const docker = path.join(directory, 'docker');
    fs.writeFileSync(docker, '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$DOCKER_CALLS"\nexit "${DOCKER_STATUS:-0}"\n', { mode: 0o755 });
    const env = {
      ...process.env, PATH: `${directory}:${process.env.PATH}`,
      RUNNER_TEMP: directory, GITHUB_WORKSPACE: process.cwd(),
      MELANGE_CONFIG: 'images/node/alpine-runtime/melange.scanners.yaml',
      MELANGE_ARCHES: 'aarch64', DOCKER_CALLS: path.join(directory, 'calls'),
    };
    const result = spawnSync('bash', ['scripts/build-melange.sh'], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const calls = fs.readFileSync(env.DOCKER_CALLS, 'utf8');
    assert.equal(calls.trim().split('\n').length, 2);
    assert.match(calls, /build --arch aarch64/);
    assert.doesNotMatch(calls, /--arch x86_64/);
    assert.ok(fs.existsSync(path.join(directory, 'scanner-cache/apk')));
    const failure = spawnSync('bash', ['scripts/build-melange.sh'], {
      env: { ...env, DOCKER_STATUS: '17' }, encoding: 'utf8',
    });
    assert.equal(failure.status, 17);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});
