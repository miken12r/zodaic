// Dynamic config (replaces the old static app.json) so development/preview builds get
// their own bundle identifier and app name, distinct from the production/TestFlight
// build. Without this, builds shared one bundle ID and iOS only allows one installed app
// per bundle ID — installing one silently overwrote another on-device.
//
// Deliberately keyed on APP_VARIANT (set via eas.json's build.<profile>.env), NOT
// EAS_BUILD_PROFILE — the latter is only set *inside* the cloud build container, not
// during eas build's local credential-resolution phase on your machine. That mismatch
// caused a real failure: the local phase resolved the prod bundle ID/target name and
// fetched credentials for it, while the cloud phase (where EAS_BUILD_PROFILE was set)
// generated the native project under the dev name — "Could not find target 'ZodAIc' in
// project.pbxproj". APP_VARIANT is resolved identically in both places.
const VARIANT = process.env.APP_VARIANT // 'development' | 'preview' | undefined (production)

const BASE_BUNDLE_ID = 'online.ai4society.zodaic'
const bundleId = VARIANT ? `${BASE_BUNDLE_ID}.${VARIANT}` : BASE_BUNDLE_ID
const appName = VARIANT ? `ZodAIc ${VARIANT === 'development' ? 'Dev' : 'Preview'}` : 'ZodAIc'

module.exports = {
  expo: {
    name: appName,
    slug: 'zodaic',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'zodaic',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0d0d1a',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: bundleId,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0d0d1a',
      },
      package: bundleId,
    },
    plugins: ['expo-router', 'expo-asset'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'd0362822-b2c5-4f01-b162-8c1a1df468e4',
      },
    },
    owner: 'ai-for-society',
  },
}
