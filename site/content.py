# -*- coding: utf-8 -*-
"""Tout le contenu du site de la Cie Origami.
Modifiez les textes ici, puis relancez `python3 build.py`.
"""

SITE = {
    "name": "Compagnie Origami",
    "short": "cie origami",
    "url": "https://www.compagnieorigami.com",
    "description": "Compagnie de cirque contemporain basée à Genève. Spectacles en rue et en salle, pour tous les publics, depuis 2018.",
    "email": "compagnieorigami@gmail.com",
    "phone": "+41 77 945 00 98",
    "phone_name": "Sévane Gurunlian",
    "address": ["Association Origami", "c/o Stéphane Leidner", "9, route de Sous-Moulin", "1225 Chêne-Bourg", "Genève, Suisse"],
    "facebook": "https://www.facebook.com/Cie-Origami-799838723687592",
    "instagram": "https://www.instagram.com/cie_origami/",
    "og_image": "4d47d3_85bf461adcdc4b2fad9eed0058d62a9f~mv2.jpg",
}

FILES = "../fichiers/"  # PDF dans site/fichiers/, vus depuis une page d'une version

# Couleurs "papier" : chaque spectacle a sa feuille d'origami
PAPER = {"rose": "#D8436F", "jaune": "#E9A91E", "vert": "#1F7A6D", "bleu": "#3257A8", "orange": "#E0662B", "violet": "#7B4FA0", "encre": "#2B2D33"}

SHOWS = [
    {
        "slug": "commeunpoint",
        "title": "Comme un point désarticulé",
        "status": "Création 2026",
        "paper": "rose",
        "genre": "Cirque – Théâtre",
        "duration": "45 min",
        "public": "Tout public",
        "venue": "Rue",
        "by": "Avec Julie Levrat et Ella Beerli",
        "hero": "4d47d3_430cb02d2d864d15b4110dac50228395~mv2.jpg",
        "card": "4d47d3_5cdf0d14077a4961b01f991d5ed284b2~mv2.jpg",
        "teaser": "Deux copines devenues artistes de cirque racontent, autour d'un café, la réalité de leur rêve.",
        "body": [
            "<em>Comme un point désarticulé</em> est une nouvelle création de la compagnie Origami, écrite et interprétée par Ella Beerli et Julie Levrat.",
            "Ella et Julie sont deux copines devenues artistes de cirque. Depuis petites, elles rêvent du cirque avec des chapiteaux, des paillettes, du waow et du pop-corn. En grandissant, elles suivent des formations de cirque contemporain et aiment raconter des histoires avec les mots et le corps, en laissant la place à la sensibilité et à l'intimité créée entre les spectateur·ices et les artistes.",
            "Elles se retrouvent alors toutes les deux, autour d'un café, à partager la réalité de leur rêve d'être artistes de cirque. Le spectacle n'est que la partie visible de leur art. Le quotidien, ce sont aussi des entraînements, des montages, des ratés, des doutes, des fous rires, du stress, des ambitions toujours plus grandes…",
            "Ensemble, en alliant leurs forces et leurs faiblesses, aussi bien mentales que physiques, Ella et Julie souhaitent partager avec vous le cirque comme elles le vivent.",
            "Ce spectacle vous apportera du waow, du rire, de l'empathie et de la douceur à travers la transparence de leur magnifique métier :)",
        ],
        "quote": None,
        "credits": "Écriture et interprétation : Ella Beerli & Julie Levrat",
        "links": [("Fiche technique", "https://drive.google.com/file/d/1kvYrO9AMpVJjPqmvitutZMuZZi_xF3DZ/view?usp=sharing")],
        "gallery": ["4d47d3_110859d8bd9a4be3b6473e6fdfdaedb6~mv2.jpg", "4d47d3_9b1dd66c824c463398f0243d13a7f170~mv2.jpg", "4d47d3_7064c3185f7a4317acdd4545694f817f~mv2.jpg", "4d47d3_54aff8fd388b49e7b3c34faba9c975ea~mv2.jpg", "4d47d3_146138bea4f64625bd13dfad3911df64~mv2.jpg", "4d47d3_50c4a4d59f3f43b694def81ab4f8d6b5~mv2.jpg", "4d47d3_591a784ed1b7410a84979bfbbc689e99~mv2.jpg", "4d47d3_725768fd411544058942c7e32542ccdd~mv2.jpg"],
        "dates": [
            ("2026-05-17", "17 mai 2026", "Place de la Côte-d'Or – Anières (GE) – Première"),
            ("2025-08-30", "30–31 août 2025", "Sortie de résidence – Théâtre-Cirqule (GE)"),
            ("2025-04-26", "26 avril et 2 mai 2025", "Sortie de résidence – Festival L'Escalier (GE)"),
        ],
        "home": True,
    },
    {
        "slug": "la-petite-fille-dans-la-poubelle",
        "vimeo": "674379702",
        "title": "La Petite Fille dans la poubelle",
        "status": "En tournée",
        "paper": "jaune",
        "genre": "Cirque – Théâtre surréaliste",
        "duration": "60 min",
        "public": "Tout public",
        "venue": "Rue & salle",
        "by": "Par Ella Beerli et Sévane Gurunlian",
        "hero": "4d47d3_6c17a6290506436d80ac90a86d67766a~mv2.jpg",
        "card": "4d47d3_51555e1022384dbcb66b25811d15f1f2~mv2.jpg",
        "teaser": "L'histoire de Chiffon et Célestine, contée façon cirque. Clownesque et punk.",
        "body": [
            "L'histoire de Chiffon et Célestine contée façon cirque.",
            "Lui, c'est Chiffon. Il vit dans la rue. Célestine, la petite fille qui est avec lui, rêve de partir. Dans cette histoire contée façon cirque, ces deux-là se portent, s'envolent, se plient en deux, jonglent, tiennent en équilibre sur une roue. Ils évoluent dans un univers où les objets prennent vie et où le temps ne veut plus rien dire. Clownesques et punks, ils dédramatisent quelques petites cruelles réalités.",
            "Dans cette tragédie teintée d'ironie, Chiffon et Célestine vivent hors du temps. Leur histoire semble être griffée par un punk sur du papier à dessin. Chiffon a un jour pris Célestine et l'a placée dans l'une des nombreuses poubelles de sa collection.",
        ],
        "quote": "Le jour se lève sur la ruelle, il est tôt. Tout est encore silencieux et l'air est vif. On peut entendre par moments de petits rongeurs qui terminent leurs escapades nocturnes. De petites gouttes d'eau tombent de poubelle en poubelle. Celles-ci semblent chanter une louange à l'approche de leur maître. En effet, au loin, on peut apercevoir une silhouette titubante. Elle se rapproche, et on peut à présent entendre qu'elle est accompagnée d'un grincement terrible.",
        "credits": "En scène : Sévane Gurunlian & Ella Beerli · Musique : Sévane Gurunlian, Maya Beerli & Théo Fornerone · Regard extérieur : Nicolas Fernandez-V, Delphine Combes · Scénographie : Alexandre Cochet · Aide à l'écriture : Josh Stanning · Dessins : Samuel Goldstein",
        "links": [("Dossier de présentation (PDF)", FILES + "4d47d3_4d49d3c8bce34b87ab5a6ee75e986875.pdf"), ("Fiche technique rue (PDF)", FILES + "4d47d3_ab73e15093d64b949fe7674767da3c90.pdf")],
        "gallery": ["4d47d3_b5c9b051db074f408045866ec1342e33~mv2.jpg", "4d47d3_efacd5ba32044c7c971ae948df4d23c0~mv2.jpg", "4d47d3_d4eea29000db4cc895354e43ee355a25~mv2.jpg", "4d47d3_efa72519cffa424baa816e2766a487bf~mv2.jpeg", "4d47d3_febb7774debd4ca0a2fcd981ebbe9c59~mv2.jpg", "4d47d3_6bfcb49348ee4ab4a1e0d2260e4bda21~mv2.jpg", "4d47d3_52678f0d63094b82b531ba521561d711~mv2.jpg", "4d47d3_c30f75a407534412b7c761860516c3fa~mv2.jpg", "4d47d3_4eb7ca1b0a7f41e4ba2b057fd857e0d2~mv2.jpg"],
        "dates": [
            ("2025-09-06", "6 septembre 2025", "Schlössli – Ins (BE)"),
            ("2024-12-10", "10 décembre 2024", "Théâtre des Grottes – Genève (GE)"),
            ("2024-06-28", "28 juin – 21 juillet 2024", "La Chapelle des Italiens – Festival OFF d'Avignon (France)"),
            ("2024-02-04", "4 février 2024", "Théâtre municipal de Sainte-Pazanne – Nantes (France)"),
            ("2024-02-03", "3 février 2024", "Chapidock – Nantes (France)"),
            ("2023-09-28", "28 sept. – 1er oct. 2023", "Théâtricul – Chêne-Bourg (GE)"),
            ("2023-05-02", "2–4 mai 2023", "Festival Émersion – Onex (GE)"),
            ("2022-09-11", "11 septembre 2022", "Festival de la Lune – Monnetier-Mornex (France)"),
            ("2022-09-10", "10 septembre 2022", "Le Chant du Gros – Le Noirmont"),
            ("2022-09-03", "3–4 septembre 2022", "Théâtricul – Chêne-Bourg (GE)"),
            ("2022-08-13", "13 août 2022", "Chapit'O – Bulle (FR)"),
            ("2022-07-17", "17 juillet 2022", "Tour de plage – Carouge (GE)"),
            ("2022-07-08", "8 juillet 2022", "Maison de quartier – Champel (GE)"),
            ("2022-06-05", "5 juin 2022", "Festival Weekend Cirqué – Colombier (NE)"),
            ("2022-01-29", "29–30 janvier 2022", "L'Almacén – Genève (GE)"),
            ("2021-09-25", "25 septembre 2021", "Quartier d'été – Saint-Genis-Pouilly (France)"),
            ("2021-09-23", "23 septembre 2021", "Place Graveson – Thônex (GE)"),
            ("2021-09-11", "11 septembre 2021", "Les Grottes sont à vous – Genève (GE)"),
            ("2021-07-23", "23 juillet 2021", "Les Nuits du cirque – Thonon-les-Bains (France)"),
            ("2021-07-07", "7 juillet 2021", "École Adrien-Jeandin – Thônex (GE)"),
            ("2021-06-04", "4–5 juin 2021", "Ferme de l'Amarante – Reignier (France)"),
            ("2021-05-30", "30 mai 2021", "Ferme de l'Amarante – Reignier (France)"),
            ("2021-05-22", "22–23 mai 2021", "Ferme de l'Amarante – Reignier (France) – Premières"),
        ],
        "home": True,
    },
    {
        "slug": "caborigamique",
        "title": "Le Cabaret Origamique",
        "status": "Disponible",
        "paper": "orange",
        "genre": "Cabaret de cirque",
        "duration": "Formule adaptable",
        "public": "Tout public",
        "venue": "Rue & plein air",
        "by": "Par une équipe 100 % origamique",
        "hero": "4d47d3_cca3cf8dbad340fe92529cd9b9e00595~mv2.jpg",
        "card": "4d47d3_961237f0dea8435881e62aefd6b5da6e~mv2.jpg",
        "teaser": "Un souffle de cirque, un grain de folie : un cabaret de rue modulable et caméléon.",
        "body": [
            "<strong>Un souffle de cirque, un grain de folie.</strong> Le Cabaret Origamique, c'est un cabaret de rue… et d'ailleurs. Un moment suspendu, un assemblage délicat de numéros aux couleurs variées, comme un origami vivant déployé sous vos yeux.",
            "Dans cet univers drôle et burlesque, les artistes partagent leurs petites histoires de scène, tissent des liens entre prouesse et poésie : jongleries, danses virevoltantes, acrobaties au sol et aériennes… et bien d'autres surprises encore.",
            "<strong>Modulable et caméléon.</strong> Ce cabaret s'adapte à tous les lieux, de la petite place de village au grand espace en plein air, et à tous les publics : enfants émerveillés l'après-midi, spectateurs curieux et complices lors d'un cabaret de soirée.",
            "C'est un cirque vivant, joyeux, généreux. Un moment de rencontre, d'énergie et de rires, où l'art circassien se dévoile sous toutes ses formes.",
        ],
        "quote": None,
        "credits": "Avec (selon les formules) : Teddy Marguerat, Anouk Simon, Fernando Isola, Nicolas Parraguez Castro, Julie Levrat, Cristobal Bascur",
        "links": [("Infos techniques et tarifs (PDF)", FILES + "4d47d3_a2aabf868acf4680888279bcefb3ac49.pdf")],
        "gallery": ["4d47d3_89e52ea6d1c942c0888a39b219c32a56~mv2.jpg", "4d47d3_67251316a3a54dba9197de01d6a0f823~mv2.jpg", "4d47d3_6ca6d652e105407cbfe20ff07618d290~mv2.jpg", "4d47d3_b5880f52a69c4b9abd631519ccf04d3c~mv2.jpg", "4d47d3_f305686a6f1f4bf49deacd2ec90ff8a0~mv2.jpg", "4d47d3_e4ec4d6cf300495bb04daa53c1f29916~mv2.jpg", "4d47d3_9159ae5406cd4e969ab8d5810c25a31e~mv2.jpg", "4d47d3_dc784fbb1c8548bfbb050cc51a35ee85~mv2.jpg", "4d47d3_3bfbbc4bc78b41b1bf66b3f6b97d4125~mv2.jpg"],
        "dates": [
            ("2027-02-07", "7 février 2027", "Lieu à confirmer"),
            ("2026-10-17", "17 octobre 2026", "Bois de la Bâtie – Genève (GE) – Bâtie des enfants"),
            ("2026-09-27", "27 septembre 2026", "Préau de l'école Grand-Salève – Veyrier (GE) – Vogue de Veyrier"),
            ("2026-08-12", "12 août 2026", "Parc Chauvet-Lullin – Vernier (GE) – Août au parc"),
            ("2026-07-18", "18–19 juillet 2026", "Big Boxon – Versoix (GE) – Cirquenbulle"),
            ("2026-07-05", "5 juillet 2026", "Place des Théâtres – Sion (VS) – Pollen Festival"),
            ("2026-07-04", "4 juillet 2026", "La Balme – La Roche-sur-Foron (France) – Fête de quartier"),
            ("2026-06-06", "6 juin 2026", "Neuchâtel (NE) – Festival Taj'ums"),
            ("2026-03-21", "21 mars 2026", "Cran-Gevrier – Annecy (France) – Carnaval de Cran-Gevrier"),
            ("2026-02-15", "15 février 2026", "Bois de la Bâtie – Genève (GE) – Bâtie des enfants"),
        ],
        "home": True,
    },
    {
        "slug": "edmd",
        "title": "L'Équilibre de mon déséquilibre",
        "subtitle": "(ou l'inverse, je sais plus !)",
        "status": "En tournée",
        "paper": "vert",
        "genre": "Équilibrisme – Cirque intimiste",
        "duration": "",
        "public": "Tout public",
        "venue": "Salle",
        "by": "Solo d'Ella Beerli, équilibriste déséquilibrée",
        "hero": "4d47d3_6fe73547ff694e7e897ff78b5a714efe~mv2.jpg",
        "card": "4d47d3_61cc470ef1f845a8bdd6e7f9eae5e220~mv2.jpg",
        "teaser": "Une équilibriste se confie sur ses doutes, ses choix et sa discipline d'enfance.",
        "body": [
            "Une création originale d'Ella Beerli, équilibriste déséquilibrée.",
            "À l'aide de voix off, de diverses techniques d'équilibre, d'expressions corporelles et d'une touche de théâtralité, elle raconte sa relation avec cette discipline qui l'accompagne depuis son enfance. Elle se confie sur ses doutes, ses questionnements, son vécu, ses choix…",
            "Pour commencer, elle désire amener de l'humanité dans l'équilibre en cassant cette image de « machine humaine spectaculaire ». En utilisant les émotions, les sensations ou encore la respiration, quels impacts auraient-ils sur un corps en équilibre ? Serait-il possible d'arriver à sortir de l'axe ? De décomposer, de dissocier chacune des parties de ce corps en performance ?",
            "Spectacle soutenu par la SSA et ProCirque.",
        ],
        "quote": None,
        "credits": "Création et interprétation : Ella Beerli · Photos : Aline Zandona",
        "links": [("Dossier de présentation", "https://drive.google.com/file/d/1JlMcwk-T1A35LQ4aKBJeTyz3tFCu07hq/view?usp=sharing")],
        "gallery": ["4d47d3_d90e5d70bd53421b94e5f34d1093fb0a~mv2.jpg", "4d47d3_79f5ee7ede604fd7bb3959e7148de3a8~mv2.jpg", "4d47d3_a9165419f50b4f59b25d069cd3915c15~mv2.jpg", "4d47d3_6f6a2b36de3c4cfaaad28055a9f207ee~mv2.jpg", "4d47d3_a0fd4b80c2374e728258456b9a5ec8ee~mv2.jpg", "4d47d3_4a63b9830d1e44f3aeef376d6b5fd9d4~mv2.jpg", "4d47d3_e5a3af5c42f440b4bd69176509cbc5a2~mv2.jpg", "4d47d3_1ebc7333493b478e8e729ab088fd639f~mv2.jpg"],
        "dates": [
            ("2024-10-27", "27 octobre 2024", "Gala d'ouverture – Festival Internacional de Circo Independiente (Buenos Aires)"),
            ("2024-09-26", "26 septembre 2024", "Station Circus – Jeudi du cirque (Buenos Aires)"),
            ("2024-04-12", "12 avril 2024", "Festival L'Escalier (GE)"),
            ("2024-04-05", "5 avril 2024", "Festival L'Escalier (GE)"),
        ],
        "home": True,
    },
    {
        "slug": "oups-vache",
        "title": "Oups, j'ai percuté une vache !",
        "status": "En création",
        "paper": "bleu",
        "genre": "Science-fiction sonore et cirque",
        "duration": "",
        "public": "",
        "venue": "",
        "by": "Une recherche de Sévane Gurunlian",
        "hero": "4d47d3_830e4ea396e2432e98714c4f7616ea52~mv2.jpg",
        "card": "4d47d3_f23199864ca348c98d1e40ca6511f944~mv2.jpg",
        "teaser": "En l'an 2250, Claude livre des colis pour la poste intergalactique. Seul.",
        "body": [
            "En l'an 2250, Claude est commandant d'un vaisseau spatial. Cela fait dix ans qu'il est en mission. Pendant que ses collègues capitaines explorent des planètes inconnues ou affrontent des créatures galactiques, Claude, lui, travaille pour la poste intergalactique : il effectue des livraisons, isolé dans l'espace et coupé de sa planète.",
            "Plus d'infos à venir…",
        ],
        "quote": None,
        "credits": "Solo de Sévane Gurunlian · Regard extérieur : Nico Fernandez-V, Théo Rossier · Voix : Maya Bringhen",
        "links": [],
        "gallery": ["4d47d3_31190d3ef1754bbeab303dff657f28d7~mv2.jpg", "4d47d3_5748ba7c10ea4e598cee212cad934d46~mv2.jpg", "4d47d3_589f3a129fdf48ab9dbe1e30bf052f3c~mv2.jpg", "4d47d3_a23d1e079630488eb8948451cc4687e8~mv2.jpg", "4d47d3_4e12b09d3ba247bba59ed0fef299abb9~mv2.jpg", "4d47d3_3fa859b8c41e406192365b41d8ef5b32~mv2.jpg", "4d47d3_475a1fee96e5494293e99aca0655fe3a~mv2.jpg"],
        "dates": [],
        "home": True,
    },
    {
        "slug": "des-pates-au-seum",
        "title": "Des pâtes au seum",
        "status": "Création 2027",
        "paper": "violet",
        "genre": "Cirque, acrobaties et absurdités",
        "duration": "",
        "public": "",
        "venue": "",
        "by": "Un projet d'Ella Beerli et Sévane Gurunlian",
        "hero": "4d47d3_403c14878a634a7d8c5becb8cc65d954~mv2.jpg",
        "card": "4d47d3_b836be194f0e4334837ff1d665a57f21~mv2.jpg",
        "teaser": "La flemme, le retard, l'arrêt : un cirque poétique sur ce qui se joue dans l'inaction.",
        "body": [
            "C'est un état qui nous traverse et qui, d'une façon ou d'une autre, traverse tout le monde. Une fatigue, une envie de ralentir, de ne plus répondre immédiatement. Est-ce que notre époque change simplement de visage ?",
            "Autour de nous, le monde déborde : les bruits de la ville, les écrans, les images, les injonctions permanentes. Tout s'accumule. Alors il y a la flemme. Le retard. L'arrêt. La procrastination. Non pas comme un échec, mais peut-être comme un geste de survie. Une manière de se protéger lorsque le trop-plein devient trop lourd.",
            "À travers cette nouvelle création, le duo interroge le repli sur soi, la cohabitation, l'épuisement quotidien, mais aussi la puissance poétique des micro-aventures. Un cirque poétique, parfois pour en rire, mais surtout pour raconter ce qui se joue dans l'inaction… et dans le trop-plein.",
        ],
        "quote": None,
        "credits": "Création : Ella Beerli & Sévane Gurunlian",
        "links": [],
        "gallery": ["4d47d3_ad850f1c5a9d48d2af17d7d11891d568~mv2.jpg"],
        # repris du dossier de création (Drive : « CVs et dossier de création - Des pâtes au seum ») ;
        # photos extraites du dossier, dans photos/dossier-pates-NN-*.webp
        "dossier": {
            "photos": [f"dossier-pates-{i:02d}.jpg" for i in range(1, 12)],
            "etapes": [
                ("Février 2025", "Une première impulsion, la naissance d'une idée et présentation d'un numéro de portés acrobatiques lors d'un Cabarepic à Genève."),
                ("Été 2025", "Après cinq années de tournée du spectacle La Petite Fille dans la poubelle, un besoin s'impose : celui de dire autre chose, autrement. La décision d'une nouvelle création émerge."),
                ("Octobre 2025", "Une nouvelle forme apparaît au festival Carambole à Genève. Les Pâtes au Seum évolue, s'équilibre en portés sur monocycle."),
                ("Décembre 2025", "Une résidence artistique permet de poser les premières fondations du projet. La recherche est nourrie par des regards extérieurs : Valentina Lupolini (Cie Humagine), Mathieu Fernandez-V. (Cie de Trop) et Tamara Savelieff-Horan (Cie Utop)."),
            ],
            "duo": [
                "Depuis près de quinze ans, nous avançons en équilibre. Notre travail circassien en duo s'appuie sur les disciplines d'acrobaties, de main à main et de portés sur monocycles, une pratique encore rare. Nos créations se tissent dans le mouvement et explorent un cirque tantôt brut, tantôt traversé par des horizons plus sensibles.",
                "Fondée en 2018, la compagnie Origami rassemble plusieurs projets qui gravitent autour de notre duo, dont Des pâtes au seum, notre deuxième création de format long, faisant suite à La Petite Fille dans la poubelle.",
            ],
        },
        "dates": [
            ("2027-10-16", "16 octobre 2027 à 16h", "Lieu à confirmer"),
        ],
        "home": True,
    },
    {
        "slug": "la-vouivre",
        "title": "La Vouivre",
        "status": "Répertoire",
        "paper": "encre",
        "genre": "Cirque – Théâtre physique – Marionnette",
        "duration": "45 min",
        "public": "Tout public",
        "venue": "",
        "by": "Avec Kaly Lemieux, Laura Perez, Fernando Isola, Ella Beerli, Sévane Gurunlian",
        "hero": "4d47d3_eb6808ce013847e3be4f0c9b5418f6d9~mv2.jpg",
        "card": "4d47d3_fd2ff304786e4225984f074f846ee05f~mv2.jpg",
        "teaser": "Une légende des montagnes, entre cirque, théâtre physique et marionnette.",
        "body": [
            "Nous, les hommes, vivons et respirons au rythme des hommes. Nous mangeons, nous buvons, nous dansons et nous dormons. Nous ne savons pas toujours ce qu'il se passe autour de nous. Nous ne voyons pas toujours les choses qui nous entourent. Et pourtant…",
            "Avez-vous déjà aperçu, dans les mouvements de l'eau, une forme vivante et incompréhensible ? Entrevoir et ressentir suffit parfois à laisser entrer les légendes dans le rythme de nos vies. Les créatures qui bercent notre monde sont partout, quelquefois sans même savoir qu'elles sont enchanteresses et puissantes.",
        ],
        "quote": "Avez-vous jamais senti, là-haut, dans nos montagnes, un calme soudain… et inexpliqué ?",
        "credits": "Marionnette de la Vouivre : Christophe Kiss, Michel Québatte, Samantha Kiss · Création musicale : Sévane Gurunlian · Regard extérieur : Mathieu Fernandez-V · Merci également à Nicolas Parraguez Castro, Elvis Pesto, Satya Apert, Lilas Morin, Céline, Bhör",
        "links": [],
        "gallery": ["4d47d3_fd2ff304786e4225984f074f846ee05f~mv2.jpg"],
        "dates": [],
        "home": False,
    },
    {
        "slug": "lepetitcirquedescontes",
        "title": "Le Petit Cirque des contes",
        "status": "Répertoire",
        "paper": "jaune",
        "genre": "Cirque – Théâtre",
        "duration": "45 min",
        "public": "Dès 2 ans",
        "venue": "Rue",
        "by": "Avec Kaly Lemieux, Eli Podrome, Ella Beerli, Sévane Gurunlian",
        "hero": "4d47d3_3fee591be46a4bf78caca44487147a14~mv2.jpg",
        "card": "4d47d3_428459a0011f40d3ab3721547c5ed8ad~mv2.jpg",
        "teaser": "Les histoires de Maria des vents, interprétées par des circassiens.",
        "body": [
            "Les histoires de Maria des vents, interprétées par des circassiens.",
            "Le Petit Cirque des contes revisite le conte traditionnel sous un angle comique. Notre sorcière magicienne Maria des vents vous transmettra ses légendes anciennes, venues des tréfonds de grimoires oubliés. Laissez-vous embarquer pour un moment insolite entre imaginaire, aventure et enchantement. C'est aussi un moment de détente en famille, où chacun a le temps de se retrouver, de rire et de s'émerveiller.",
            "Les artistes présents sur scène transcendent l'image que l'on peut avoir des princes et princesses d'antan : le spectacle questionne les rôles prédéfinis du conte de fées, avec une touche comique.",
        ],
        "quote": "Je suis Maria des vents, moitié sorcière, moitié magicienne, mais surtout raconteuse de légendes anciennes. Et justement, on m'a appelée ici aujourd'hui pour vous raconter une histoire.",
        "credits": "Avec Kaly Lemieux, Fernando Isola, Eli Martin, Mathieu Fernandez-V, Nicolas Parraguez Castro, Ella Beerli et Sévane Gurunlian",
        "links": [],
        "gallery": ["4d47d3_50ee313b0f6f49d9a1896610f6e39b31~mv2.jpg"],
        "dates": [
            ("2023-09-10", "10 septembre 2023", "Les Grottes sont à vous ! – Genève (GE)"),
            ("2023-09-02", "2 septembre 2023", "Villa Tacchini – Lancy (GE)"),
            ("2023-07-08", "8 juillet 2023", "MQ Thônex – Belle-Terre (GE)"),
            ("2023-02-12", "12 février 2023", "La Bâtie des enfants – Genève (GE)"),
        ],
        "home": False,
    },
]

ARTISTS = [
    {"name": "Ella Beerli", "role": "Équilibriste déséquilibrée et voltigeuse", "photo": "4d47d3_a3c07beaff564243bb25a3bba4b14058~mv2.jpeg",
     "bio": "Ella se forme dès son plus jeune âge aux arts du cirque. Elle se spécialise en équilibre, en main à main et en portés sur monocycle. Après un passage par l'École nationale des arts du cirque de Rosny-sous-Bois (Paris), elle poursuit sa formation au Lido (ESACTO) à Toulouse. Elle travaille ensuite sur plusieurs créations et rejoint la Cie Origami dès 2021, lors de la création de <em>La Petite Fille dans la poubelle</em>. Quand elle n'est pas en répétition, elle aime regarder Naruto et prendre des goûters à n'importe quelle heure."},
    {"name": "Sévane Gurunlian", "role": "Artiste multifonction au sol", "photo": "4d47d3_9386f248efb24bf0a48082b07a91e174~mv2.jpg",
     "bio": "Sévane est un artiste multidisciplinaire qui évolue à la croisée des arts du cirque (monocycle, main à main, acrobatie) et de la création sonore, où il crée un peu tout ce qui lui passe par la tête, de la musique de spectacle à la fiction sonore. Il étudie le cirque à Québec, puis la création sonore à Drummondville. Il s'investit ensuite en Suisse dans de nombreux projets, autant à la technique qu'à l'organisation ou sur scène. C'est ainsi qu'il prend place dans les premiers projets de la Cie Origami en 2018. Même s'il adore que les choses soient bien organisées… lorsqu'il crée, c'est souvent un joyeux bazar !"},
    {"name": "Julie Levrat", "role": "Artiste multifonction aérienne", "photo": "4d47d3_68f0d319acaa4b76a7c300173846ba87~mv2.jpg",
     "bio": "Emmener ses muscles en promenade jusqu'à la salle de sport ! Avant d'en arriver à ses deux séances de préparation physique par jour, Julie a débuté avec le trapèze et d'autres disciplines acrobatiques aériennes. Elle voyage de l'école de cirque FLIC (Italie) à l'École de cirque de Québec, où elle pratique entre autres la roue Cyr, qui deviendra sa discipline au sol. Elle joue ses numéros dans des contextes très variés, des boîtes de nuit aux tournées de cirque, notamment avec le Cirque Monti (Suisse). En 2024, elle lance avec Ella Beerli le projet <em>Comme un point désarticulé</em>."},
]

HISTORY = [
    ("2018", "Création de <em>L'Homme bande passante</em>", "Spectacle de mime par Sévane Gurunlian", None),
    ("2020", "Tournée <em>Origami Circus</em>", "", None),
    ("2021", "Création de <em>La Petite Fille dans la poubelle</em>", "", "la-petite-fille-dans-la-poubelle"),
    ("2022", "Premier <em>Cabaret Origamique</em>", "", "caborigamique"),
    ("2024", "Création de <em>L'Équilibre de mon déséquilibre</em>", "", "edmd"),
    ("2025", "Création de <em>Oups, j'ai percuté une vache !</em>", "", "oups-vache"),
    ("2025", "Création de <em>Comme un point désarticulé</em>", "", "commeunpoint"),
    ("2027", "<em>Des pâtes au seum</em> (en devenir)", "", "des-pates-au-seum"),
]

COMMITTEE = [("Président", "Théo Rossier"), ("Trésorière", "Delphine Combe"), ("Secrétaire", "Célia Arcos")]

# (titre, [ (nom, url|None, texte) ])
COLLABS = [
    ("Des écoles de cirque", [
        ("Le Théâtre-Cirqule", "https://www.cirqule.com/", "École de cirque de Genève. Merci pour le soutien et l'accueil en résidence."),
        ("Cirquenbulle Genève", "https://www.cirquenbulle.ch/", "Merci pour le soutien en diffusion à Genève."),
    ]),
    ("Des organisations amies", [
        ("Festival L'Escalier", "http://festival-l-escalier.ch", "Festival d'arts émergents. Merci pour l'accueil des spectacles et tous les bons moments passés."),
        ("Point d'interrogation", "https://www.instagram.com/point.d.interrogation.officiel/", "Organisateurs et facilitateurs. Merci pour l'accueil lors de leurs événements : Cabarepics, La Petite Fille dans la poubelle…"),
    ]),
    ("Des espaces qui ouvrent leurs portes", [
        ("Le Théâtricul", "https://theatricul.net/", "Petit théâtre insolite à Chêne-Bourg. Merci pour le soutien, l'accueil en résidence et l'accueil de spectacles."),
        ("Les ZartiCirque", "https://lezarticirque.ch/", "École de cirque de Sainte-Croix. Merci pour l'accueil en résidence de Comme un point désarticulé."),
        ("La Ferme de l'Amarante", "https://www.facebook.com/fermelamarante/", "Ferme maraîchère bio. Merci pour l'accueil en résidence et les six premières de La Petite Fille dans la poubelle."),
        ("Analya Création", "https://www.analyacreation.com/", "Le Manège de Colombier. Merci pour l'accueil en résidence de La Vouivre."),
    ]),
    ("Des artistes avec qui nous collaborons", [
        ("Aline Zandona – Photographie", "https://alinezandona.com/category/portrait-mode/", "Elle a réalisé une grande partie des photographies de nos spectacles, ainsi que des œuvres photographiques avec des artistes de la compagnie."),
        ("Samuel Goldstein – Muss Illustration", "https://www.instagram.com/muss_illustration/", "Il a dessiné les multiples illustrations de La Petite Fille dans la poubelle."),
        ("Théo Fornerone – Jahmo", "https://soundcloud.com/jahmo-officiel", "Musique de La Petite Fille dans la poubelle, avec Maya Beerli."),
        ("Satya Apert De Sela, Lilas Morin, Elvis Pesto", None, "Musique de La Vouivre."),
    ]),
    ("Des projets amis", [
        ("Cie Non Sin Tri – Ça-Turne", "https://nonsintri.com/ca-turne/", "Un collectif de portés en monocycle dont Sévane fait partie. Sortie du projet en novembre 2025."),
        ("Cie L'Articule", "https://www.theatrelarticule.com/", "Spectacles Comme suspendu et PV-2 : théâtre et marionnettes. Ella en fait partie."),
    ]),
]

SUPPORTERS = [
    ("Commune d'Anières", "https://anieres.ch/"),
    ("Commune de Chêne-Bourg", "https://www.chene-bourg.ch/"),
    ("SSA – Société Suisse des Auteurs", "https://ssa.ch/fr/"),
    ("ProCirque", "https://procirque.ch/"),
    ("FARS – Fédération des arts de la rue suisses", "https://larue.ch/"),
    ("SIG – Services industriels de Genève", "https://ww2.sig-ge.ch/"),
]

PARTNER_LOGOS = ["4d47d3_91d600e84faa4d608ad9a667ea0c93d7~mv2.png", "4d47d3_a38192f979a7435082b38a72360a2229~mv2.png", "4d47d3_091a05bf3adc48a8828a5d3f626173ce~mv2.png", "4d47d3_7e15a8e634b14f7cb49c4640e46ea2e4~mv2.png"]

# Anciennes adresses Wix -> nouvelles pages (évite les liens cassés et garde le référencement)
REDIRECTS = {
    "/quisommesnous/lhbp": "/quisommesnous",
    "/quisommesnous/oc": "/quisommesnous",
}

# Agenda : les dates de data/agenda.json (rempli depuis la feuille Google « Pilotage du site »)
# remplacent celles écrites plus haut, spectacle par spectacle.
def _charger_agenda():
    import json, os
    chemin = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "agenda.json")
    if not os.path.exists(chemin):
        return
    with open(chemin, encoding="utf-8") as f:
        agenda = json.load(f).get("spectacles", {})
    for show in SHOWS:
        if show["slug"] in agenda:
            dates = agenda[show["slug"]].get("dates", [])
            show["dates"] = sorted(((d["date"], d["texte"], d["lieu"]) for d in dates), reverse=True)


_charger_agenda()
