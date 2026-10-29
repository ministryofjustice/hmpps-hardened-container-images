const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const managers = ['apk', 'npm', 'npx', 'yarn', 'yarnpkg', 'corepack', 'pnpm'];

function countVulnerabilities(report) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  const reports = Array.isArray(report) ? report : [report];
  if (!reports.length) throw new Error('Empty Snyk report');
  function countResult(result) {
    if (!result || typeof result !== 'object' || Array.isArray(result) ||
        result.error || !Array.isArray(result.vulnerabilities)) {
      throw new Error('Snyk report does not contain a successful vulnerability result');
    }
    for (const vulnerability of result.vulnerabilities) {
      if (!vulnerability || !Object.hasOwn(counts, vulnerability.severity)) {
        throw new Error(`Unknown vulnerability severity: ${vulnerability?.severity}`);
      }
      counts[vulnerability.severity]++;
    }
    if (Object.hasOwn(result, 'applications')) {
      if (!Array.isArray(result.applications)) throw new Error('Invalid Snyk applications result');
      for (const application of result.applications) countResult(application);
    }
  }
  for (const result of reports) countResult(result);
  return counts;
}

function validateVersions(result, major, npmMajor, backend) {
  if (result.node.split('.')[0] !== `v${major}`) {
    throw new Error(`Expected Node ${major}, got ${result.node}`);
  }
  if (npmMajor) {
    if (result.npm?.split('.')[0] !== String(npmMajor) ||
        !result.managers.apk || !result.managers.npx) {
      throw new Error(`Expected npm ${npmMajor}, npx and apk: ${JSON.stringify(result)}`);
    }
  } else if (Object.values(result.managers).some(Boolean)) {
    throw new Error(`Runtime contains a package manager: ${JSON.stringify(result.managers)}`);
  }
}

function probeRuntime(image) {
  const probe = `
    const { spawnSync } = require('node:child_process');
    const managers = Object.fromEntries(${JSON.stringify(managers)}.map(name =>
      [name, spawnSync('/bin/sh', ['-c', 'command -v ' + name]).status === 0]));
    let npm = null;
    if (managers.npm) {
      const version = spawnSync('npm', ['--version'], { encoding: 'utf8' });
      if (version.status !== 0) throw new Error(version.stderr);
      npm = version.stdout.trim();
    }
    console.log(JSON.stringify({node: process.version, runtimeArchitecture: process.arch, npm, managers}));
  `;
  const runtime = JSON.parse(execFileSync('docker', [
    'run', '--rm', '--platform', 'linux/amd64', '--user', '0:0', '--entrypoint', 'node', image, '-e', probe,
  ], { encoding: 'utf8' }));
  if (runtime.runtimeArchitecture !== 'x64') throw new Error('Comparison requires an AMD64 Node executable');
  return runtime;
}

function collect(env) {
  const { IMAGE_REF, COMPARISON, BACKEND, NODE_MAJOR, NPM_MAJOR, BUILD_SECONDS, OUTPUT_DIR } = env;
  for (const name of ['IMAGE_REF', 'COMPARISON', 'BACKEND', 'NODE_MAJOR', 'BUILD_SECONDS', 'OUTPUT_DIR']) {
    if (!env[name]) throw new Error(`Missing ${name}`);
  }
  const inspection = JSON.parse(execFileSync('docker', ['image', 'inspect', IMAGE_REF], { encoding: 'utf8' }))[0];
  const runtime = probeRuntime(IMAGE_REF);
  validateVersions(runtime, NODE_MAJOR, NPM_MAJOR, BACKEND);
  const seconds = Number(BUILD_SECONDS);
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid build duration');
  const result = {
    comparison: COMPARISON, backend: BACKEND, image: IMAGE_REF,
    architecture: inspection.Architecture, bytes: inspection.Size, seconds,
    ...runtime,
    vulnerabilities: null,
    scanStatus: env.SCAN_STATUS || 'unavailable',
  };
  if (result.architecture !== 'amd64') throw new Error('Comparison requires AMD64 images');
  if (result.scanStatus === 'success') {
    result.vulnerabilities = countVulnerabilities(JSON.parse(fs.readFileSync('snyk-results.json', 'utf8')));
  } else {
    console.error(`::warning::${COMPARISON}/${BACKEND}: vulnerability scan ${result.scanStatus}; counts unavailable`);
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, `${COMPARISON}-${BACKEND}.json`), JSON.stringify(result, null, 2));
}

const comparisonFlavours = ['build-24-npm11', 'build-24-npm12', 'build-26-npm12', 'runtime-24', 'runtime-26'];

function summary(results, flavourFilter) {
  if (flavourFilter !== undefined && !comparisonFlavours.includes(flavourFilter)) {
    throw new Error(`Unknown comparison flavour: ${flavourFilter}`);
  }
  const lines = [
    `## Node image comparison (AMD64)${flavourFilter ? `: ${flavourFilter}` : ''}`,
    '',
    '| Flavour | Build | Node | npm | Package managers present | Size (MiB) | Build (s) | Critical | High | Medium | Low | Snyk comparison |',
    '|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---|',
  ];
  const expected = flavourFilter ? [flavourFilter] : comparisonFlavours;
  for (const flavour of expected) {
    const pair = {};
    for (const backend of ['docker', 'apko']) {
      const matches = results.filter(r => r.comparison === flavour && r.backend === backend);
      if (matches.length > 1) throw new Error(`Duplicate metrics for ${flavour}/${backend}`);
      pair[backend] = matches[0];
    }
    const indicators = { docker: 'Cannot compare', apko: 'Cannot compare' };
    const severities = ['critical', 'high', 'medium', 'low'];
    const available = ['docker', 'apko'].every(backend =>
      pair[backend]?.vulnerabilities && (!pair[backend].scanStatus || pair[backend].scanStatus === 'success'));
    if (available) {
      for (const backend of ['docker', 'apko']) {
        for (const severity of severities) {
          const count = pair[backend].vulnerabilities[severity];
          if (!Number.isSafeInteger(count) || count < 0) {
            throw new Error(`Invalid ${severity} count for ${flavour}/${backend}`);
          }
        }
      }
      const difference = severities.find(severity =>
        pair.docker.vulnerabilities[severity] !== pair.apko.vulnerabilities[severity]);
      if (!difference) {
        indicators.docker = indicators.apko = 'Tie';
      } else {
        const winner = pair.docker.vulnerabilities[difference] < pair.apko.vulnerabilities[difference] ? 'docker' : 'apko';
        indicators[winner] = '✅ Fewer findings';
        indicators[winner === 'docker' ? 'apko' : 'docker'] = 'More findings';
      }
    }
    for (const backend of ['docker', 'apko']) {
      const r = pair[backend];
      if (!r) {
        lines.push(`| ${flavour} | ${backend} | **Missing / failed build** | - | - | - | - | - | - | - | - | Cannot compare |`);
        continue;
      }
      const present = managers.filter(name => r.managers[name]).join(', ') || 'none';
      const v = r.vulnerabilities;
      lines.push(`| ${flavour} | ${backend} | ${r.node} | ${r.npm || 'none'} | ${present} | ${(r.bytes / 1048576).toFixed(1)} | ${r.seconds} | ${v?.critical ?? 'N/A'} | ${v?.high ?? 'N/A'} | ${v?.medium ?? 'N/A'} | ${v?.low ?? 'N/A'} | ${indicators[backend]} |`);
    }
  }
  lines.push('', 'Size is the local Docker image inspect Size field, measured with the same storage driver for both backends. Build duration includes cache restoration, package/image assembly and publishing, but excludes security scanning.',
    '', 'Vulnerability counts include both Snyk OS findings and nested application dependency findings at threshold low, not unique CVEs. Repeated dependency paths are counted separately. N/A means the scan was unavailable or failed, never zero findings.',
    '', '✅ marks the counterpart with fewer Snyk findings, comparing critical first, then high, medium and low (not total findings). Equal counts are a Tie; missing or unsuccessful scans Cannot compare. This is not an overall security rating.',
    '', 'Alpine release, dependency versions and cache warmth can differ; this is a measured comparison, not a feature-parity or vulnerability-reduction guarantee.',
    '', 'Version/package-manager probes run as numeric UID 0 to inspect all baselines consistently; they do not validate the default container user.',
    '', 'Both Docker and apko runtime comparisons enforce no package managers.');
  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  const [command, directory, flavour] = process.argv.slice(2);
  if (command === 'collect') collect(process.env);
  else if (command === 'validate') {
    const { IMAGE_REF, NODE_MAJOR, NPM_MAJOR, BACKEND } = process.env;
    if (!IMAGE_REF || !NODE_MAJOR || !BACKEND) throw new Error('validate requires IMAGE_REF, NODE_MAJOR and BACKEND');
    validateVersions(probeRuntime(IMAGE_REF), NODE_MAJOR, NPM_MAJOR, BACKEND);
  }
  else if (command === 'summary' && directory) {
    const results = fs.readdirSync(directory).filter(name => name.endsWith('.json')).map(name =>
      JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
    process.stdout.write(summary(results, flavour));
  } else throw new Error('Usage: node scripts/node-image-metrics.cjs validate | collect | summary <metrics-directory> [flavour]');
}

module.exports = { countVulnerabilities, validateVersions, summary };
