// Prépare la coquille pour une appli donnée avant la fabrication : node preparer.js origami | compta | tickets | frais
// La même coquille sert à toutes : seuls changent le nom, l'identité, l'icône et l'adresse ouverte.
// Compta, Tickets et Frais ouvrent la page Origami en « fenêtre d'une seule appli » : mêmes échanges que dans Origami, sans le volet.
// Frais : la fenêtre demande une fois le lien personnel, puis laisse la place à la page Frais.
const fs = require('fs'), path = require('path');
const PAGE = 'https://sevanegu-pixel.github.io/origami/accueil/';
const APPLIS = {
  origami: { nom: 'Origami', identite: 'ch.origami.origami', adresse: PAGE, icone: 'icone-1024.png', texte: 'Origami · toutes les applis', fichier: 'Origami-Mac.dmg' },
  compta: { nom: 'Compta', identite: 'ch.origami.compta', adresse: PAGE + '?fenetre=compta', icone: 'icones/compta.png', texte: 'Compta Origami', fichier: 'Compta-Mac.dmg' },
  tickets: { nom: 'Tickets', identite: 'ch.origami.tickets', adresse: PAGE + '?fenetre=tickets', icone: 'icones/tickets.png', texte: 'Tickets Origami', fichier: 'Tickets-Mac.dmg' },
  frais: { nom: 'Frais', identite: 'ch.origami.frais', adresse: PAGE + '?fenetre=frais', icone: 'icones/frais.png', texte: 'Frais Origami', fichier: 'Frais-Mac.dmg' }
};
const a = APPLIS[process.argv[2]];
if (!a) { console.error('appli ? (' + Object.keys(APPLIS).join(', ') + ')'); process.exit(1); }
const ici = __dirname, conf = path.join(ici, 'src-tauri', 'tauri.conf.json'), page = path.join(ici, 'www', 'index.html');
const c = JSON.parse(fs.readFileSync(conf, 'utf8'));
c.productName = a.nom; c.identifier = a.identite; c.app.windows[0].title = a.nom; c.bundle.shortDescription = a.texte;
fs.writeFileSync(conf, JSON.stringify(c, null, 2) + '\n');
let h = fs.readFileSync(page, 'utf8');
const avant = 'var ADRESSE = "' + PAGE + '";';
if (h.split(avant).length !== 2) { console.error('adresse introuvable dans www/index.html'); process.exit(1); }
h = h.replace(avant, 'var ADRESSE = ' + JSON.stringify(a.adresse) + ';').replace('<title>Origami</title>', '<title>' + a.nom + '</title>').replace('<div class="marque">ORIGAMI</div>', '<div class="marque">' + a.nom.toUpperCase() + '</div>');
fs.writeFileSync(page, h);
fs.copyFileSync(path.join(ici, a.icone), path.join(ici, 'icone-appli.png'));
console.log(a.nom + ' : ' + a.adresse + ' -> ' + a.fichier);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'fichier=' + a.fichier + '\nnom=' + a.nom + '\n');
