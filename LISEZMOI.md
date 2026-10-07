# Tycoon Magasin Informatique — prototype (paliers 1 à 4)

Un seul magasin jouable dans le navigateur : stock, vendeur et caissier, loyer, salaires, bilan du mois et faillite, avec le temps réel et la pause. Pas de graphismes définitifs : formes simples.

## Lancer le jeu

Double-cliquez sur `index.html` : il s'ouvre dans le navigateur, sans installation ni serveur.
Pour tester sur téléphone, mettez le dossier en ligne (par exemple sur Netlify, en glissant le dossier) et ouvrez l'adresse sur le téléphone.

Raccourcis : espace = pause, 1 / 2 / 3 = vitesse, A = liste « À faire » ; dans le magasin : + / − = zoom, Q / E = pivoter, R = recentrer, V = vue 3D / 2D, Échap = carte. Molette ou pincement pour zoomer, glisser pour se déplacer.

## Organisation du code

| Dossier | Contenu |
| --- | --- |
| `data/` | Données modifiables sans toucher au code : `deco.js` (sols, murs, 15 objets de déco, effets de l'ambiance), `evenements.js` (saisons et imprévus), `produits.js` (30 références, fournisseur), `villes.js` (43 villes dans les 13 régions, loyers, affluence), `clients.js` (profils), `carte-france.js` (contours de la carte), `carte-deco.js` (régions et fleuves de la carte illustrée), `concurrents.js` (enseignes rivales), `dilemmes.js` (décisions à prendre), `config.js` (budgets, salaires, durées, réputation, objectifs) |
| `src/sim/simulation.js` | Les règles du jeu : temps, clients, ventes, stock, employés, loyer, bilan, faillite. Ne dépend pas de l'écran. |
| `src/ui/` | L'affichage : carte de France (`vue-carte.js`), vue des trois pièces en isométrique (`vue-magasin.js`) et écrans de gestion (`panneaux.js`) |
| `src/sauvegarde.js` | Sauvegarde automatique chaque jour de jeu, 3 emplacements, export et import d'un fichier |
| `src/ui/vue-3d.js` + `lib/three.min.js` | Salle de vente en 3D (three.js r158, inclus dans le dossier : pas besoin d'internet). Tout est construit par le code (aucun modèle à charger) à partir du même plan que la vue 2D. Bouton « 3D / 2D » à droite de la vue (choix mémorisé). Les trois pièces existent en 3D : salle de vente, réserve (étagères remplies selon le stock, palette des livraisons, poste de commande) et bureau (écran du bilan, tableau de l'équipe, calendrier, classeur du journal, affiche pub, plan du local) ; chaque meuble ouvre son onglet. En 3D : glisser = déplacer, molette ou pincement = zoom, clic droit (ou Maj + glisser, ou deux doigts) = pivoter. Si l'appareil ne gère pas WebGL, le jeu reste en 2D. |
| `src/ui/apparence.js` | Apparence des personnages (peau, coiffure, tenue, accessoires selon le profil, enfant des familles), tirée à partir de l'identifiant : la même personne a le même look en 2D et en 3D. Les couleurs et coiffures possibles sont en haut du fichier. |
| `src/ui/accueil-vivant.js` | Boutique de démonstration animée sur l'écran d'accueil (vraie simulation, vue 2D, sans toucher aux sauvegardes). Ville, vitesse et affluence réglables en haut du fichier. Logo du jeu : `img/logo-kaouch-tycoon.png`. |
| `src/ui/sons.js` | Sons et musique synthétisés dans le navigateur (Web Audio, aucun fichier audio) : tiroir-caisse à chaque vente, notifications, bilan, palier, victoire, faillite, et musique d'ambiance lo-fi en boucle. Bouton haut-parleur dans la barre et sur l'accueil ; cases « Effets sonores » et « Musique » dans le Menu (mémorisées sur l'appareil). |
| `src/ui/tuto.js` | Tuto guidé (13 étapes) et astuces ponctuelles : une bulle pointe le bon bouton ; les étapes et les textes sont en haut du fichier |
| `src/main.js` | Écrans, boucle du temps, actions du joueur |
| `tools/simuler.js` | Fait tourner la simulation seule pendant plusieurs mois pour vérifier l'économie |

## Vérifier l'économie sans l'écran

Avec Node.js installé :

```
node tools/simuler.js rennes 6 normal 42
```

Arguments : ville, nombre de mois, difficulté, graine du hasard, et `agrandir` pour que le joueur automatique déménage dès que sa trésorerie le permet. Le script joue de façon simple (8 produits, réassort automatique, un vendeur et un caissier) et affiche le bilan de chaque mois.

## Campagne d'équilibrage

```
node tools/campagne.js rennes,lyon,albi normal,difficile 1,2,3 9
```

Un joueur automatique fait toute la partie (déménagements, nouveaux magasins, responsables, entrepôt) sur le nombre d'années demandé, et affiche quand tombe chaque palier, la faillite éventuelle, le nombre de magasins, le chiffre d'affaires et le résultat des 12 derniers mois. Compter environ 5 minutes par partie de 9 ans ; on peut en lancer plusieurs en parallèle. Avec `DETAIL=1` devant la commande, il affiche aussi chaque bilan mensuel.

Repères mesurés (octobre 2026, joueur automatique) : palier 2 vers 1,5 à 3 ans, palier 3 vers 2 à 4 ans, victoire vers 5 ans en facile, 6 à 8 ans en normal, plus de 9 ans en difficile. Lyon, grande ville rentable, va un peu plus vite (palier 2 vers 1,2 à 1,3 an en normal) ; monter son loyer ne le ralentit pas, cela le rend surtout mortel les premiers mois (faillite dès 4 000 €). L'outil lance aussi des parties que l'écran Nouvelle partie refuse (sous `departMinimum`, comme Lyon en difficile) : leurs faillites immédiates ne comptent pas.

## Règles en place

- Parcours : choix de la ville et de la difficulté, puis carte de France avec le logo de votre boutique ; on touche le logo pour entrer dans la gestion, le bouton Carte (ou Échap) y ramène.

- La boutique a trois pièces, avec leurs écrans de gestion : **Magasin** (rayons, prix, atelier), **Réserve** (stock, commandes) et **Bureau** (bilan, personnel, pub, journal). On passe de l'une à l'autre avec les boutons en haut à gauche de la vue, par les portes, ou en touchant les meubles : étagères (stock), poste de commande et zone d'arrivage (commandes), ordinateur du bureau (bilan), tableau de l'équipe (personnel), classeur (journal), établi et salle vitrée (atelier). Les étagères de la réserve montrent le stock réel ; une nouvelle partie commence au bureau pour embaucher.
- Atelier (phase 2) : avec un technicien, montage de PC sur mesure : le jeu pré-remplit une configuration qui répond au besoin, et les pièces absentes du stock sont commandées automatiquement quand le client accepte (le montage démarre à leur livraison), et réparations à tarif réglable (garantie et retours SAV).
- Publicité : campagnes au bureau (public visé, durée, budget) qui augmentent la fréquentation pendant leur durée.
- Locaux : petit (8 emplacements), moyen (14) et grand (20). Au bureau, onglet Local, on compare et on déménage : l'ancien dépôt de garantie est rendu, on paie le nouveau et l'aménagement, la boutique ferme 2 jours, puis la salle de vente s'agrandit. Le loyer augmente de 3 % chaque année (réglable dans `config.js`).
- Calendrier : la partie commence en mars. Événements de saison chaque année (soldes d'hiver, creux d'août, rentrée, Black Friday, fêtes), annoncés une semaine avant, et imprévus tirés au hasard (pénuries de cartes graphiques ou de mémoire annoncées une semaine avant, promo du fournisseur, sortie d'un gros jeu, article dans le journal local). Une fenêtre s'ouvre au début de chaque événement ; ceux en cours apparaissent sous la vue et dans le journal du bureau. Pendant une pénurie, le prix du marché monte (achat et prix de référence des clients) et les livraisons traînent : le stock acheté avant rapporte plus. Le coût des ventes suit le coût moyen réel du stock.
- Plusieurs magasins : depuis la carte, touchez une ville pour voir le coût d'ouverture (dépôt, aménagement, premier loyer). Il faut 3 mois positifs et 60 de réputation dans un magasin (réglable dans `config.js`, rubrique `expansion`). La trésorerie, le temps, les gammes et les événements sont communs à l'enseigne ; chaque magasin a son local, son stock, son équipe, ses prix, son atelier, sa pub et sa réputation (un nouveau magasin démarre un peu au-dessus de 50 si l'enseigne est connue). On passe d'un magasin à l'autre en touchant son logo sur la carte. Le bilan de fin de mois regroupe tous les magasins. Palier 2 « Enseigne locale » : 3 magasins dans une même région.
- Palier 3 « Réseau régional » : magasins dans 2 régions et 2 M€ de chiffre d'affaires sur 12 mois. On peut alors construire un entrepôt par région (touchez une ville sur la carte) : il achète en gros (−8 % dès 20 unités) et stocke jusqu'à 1 500 unités. La flotte (camionnette : 60 unités par jour dans la région ; camion : 200 unités partout, 2 jours hors région) livre les magasins ; les véhicules tombent parfois en panne. Fiche « Logistique » depuis la fiche de l'enseigne ou le logo de l'entrepôt ; dans la réserve d'un magasin, le bouton « Entrepôt » fait venir le stock de l'entrepôt de sa région. Loyers d'entrepôt et entretien de la flotte apparaissent au bilan (réglages dans `config.js`, rubrique `logistique`).
- Responsable de magasin (dès le 2e magasin, au bureau, onglet Personnel) : chaque matin il remplit les rayons vides selon la clientèle de la ville, recommande jusqu'au stock visé (entrepôt de la région d'abord, puis fournisseur), remplace un vendeur ou un caissier manquant et répond aux demandes de PC sur mesure. Chaque tâche se coupe dans la carte « Pilotage automatique » ; ses actions sont résumées en une ligne dans le journal. Il ne commande pas sous 5 000 € de trésorerie. Les notifications des magasins non affichés ne s'affichent plus en bulles : elles restent dans le journal.
- Palier 4 « Leader national » (la victoire) : magasins dans 9 régions sur 13 et réputation moyenne de 70. Un écran de victoire résume la partie ; on peut ensuite continuer en mode libre. La sauvegarde affiche « Leader national » sur l'accueil.
- Expansion (réglages `expansion`) : en plus du dépôt et de l'aménagement, 20 000 € de frais d'ouverture par nouveau magasin ; 4 mois minimum entre deux ouvertures (×0,75 en facile, ×1,3 en difficile) ; frais de siège chaque mois par magasin au-delà du premier (800 € + 60 € par magasin supplémentaire, ×0,75 en facile, ×1,4 en difficile). Palier 3 : 5 M€ de CA sur 12 mois ; palier 4 : 20 M€.
- Salaires : ils sont prélevés en fin de mois. Dès que la trésorerie ne couvre plus les salaires restant à payer d'ici là, une alerte prévient le joueur (une fois par mois).
- Démarrage : il faut au moins 10 000 € de trésorerie après l'installation (`departMinimum`) ; Paris ne se lance donc qu'en facile. Les grandes villes conseillent d'embaucher plus de vendeurs dès le départ.
- En facile, la banque prête jusqu'à 40 000 € de dette au total ; au-delà, c'est la faillite.
- Le jeu tutoie le joueur.
- Ergonomie : le bouton « À faire » (barre du haut) liste ce qui demande ton attention dans tous les magasins (équipe incomplète, rayons vides, stock bas, demandes d'atelier, retards, local plein, trésorerie basse), avec « Y aller » qui ouvre directement le bon magasin, la bonne pièce et le bon onglet ; le nom du magasin dans la barre du haut permet de changer de magasin sans repasser par la carte. La carte se zoome (molette, pincement, boutons) et se déplace en glissant ; les logos gardent leur taille et les étiquettes qui se chevauchent sont masquées selon le zoom.
- Tuto : à la création d'une partie, choix « Suivre le tuto » ou « Jouer sans tuto ». Le tuto (13 étapes) guide de la carte jusqu'au lancement du temps : embaucher un vendeur et un caissier, commander trois produits, découvrir les pièces, le bouton « À faire » et le bilan. Une bulle pointe le bouton à toucher et avance toute seule quand l'action est faite. On peut le passer à tout moment et le revoir depuis le Menu. Ensuite, des astuces ponctuelles apparaissent une seule fois (première demande de PC sur mesure, premier rayon vide, local plein, deuxième magasin possible) ; « Plus d'astuces » les coupe.
- Une journée d'ouverture (9h–19h) dure 2 minutes à ×1 ; un mois = 4 semaines.
- Catalogue débloqué par gamme : entrée au départ, milieu après un premier mois positif ou 60 de réputation, haut de gamme après trois mois positifs ou 75 de réputation ; les produits restent cachés jusqu'au déblocage, annoncé par une fenêtre (réglable dans `config.js`, rubrique `deblocages`).
- Les clients (étudiants, joueurs, professionnels, familles) ont un besoin, un budget et une patience. Ils ne trouvent que ce qui est en rayon.
- Ordinateurs et composants : le client attend un vendeur. Périphériques : il se sert seul. Tout le monde passe en caisse.
- Un employé ne fait qu'une tâche à la fois ; le vendeur encaisse quand aucun caissier n'est libre.
- Moral (salaire, charge de travail), expérience et niveaux, candidats chaque lundi, démissions possibles.
- Loyer et charges payés le 1er du mois, salaires en fin de mois. Trésorerie négative en fin de mois : faillite (prêt bancaire en facile).
- La réputation monte lentement (ventes réussies) et baisse vite (clients partis après une longue attente).

Toutes les valeurs sont des valeurs de départ à ajuster pendant les tests.

## Enseignes concurrentes

Réglages dans `data/concurrents.js` (enseignes, force, ouvertures, soldes, rachat).

- Trois enseignes rivales : **MégaPC** (discount : ses clients comparent davantage les prix), **TechnoPlus** (grandes surfaces dans les grandes villes : prend le plus de clients) et **Info Proxi** (boutiques de proximité, jusque dans les petites villes). Leurs magasins apparaissent sur la carte (petits logos à côté des villes) et dans la fiche de chaque ville.
- La moitié de la concurrence d'une ville vient de petits indépendants (fixe) ; l'autre moitié vient des magasins rivaux réellement installés. Chaque magasin rival a une **force** (0 à 100) : à force 50, il retire environ 8 à 12 % des clients de ta boutique de la ville.
- Chaque fin de mois : la force des rivaux monte doucement ; dans une ville où tu as un magasin, elle baisse si ta réputation dépasse 50 (et monte si elle est basse). Sous 12, le magasin rival ferme. Les enseignes ouvrent de nouveaux magasins (de préférence dans les grandes villes et là où tu es installé) et lancent parfois des **soldes** d'une semaine dans tes villes.
- **Rachat** (à partir du palier 2) : dans une ville où tu es installé, le magasin rival ferme et ta réputation y gagne 6 points ; ailleurs, tu reprends son local, ce qui revient à ouvrir un magasin sans payer l'aménagement ni les frais d'ouverture (mêmes conditions qu'une ouverture). Prix : 12 000 € + 300 € par point de force + 4 mois de loyer de la ville.
- La fiche de l'enseigne résume le marché : nombre de magasins de chaque rival en France et dans tes villes.

## Dilemmes

Réglages et textes dans `data/dilemmes.js` : on peut ajouter un dilemme sans toucher au code.

- Environ une fois toutes les trois semaines de jeu (pas avant la 4e semaine), une situation demande une décision dans un de tes magasins : youtubeur qui propose une vidéo sponsorisée, employé qui demande une augmentation, client mécontent, lot à prix cassé, don à une école, concurrent qui débauche un employé, contrôle de sécurité, climatisation en panne (l'été), salon informatique, influenceuse gaming, stagiaire.
- Le temps s'arrête et la fenêtre ne se ferme que par un choix. Chaque choix a ses conséquences : argent (compté dans les charges du mois, ou dans les achats pour un lot de stock), réputation du magasin, affluence pendant quelques jours, moral ou salaire de l'équipe, départ d'un employé. Certains choix sont un pari (la vidéo peut faire un flop).
- Les montants dépendent de la taille de la ville ; un même dilemme ne revient pas avant 6 mois. Le résultat est noté dans le journal.
- Les outils d'équilibrage (`tools/`) ne chargent pas les dilemmes : leurs parties restent comparables.

## Décoration du magasin

Onglet **Déco** du magasin. Chaque magasin a son sol, ses murs et ses objets (2 plantes offertes à l'ouverture).

- **Pose** : on choisit un objet, une grille apparaît dans la salle en 3D (zones rouges = interdites : rayons et clients devant, caisse et file, table et vendeurs, atelier, entrée, portes). Souris : survoler puis cliquer pour poser ; mobile : toucher le sol puis « Acheter et poser ». R = tourner, Entrée = valider, Échap = annuler. Placement par demi-case.
- **Objet posé** : le toucher (en 2D ou en 3D) pour le déplacer, le tourner ou le revendre (50 % du prix).
- **Ambiance** = 1 − exp(−points / (14 × taille du local : 1 / 1,4 / 1,8)). À 100 % : ventes +8 %, gains de réputation +30 %, patience +15 %. Objets « attente » : patience jusqu'à +20 % de plus ; objets « vitrine » : passants jusqu'à +10 %. Coins à thème : jusqu'à +30 % de visites du profil visé et +12 % de ventes à ce profil.
- **Coûts** : achat payé comptant (compté avec les investissements), entretien mensuel ajouté aux charges.
- **Objets muraux** (néons, ruban LED, affiches, écran mural, tableau, étagère murale, « employé du mois ») : ils se posent sur les murs nord, ouest et est de la salle, en dehors de l'enseigne, des portes, de la fenêtre, de l'horloge et de l'atelier. « Autre mur » change de mur ; on peut aussi viser un mur directement. Les néons éclairent le mur autour d'eux (6 lumières au plus pour garder un rendu fluide).
- **Déménagement** : les objets qui ne tiennent plus dans le nouveau plan sont revendus automatiquement.
- Le petit local laisse peu de place (un seul coin à thème possible) : un plus grand local offre plus de place pour décorer.

## Comptes et sauvegarde en ligne (Supabase)

- Réglages dans `data/config.js` → `enLigne` (adresse du projet, clé **publishable**, nom de la table). La clé secrète (service_role) ne doit jamais être dans le jeu.
- Sans compte : comme avant, 3 emplacements dans le navigateur (« invité »).
- Avec un compte (email + mot de passe) : les 3 emplacements du compte sont envoyés dans la table `sauvegardes` (au plus toutes les 30 s pendant la partie, tout de suite en quittant, en changeant d'onglet ou avec « Sauvegarder en ligne maintenant » du menu). Une copie reste sur l'appareil ; à l'accueil, la plus récente des deux est utilisée.
- Les parties jouées en invité peuvent être ajoutées au compte (bouton « Ajouter à mon compte » à l'accueil).
- Mot de passe oublié : lien envoyé par email, qui ramène sur le jeu pour choisir un nouveau mot de passe.
- Code : `src/compte.js` (connexion et envoi) ; bibliothèque `lib/supabase.min.js` (supabase-js 2, incluse dans le dossier).

Réglages côté Supabase :
1. Table `sauvegardes` (id, user_id, emplacement 1-3, donnees jsonb, resume, maj) avec un index unique (user_id, emplacement) et les 4 règles RLS « chacun ses sauvegardes ».
2. Authentication → URL Configuration : Site URL = `https://kaouch-tycoon.vercel.app` et la même adresse dans « Redirect URLs » (sinon les liens des emails ouvrent localhost).
3. Pour le bouton « Supprimer mon compte », exécuter une fois dans SQL Editor :

```sql
create or replace function public.supprimer_mon_compte() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke execute on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
```

## Carte illustrée

Mer avec vagues et hauts-fonds, régions en couleurs douces (noms affichés quand ils ne gênent pas les villes), fleuves, montagnes, forêts, grands axes routiers et rose des vents. Les villes sont dessinées selon leur taille (maison, quartier, tours, tour Eiffel pour Paris).
Camions : les livraisons du grossiste (camionnette blanche, depuis le dépôt du grossiste près d'Orléans) et tes transferts entrepôt → magasin (camion bleu) roulent sur la carte pendant le trajet, avec leur itinéraire en pointillés.
Sources : contours des régions « france-geojson » (Admin Express IGN, Licence ouverte Etalab) ; pays et fleuves Natural Earth (domaine public).
