// Ajoute la signature de la version « release » au projet Android créé par « tauri android init » (keystore.properties à côté).
//   node signature.mjs <app/build.gradle.kts>
import fs from 'node:fs';
const f = process.argv[2];
let t = fs.readFileSync(f, 'utf8');
function une(avant, apres, nom) {
  if (t.split(avant).length !== 2) { console.error('SIGNATURE : « ' + nom + ' » introuvable dans ' + f); process.exit(1); }
  t = t.replace(avant, () => apres);
}
une('import java.util.Properties\n', 'import java.util.Properties\nimport java.io.FileInputStream\n', 'import');
une('android {\n', 'android {\n' +
  '    signingConfigs {\n' +
  '        create("release") {\n' +
  '            val p = Properties()\n' +
  '            p.load(FileInputStream(rootProject.file("keystore.properties")))\n' +
  '            keyAlias = p["keyAlias"] as String\n' +
  '            keyPassword = p["password"] as String\n' +
  '            storeFile = file(p["storeFile"] as String)\n' +
  '            storePassword = p["password"] as String\n' +
  '        }\n' +
  '    }\n', 'android');
une('        getByName("release") {\n', '        getByName("release") {\n            signingConfig = signingConfigs.getByName("release")\n', 'release');
fs.writeFileSync(f, t);
console.log('signature posée');
