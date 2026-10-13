# Passation — site de la Compagnie Origami

Document rédigé le 13 octobre 2026 pour reprendre le projet sans connaître l'échange précédent. Il distingue ce qui a été **fait**, ce qui a été **décidé**, et ce qui n'a **jamais été abordé** (signalé « non abordé »).

---

## 1. Objectif et contexte

**La compagnie.** Compagnie Origami (association Origami) : compagnie de cirque contemporain basée à Genève (Suisse), active depuis 2018. Spectacles en rue et en salle, tout public. Noyau artistique : Ella Beerli, Sévane Gurunlian, Julie Levrat. Comité de l'association : Théo Rossier (président), Delphine Combe (trésorière), Célia Arcos (secrétaire).

**Le projet.** Quitter Wix. Le site actuel est www.compagnieorigami.com, sur Wix. La propriétaire a choisi un site statique sur mesure, hébergé gratuitement chez Netlify. Sa demande initiale : une copie aussi fidèle que possible du design Wix (mise en page, couleurs, animations, version mobile), avec des améliorations :
- une page **Agenda** ;
- la **prochaine date** affichée sur l'accueil ;
- des **formulaires qui fonctionnent** (contact, newsletter) ;
- des **textes relus**.

**Public visé.** Non formalisé dans l'échange. D'après les contenus, il s'agit :
- des programmateurs et programmatrices (festivals, théâtres, communes), qui cherchent fiches techniques, dossiers et contact ;
- du public des spectacles, qui cherche les dates ;
- des partenaires et soutiens.

**Ce que le site doit faire :**
- présenter les spectacles ;
- donner les dates à venir et passées ;
- présenter l'équipe et l'historique ;
- remercier les collaborations et les soutiens ;
- permettre de contacter la compagnie et de s'inscrire à la newsletter.

---

## 2. État actuel

### Ce qui existe

Un site statique complet, **en ligne en test** sur Netlify : https://cerulean-clafoutis-b2da15.netlify.app. Le 13/10/2026, la version en ligne était la dernière version produite (section CSS « V9 », mise en page aérée).

Pages (fichiers dans `dist/`) :

| Fichier | Contenu |
|---|---|
| `index.html` | Accueil : ouverture « Bienvenue… / Nos projets en un coup d'œil » avec la prochaine date, puis un bloc par spectacle, puis le bandeau Cabaret |
| `spectacles.html` | Liste des spectacles |
| `commeunpoint.html`, `la-petite-fille-dans-la-poubelle.html`, `caborigamique.html`, `edmd.html`, `oups-vache.html`, `des-pates-au-seum.html`, `la-vouivre.html`, `lepetitcirquedescontes.html` | Une page par spectacle |
| `agenda.html` | « À venir » et « Déjà joué », groupés par année |
| `quisommesnous.html` | Compagnie, comité, portraits des artistes, historique |
| `collabs.html` | Collaborations (« Merci à vous »), « Nous ont soutenus », artistes par création |
| `contact.html` | Coordonnées, formulaire de contact, newsletter |
| `404.html` | Page d'erreur |

Fichiers techniques : `_redirects`, `sitemap.xml`, `robots.txt`, `favicon.svg`, `logo.svg`, `style.css`.

### Technologies

- **Générateur maison en Python 3**, sans dépendance :
  - `content.py` contient toutes les données (textes, spectacles, dates, artistes, collaborations, liens) ;
  - `build.py` produit les pages HTML dans `dist/` ;
  - `style.css` porte tout le design.
- `python3 build.py` génère `dist/`. `python3 build.py --preview` produit en plus `preview.html`, une version sur une seule page avec navigation par ancres, qui sert à prévisualiser dans Claude.
- HTML, CSS et un peu de JavaScript natif, sans framework. Le JavaScript gère :
  - le menu mobile ;
  - la visionneuse photo ;
  - la rotation de l'œil et des étoiles au défilement ;
  - quelques apparitions de textes au défilement ;
  - la parallaxe légère des images.
- **Formulaires Netlify Forms** (`data-netlify="true"`, avec un champ anti-robot `bot-field`) : `contact` et `newsletter`. Les envois arrivent dans le tableau de bord Netlify, rubrique Forms.

### Hébergement et déploiement

- Netlify, offre gratuite, projet **cerulean-clafoutis-b2da15**.
- Le déploiement se fait **à la main par Netlify Drop**. On zippe le contenu de `dist/` (fichier `cie-origami-site.zip`), puis on le glisse dans l'onglet *Deploys* du projet : https://app.netlify.com/projects/cerulean-clafoutis-b2da15/deploys.

### Dépôt GitHub

**Aucun.** Le projet n'a jamais été mis sous Git ni sur GitHub. Il n'y a ni dépôt, ni branche. Les fichiers sources se trouvaient dans l'espace de travail cloud de la conversation précédente. Ils sont remis avec ce document dans l'archive **`origami-site-source.zip`**, qui contient :
- `content.py`, `build.py`, `style.css`, `logo.svg` ;
- `dist/` ;
- `photos-a-recuperer.txt` ;
- ce document.

Recommandation : créer un dépôt dès la reprise et connecter Netlify à ce dépôt, pour que chaque modification se déploie toute seule.

---

## 3. Contenus

**Source de vérité des textes :** `content.py`. Les textes ont été repris du site Wix puis relus et corrigés.

### Spectacles

Le slug est aussi le nom du fichier HTML.

| Slug | Titre | Statut | Infos |
|---|---|---|---|
| `commeunpoint` | Comme un point désarticulé | Création 2026 | Cirque–théâtre, 45 min, rue. Ella Beerli & Julie Levrat. Fiche technique sur Drive |
| `la-petite-fille-dans-la-poubelle` | La Petite Fille dans la poubelle | En tournée | Cirque–théâtre surréaliste, 60 min, rue et salle. Vidéo Vimeo 674379702. Dossier PDF. 23 dates |
| `caborigamique` | Le Cabaret Origamique | Disponible | Cabaret de rue modulable. PDF « Infos techniques et tarifs » |
| `edmd` | L'Équilibre de mon déséquilibre | En tournée | Solo d'Ella Beerli. Dossier de présentation sur Drive |
| `oups-vache` | Oups, j'ai percuté une vache ! | En création | Solo de Sévane Gurunlian, science-fiction sonore |
| `des-pates-au-seum` | Des pâtes au seum | Création 2027 | Ella Beerli & Sévane Gurunlian |
| `la-vouivre` | La Vouivre | Répertoire | Cirque, théâtre physique et marionnette |
| `lepetitcirquedescontes` | Le Petit Cirque des contes | Répertoire | Dès 2 ans, rue |

**Autres données dans `content.py` :**
- `SITE` : coordonnées ;
- `ARTISTS` : 3 portraits ;
- `HISTORY` : 8 étapes, de 2018 à 2027 ;
- `COMMITTEE` ;
- `COLLABS` : 5 groupes ;
- `SUPPORTERS` : Commune d'Anières, Commune de Chêne-Bourg, SSA, ProCirque, FARS, SIG ;
- `PARTNER_LOGOS` : 4 dessins d'acrobates ;
- `REDIRECTS` : anciennes URL Wix `/quisommesnous/lhbp` et `/quisommesnous/oc`, redirigées vers `/quisommesnous`.

**Coordonnées affichées :**
- compagnieorigami@gmail.com ;
- +41 77 945 00 98 (Sévane Gurunlian) ;
- adresse postale : Association Origami, c/o Stéphane Leidner, 9 route de Sous-Moulin, 1225 Chêne-Bourg ;
- Facebook : https://www.facebook.com/Cie-Origami-799838723687592 ;
- Instagram : https://www.instagram.com/cie_origami/.

### Images

**Toutes les images sont encore hébergées chez Wix**, sur `static.wixstatic.com/media/4d47d3_…`. Le site les appelle à distance, redimensionnées par Wix :
`https://static.wixstatic.com/media/{id}/v1/fit/w_…,h_…,q_85,enc_auto/{id}`

La liste complète des 74 images utilisées est dans **`photos-a-recuperer.txt`**. ⚠️ Elles disparaîtront si le compte Wix est fermé : il faut les télécharger et les intégrer au site **avant** la fermeture.

Images clés :
- **Photo du haut de « Qui sommes nous »** : `4d47d3_21e1d6283d5c4a71b7a01b6c4663adac~mv2.jpg`. Elle doit toujours laisser voir **le visage et les doigts** (cadrage `object-position: 50% 20%`).
- **La Petite Fille** :
  - bandeau illustré `4d47d3_36788ab45c464ded9cb6ae8cb0466559~mv2.png` ;
  - titre dessiné `4d47d3_ddc40d606c49441781b711ed0234173b~mv2.png` ;
  - plancher de théâtre `4d47d3_f39046547ee4472f8a66460ef05ea9b7~mv2.png` ;
  - bandeau Liens `4d47d3_f8aeb7972e2f41c28bdc35ba4c959def~mv2.jpg`.
- **Image de partage (Open Graph)** : `4d47d3_85bf461adcdc4b2fad9eed0058d62a9f~mv2.jpg`.
- **Recadrages particuliers** (dictionnaire `IMG_POS` dans `build.py`) :
  - `4d47d3_b5c9b051…` en `0% 50%` ;
  - `4d47d3_110859d8…` en `50% 100%`.

### Vidéos

- **Boucles de l'accueil**, hébergées par Wix (même risque que les images) :
  - La Petite Fille : `video.wixstatic.com/video/4d47d3_984cf0258e974607b2bc0a2e35699c1b/720p/mp4/file.mp4` ;
  - Cabaret : `…/4d47d3_15e461de7cd64c0d960b2db55be1136c/720p/mp4/file.mp4`.
- **Vimeo** : https://vimeo.com/674379702 (La Petite Fille).

### Documents liés

- Fiche technique de Comme un point : https://drive.google.com/file/d/1kvYrO9AMpVJjPqmvitutZMuZZi_xF3DZ/view
- Dossier de L'Équilibre de mon déséquilibre : https://drive.google.com/file/d/1JlMcwk-T1A35LQ4aKBJeTyz3tFCu07hq/view
- PDF de La Petite Fille et du Cabaret : hébergés par Wix sous `https://www.compagnieorigami.com/_files/ugd/4d47d3_…`. Les URL exactes sont dans `content.py`. ⚠️ Ils sont à rapatrier eux aussi.

**Aucun dossier Google Drive « source » du site** n'a été mentionné ou utilisé. Seuls les deux liens Drive ci-dessus existent.

---

## 4. Identité visuelle

**Ambiance de l'original Wix**, reprise fidèlement :
- fond noir ;
- grandes bandes violettes en diagonale (triangles et vagues) ;
- lueurs bleu nuit et violet ;
- cadres fins blancs ;
- étoiles à quatre branches et œil dessiné qui tournent au défilement.

**Couleurs principales :**
- noir `#04040a` / `#05050d` ;
- violet nuit des blocs spectacles `#130e2c` à `#150f33` ;
- lavande `#9781FF`, utilisée en transparence pour les bandes et les panneaux ;
- violet profond `rgba(40,20,103,…)` ;
- dégradé rose → lavande (pastilles et boutons) ;
- blanc `#fffffe` ;
- doré pour les liens de la page Collaborations.

**Polices (Google Fonts) :**
- Bodoni Moda pour les grands titres ;
- Barlow pour les textes ;
- Amatic SC pour les titres manuscrits ;
- Chelsea Market pour le menu ;
- Inknut Antiqua pour les boutons.

**Logo.** `logo.svg` est le logo vectoriel original : 28 tracés blancs, mot « compagnie » au-dessus de « ORIGAMI ». Il est fixé en haut à gauche et disparaît quand on fait défiler vers le bas. La position de « compagnie » et le rapport de taille avec « ORIGAMI » doivent rester **exactement** ceux de l'original.

**Ce qui a plu :**
- la prochaine date sur l'accueil (« j'adore ») ;
- la mise en page des pages spectacles, différente de l'original mais conservée ;
- le bloc « Liens / Équipe » ;
- le menu compact aligné à droite, **avec** « Accueil », dans un cadre fin ;
- les portraits des artistes **en noir et blanc** ;
- la direction artistique commune à toutes les pages, appliquée aussi à La Petite Fille ;
- l'animation du cadre « Qui sommes nous », qui se dessine, et du titre dessiné de La Petite Fille, qui s'écrit.

**Ce qui a déplu :**
- les logos trop petits ou écrasés ;
- des éléments qui passaient devant la prochaine date ;
- des textes qui débordaient dans l'ouverture ;
- le gris des blocs spectacles (« j'aime pas cette couleur »), remplacé par le violet nuit ;
- trop d'animations sur l'accueil ;
- les **animations d'ouverture des photos** (« bizarre ») ;
- les galeries photo sur ordinateur ;
- une mise en page jugée « lourde », allégée ensuite ;
- les pages spectacles d'une première version, qui ne ressemblaient pas assez à l'original.

**Référence.** Le seul site cité est l'**original Wix**, www.compagnieorigami.com (version ordinateur et version mobile). Aucun autre site de référence n'a été donné.

---

## 5. Décisions prises

| Décision | Pourquoi |
|---|---|
| Site statique sur mesure plutôt qu'un autre constructeur | Gratuit, rapide, contrôle total du design (choix de la propriétaire parmi les solutions proposées) |
| Netlify, offre gratuite | Hébergement gratuit, formulaires inclus, déploiement par simple glisser-déposer |
| Mesures reprises de l'original | Unité CSS `--u` = largeur ÷ 1265 sur ordinateur, `--m` = largeur ÷ 320 sur mobile, pour reproduire les proportions Wix au pixel près |
| Formes de séparation et logo reproduits à l'identique | Les tracés SVG des triangles et des vagues sont ceux de Wix ; le logo est le SVG original |
| Agenda dédié, prochaine date sur l'accueil | Amélioration demandée |
| Pas de nombre de dates affiché | Le compteur était trompeur (« plus que 23 ») ; « Dates passées » sans chiffre |
| Champ « Structure » retiré du formulaire de contact ; newsletter en bas de la page Contact | Demande explicite |
| Plus de logos sous « Nous ont soutenus », remplacés par des pastilles texte | Les dessins d'acrobates ne parlaient pas (« ? ») |
| Galeries masquées sur ordinateur, gardées sur mobile | Demande explicite |
| Accueil calme | Plus d'apparitions au défilement sur l'accueil ; seuls l'œil et les étoiles tournent |
| Photos sans animation d'ouverture sur tout le site | Demande explicite |
| Page La Petite Fille | Reprend ses visuels propres (bandeau illustré, titre dessiné, plancher), mais avec la direction artistique des autres pages |
| Mobile calqué sur la vraie version mobile Wix | Accueil : Cabaret en premier, texte sur photo assombrie |
| Mise en page « V9 » aérée | Plus d'espace, moins de cadres, lueurs adoucies, listes en simples filets |

**Idées écartées ou non retenues :**
- garder Wix ;
- la première version au design « libre », abandonnée pour revenir au design original ;
- les blocs gris ;
- les animations d'apparition partout ;
- les galeries sur ordinateur ;
- les logos de soutiens ;
- le compteur de dates ;
- le champ « Structure ».

Les autres solutions proposées au tout début (autres hébergeurs ou CMS) ne sont pas documentées dans ce qui reste de l'échange.

---

## 6. Application de contrôle et connexions

**Non abordé dans cet échange.** Rien n'a été dit ni construit au sujet :
- d'un outil ou d'une application pour gérer le site (back-office, CMS, tableau de bord) ;
- d'une connexion avec d'autres applications Claude, dont **calcul-des-heures**.

Aujourd'hui, toute modification passe par l'édition de `content.py` puis un nouveau déploiement.

Pistes pour la reprise, si c'est le besoin :
- un CMS branché sur un dépôt Git (de type Decap CMS, compatible Netlify), pour que la compagnie modifie dates et textes seule ;
- ou un tableur (Google Sheets) comme source des dates de l'agenda.

---

## 7. Comptes et accès

Aucun mot de passe ici.

| Élément | État |
|---|---|
| Nom de domaine | `compagnieorigami.com`, pointe encore vers Wix. **Pas encore relié à Netlify.** Bureau d'enregistrement non précisé (sans doute Wix) |
| Ancien site | Wix, compte de la compagnie, encore actif. Il héberge les images, les vidéos et les PDF utilisés par le nouveau site |
| Hébergeur | Netlify, projet `cerulean-clafoutis-b2da15`. Le compte Netlify est ouvert sur un **autre compte Google** du Chrome de la propriétaire, pas celui avec lequel le projet a commencé. Identifiant exact à confirmer par la propriétaire |
| Accès au site de test | Une protection par mot de passe ou un accès privé a été activé à un moment sur Netlify. À vérifier dans *Project configuration → Access control* avant d'ouvrir au public |
| Formulaires | Netlify Forms (`contact`, `newsletter`). Les notifications par e-mail restent à configurer dans Netlify |
| Vidéo | Vimeo (vidéo 674379702) |
| Polices | Google Fonts |
| E-mail de la compagnie | compagnieorigami@gmail.com |
| Réseaux | Facebook et Instagram (liens au §3) |
| GitHub | Aucun dépôt |

Règle respectée pendant le projet : Claude n'a jamais saisi de mot de passe ni ouvert de session. La propriétaire se connecte elle-même.

---

## 8. Problèmes rencontrés et questions ouvertes

### Problèmes rencontrés (résolus)

- **Sections beaucoup trop hautes** sur « Qui sommes nous » et La Petite Fille (`.stage{height:100%}`). Corrigé.
- **Sur mobile, des blocs à une seule image disparaissaient.** Corrigé avec le sélecteur `.h-img:has(+ .h-img)`.
- **Bandeau Cabaret hors écran sur mobile.** Corrigé.
- **Photo de Chiffon presque noire sur La Petite Fille.** Le cadrage `0% 50%` a été repris de l'original.
- **Logo qui chevauchait le titre de La Petite Fille.** Le logo se masque désormais au défilement.
- **Photo du haut de « Qui sommes nous »** qui coupait le visage et les doigts. Proportions fixes et cadrage `50% 20%` (`50% 24%` sur tablette et mobile).
- **Déploiement Netlify qui ne se mettait pas à jour.** Il faut déposer le nouveau zip dans l'onglet *Deploys*.
- **Site de test protégé.** Il a été ouvert depuis l'autre compte Google.

### Questions ouvertes et travail restant

1. **Rapatrier les images, vidéos et PDF de Wix** avant de fermer le compte (liste dans `photos-a-recuperer.txt`, plus 2 vidéos et 2 PDF).
2. **Relier le domaine** `compagnieorigami.com` à Netlify et rendre le site public.
3. **Mettre le projet sur GitHub** et connecter Netlify au dépôt.
4. **Version mobile des pages intérieures** : seuls l'accueil, l'en-tête et le pied de page ont été calqués sur le mobile Wix. Les autres pages ont un mobile correct mais non calqué.
5. **Vidéo de L'Équilibre de mon déséquilibre** : lien Vimeo ou YouTube jamais fourni.
6. **Pages « souvenirs » de l'ancien site** (2018, 2020) : les recréer ou non ? Pas de réponse.
7. **Notifications des formulaires** et adresse de réception à configurer dans Netlify.
8. **Outil de gestion** du site (voir §6) : besoin à définir.
9. **Vérification avec images** de la dernière mise en page aérée (V9), sur ordinateur et téléphone : pas encore faite après son déploiement.

---

## 9. Documents, fichiers et liens

**Fichiers remis** (archive `origami-site-source.zip`) :
- `content.py` : toutes les données et tous les textes ;
- `build.py` : générateur (gabarits de pages, JavaScript) ;
- `style.css` : design, en couches successives (V4 à V9 ; les règles les plus basses l'emportent) ;
- `logo.svg` : logo original vectoriel ;
- `dist/` : le site prêt à déployer ;
- `photos-a-recuperer.txt` : les 74 images Wix à rapatrier ;
- `docs/passation.md` : ce document.

**Liens :**
- Ancien site Wix : https://www.compagnieorigami.com
- Site de test Netlify : https://cerulean-clafoutis-b2da15.netlify.app
- Déploiements Netlify : https://app.netlify.com/projects/cerulean-clafoutis-b2da15/deploys
- Aperçu sur une page (artefact Claude privé ; les images n'y s'affichent pas) : https://claude.ai/artifact/FzBtSe4kotfHRWpjYEPo9y
- Vidéo Vimeo : https://vimeo.com/674379702
- Fiche technique de Comme un point : https://drive.google.com/file/d/1kvYrO9AMpVJjPqmvitutZMuZZi_xF3DZ/view
- Dossier de L'Équilibre de mon déséquilibre : https://drive.google.com/file/d/1JlMcwk-T1A35LQ4aKBJeTyz3tFCu07hq/view
- Facebook : https://www.facebook.com/Cie-Origami-799838723687592
- Instagram : https://www.instagram.com/cie_origami/
- Soutiens :
  - https://anieres.ch/
  - https://www.chene-bourg.ch/
  - https://ssa.ch/fr/
  - https://procirque.ch/
  - https://larue.ch/
  - https://ww2.sig-ge.ch/
