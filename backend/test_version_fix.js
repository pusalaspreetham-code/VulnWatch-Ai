const vm = require('./src/services/version_matcher.service');

// Test cleaning
console.log('cleanUpstreamVersion:');
console.log('16-150400.4.9.2 =>', vm.cleanUpstreamVersion('16-150400.4.9.2'));
console.log('15.5-150200.5.19.1 =>', vm.cleanUpstreamVersion('15.5-150200.5.19.1'));
console.log('0:18.7-0.1.hum1 =>', vm.cleanUpstreamVersion('0:18.7-0.1.hum1'));

// Test comparison
console.log('compareVersions 19.0 vs 16-150400.4.9.2:', vm.compareVersions('19.0', '16-150400.4.9.2'));
console.log('compareVersions 13.6 vs 16-150400.4.9.2:', vm.compareVersions('13.6', '16-150400.4.9.2'));

