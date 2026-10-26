// Keeps Android builds within the memory of a standard cloud builder.
// Compiling Skia, the worklets runtime and Reanimated in parallel can exhaust
// it (the compiler or the Gradle daemon gets killed), so cap the number of
// parallel workers and leave headroom outside the JVM heap for the C++ jobs.
const { withGradleProperties } = require('@expo/config-plugins');

const PROPS = {
  'org.gradle.workers.max': '2',
  'org.gradle.parallel': 'false',
  'org.gradle.jvmargs': '-Xmx3g -XX:MaxMetaspaceSize=768m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8',
};

module.exports = function withLeanGradle(config) {
  return withGradleProperties(config, (c) => {
    for (const [key, value] of Object.entries(PROPS)) {
      c.modResults = c.modResults.filter((p) => !(p.type === 'property' && p.key === key));
      c.modResults.push({ type: 'property', key, value });
    }
    return c;
  });
};
