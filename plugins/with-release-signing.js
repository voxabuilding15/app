const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs local release builds (`./gradlew bundleRelease`) with your own upload keystore.
 *
 * Expo's generated project signs release builds with the public debug key, which Google Play
 * rejects. This reads the keystore from environment variables at build time (nothing secret is
 * ever written into the project) and refuses to build a release without it. On EAS Build the
 * credentials are managed by EAS, so the check is skipped there.
 */
const SIGNING_CONFIG = `
    signingConfigs {
        release {
            if (System.getenv('FOCUSFLOW_KEYSTORE_FILE')) {
                storeFile file(System.getenv('FOCUSFLOW_KEYSTORE_FILE'))
                storePassword System.getenv('FOCUSFLOW_KEYSTORE_PASSWORD')
                keyAlias System.getenv('FOCUSFLOW_KEY_ALIAS')
                keyPassword System.getenv('FOCUSFLOW_KEY_PASSWORD')
            }
        }
    }
`;

const GUARD = `
// A release signed with the debug key cannot be uploaded to Google Play, so never produce one.
gradle.taskGraph.whenReady { graph ->
    def building = graph.allTasks.any { it.name == 'bundleRelease' || it.name == 'assembleRelease' }
    if (building && !System.getenv('EAS_BUILD') && !System.getenv('FOCUSFLOW_KEYSTORE_FILE')) {
        throw new GradleException('Set FOCUSFLOW_KEYSTORE_FILE, FOCUSFLOW_KEYSTORE_PASSWORD, FOCUSFLOW_KEY_ALIAS and FOCUSFLOW_KEY_PASSWORD to sign the release build (see docs/RELEASE.md).')
    }
}
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let gradle = modConfig.modResults.contents;
    if (gradle.includes('FOCUSFLOW_KEYSTORE_FILE')) {
      return modConfig;
    }
    // Add a release signing config next to the debug one, and use it for release builds.
    gradle = gradle.replace(
      /signingConfigs \{\s*debug \{/,
      (match) => `${SIGNING_CONFIG.trim()}\n    ${match}`,
    );
    gradle = gradle.replace(
      /(release \{\s*(?:\/\/[^\n]*\n\s*)*)signingConfig signingConfigs\.debug/,
      "$1signingConfig System.getenv('FOCUSFLOW_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    modConfig.modResults.contents = `${gradle}\n${GUARD}`;
    return modConfig;
  });
};
