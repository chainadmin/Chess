/**
 * The app is locked to portrait, which makes Android imply a *required*
 * android.hardware.screen.portrait feature. Google Play then hides the app from
 * tablets, Chromebooks, Play Games on PC and XR devices. Declaring the screen
 * features as optional keeps the portrait layout but lets every device install it.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const OPTIONAL_FEATURES = ['android.hardware.screen.portrait', 'android.hardware.screen.landscape'];

module.exports = function withOptionalScreenFeatures(config) {
  return withAndroidManifest(config, mod => {
    const manifest = mod.modResults.manifest;
    const features = (manifest['uses-feature'] ??= []);
    for (const name of OPTIONAL_FEATURES) {
      const existing = features.find(feature => feature.$['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return mod;
  });
};
